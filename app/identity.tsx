import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '../components/GlassCard';
import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { CryptoService } from '../services/CryptoService';
import { NotificationService } from '../services/NotificationService';
import { IdentityService } from '../services/IdentityService';
import { PinService } from '../services/PinService';

export default function IdentityScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = params?.mode === 'setup' ? 'setup' : 'unlock';

  const [pin, setPin] = useState('');
  const [obscurePin, setObscurePin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => (mode === 'setup' ? 'Create Secure PIN' : 'Unlock Secure Messages'),
    [mode]
  );
  const subtitle = useMemo(() => {
    if (mode === 'setup') {
      return 'Pick a 4–6 digit PIN. This protects your private key and lets you restore messages on any device.';
    }
    return 'Enter your PIN to unlock encrypted messages on this device.';
  }, [mode]);

  const handleSubmit = async () => {
    setError(null);
    const trimmedPin = pin.trim();
    if (!trimmedPin) {
      setError('Secure PIN is required.');
      return;
    }
    if (trimmedPin.length < 4 || trimmedPin.length > 6) {
      setError('PIN must be between 4 and 6 digits.');
      return;
    }
    try {
      setIsSubmitting(true);
      const token = await StorageService.getAuthToken();
      if (!token) {
        setError('Session expired. Please sign in again.');
        router.replace('/');
        return;
      }

      const [remoteResponse, localIdentity] = await Promise.all([
        ApiService.get('/keys/identity', token),
        CryptoService.getStoredIdentity(),
      ]);
      const remoteData = remoteResponse.success ? remoteResponse.data : null;
      const remotePublicKey = remoteData?.publicKey || null;
      const remoteHasEncrypted = remoteResponse.success && Boolean(remoteData?.encryptedPrivateKey);
      if (!remoteHasEncrypted && remoteResponse.statusCode !== 404 && mode === 'unlock') {
        setError(remoteResponse.error || 'Failed to check secure backup. Try again.');
        return;
      }

      if (mode === 'unlock' && !remoteHasEncrypted) {
        setError('No secure backup found. Please set up your PIN on one of your existing devices.');
        return;
      }

      if (
        mode === 'unlock' &&
        localIdentity &&
        remotePublicKey &&
        localIdentity.publicKey !== remotePublicKey
      ) {
        const choice = await new Promise<'remote' | 'local' | null>((resolve) => {
          Alert.alert(
            'Secure identity mismatch',
            'This device has a different encryption key than the backup on the server. Which one should we keep?',
            [
              {
                text: 'Use backup',
                style: 'destructive',
                onPress: () => resolve('remote'),
              },
              {
                text: 'Use this device',
                onPress: () => resolve('local'),
              },
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => resolve(null),
              },
            ]
          );
        });

        if (!choice) {
          return;
        }

        if (choice === 'remote') {
          await CryptoService.resetIdentity();
        }
      }

      await PinService.setPin(trimmedPin);
      await CryptoService.bootstrapIdentity({ pin: trimmedPin, token, identityResponse: remoteResponse });
      IdentityService.clearCache();
      NotificationService.show(
        'success',
        mode === 'setup' ? 'Secure PIN saved' : 'Secure messaging unlocked'
      );
      router.replace('/home');
    } catch (err: any) {
      console.error('[IdentityScreen] Failed to process identity:', err);
      setError(err?.message || 'Failed to process secure keys. Please double-check your PIN.');
    } finally {
      setIsSubmitting(false);
      setPin('');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#03040A', '#071026']} style={StyleSheet.absoluteFillObject} />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <GlassCard width="100%" style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Why this matters</Text>
            <Text style={styles.infoText}>
              Your PIN encrypts the private key that unlocks your history. Lose the PIN and your
              messages stay locked forever.
            </Text>
              <View style={styles.stepList}>
                <View style={styles.stepRow}>
                  <View style={styles.stepDot} />
                  <Text style={styles.stepText}>Numbers only, 4–6 digits</Text>
                </View>
                <View style={styles.stepRow}>
                  <View style={styles.stepDot} />
                  <Text style={styles.stepText}>Use the same PIN on every device</Text>
                </View>
                <View style={styles.stepRow}>
                  <View style={styles.stepDot} />
                  <Text style={styles.stepText}>Without it, past messages can’t be restored</Text>
                </View>
              </View>
            </View>

            <Text style={styles.fieldLabel}>PIN code</Text>
            <TextInput
              style={styles.input}
              placeholder={mode === 'setup' ? 'Enter a 4–6 digit PIN' : 'Enter your PIN'}
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              secureTextEntry={obscurePin}
              autoCapitalize="none"
              keyboardType="number-pad"
              maxLength={6}
              value={pin}
              onChangeText={setPin}
              editable={!isSubmitting}
            />
            <TouchableOpacity
              style={styles.toggle}
              onPress={() => setObscurePin((prev) => !prev)}
              disabled={isSubmitting}
            >
            </TouchableOpacity>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>{mode === 'setup' ? 'Save PIN' : 'Unlock'}</Text>
              )}
            </TouchableOpacity>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#03040A',
  },
  keyboard: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scroll: {
    paddingVertical: 32,
    paddingHorizontal: 4,
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  infoTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 20,
  },
  infoBullet: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
  },
  stepList: {
    marginTop: 8,
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2C82FF',
  },
  stepText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    flex: 1,
  },
  fieldLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    marginTop: 6,
    marginBottom: 4,
  },
  toggle: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  toggleText: {
    color: '#2C82FF',
    fontSize: 13,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 14,
  },
  button: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: '#2C82FF',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
