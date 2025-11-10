import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '../components/GlassCard';
import { StorageService } from '../services/StorageService';
import { CryptoService } from '../services/CryptoService';
import { NotificationService } from '../services/NotificationService';
import { IdentityService } from '../services/IdentityService';
import { PinService } from '../services/PinService';

export default function IdentityScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = params?.mode === 'setup' ? 'setup' : 'unlock';

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [obscurePin, setObscurePin] = useState(true);
  const [obscureConfirmPin, setObscureConfirmPin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => (mode === 'setup' ? 'Create Secure PIN' : 'Unlock Secure Messages'),
    [mode]
  );
  const subtitle = useMemo(() => {
    if (mode === 'setup') {
      return 'Válassz egy 6 számjegyű PIN-kódot. Ezzel védjük a privát kulcsodat, és minden eszközön ezzel fogod feloldani a titkosított beszélgetéseidet.';
    }
    return 'Add meg a Secure PIN-ed, hogy ezen az eszközön is elérhesd a titkosított üzeneteidet.';
  }, [mode]);

  const handleSubmit = async () => {
    setError(null);
    const trimmedPin = pin.trim();
    if (!trimmedPin) {
      setError('Secure PIN is required.');
      return;
    }
    if (trimmedPin.length < 6) {
      setError('PIN must be at least 6 digits.');
      return;
    }
    if (mode === 'setup') {
      const confirm = confirmPin.trim();
      if (!confirm) {
        setError('Please confirm your PIN.');
        return;
      }
      if (confirm !== trimmedPin) {
        setError('PIN entries do not match.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const token = await StorageService.getAuthToken();
      if (!token) {
        setError('Session expired. Please sign in again.');
        router.replace('/');
        return;
      }

      await PinService.setPin(trimmedPin);
      await CryptoService.bootstrapIdentity({ pin: trimmedPin, token });
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
      setConfirmPin('');
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
        <GlassCard width="100%" style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <TextInput
            style={styles.input}
            placeholder={mode === 'setup' ? 'Choose a Secure PIN' : 'Enter Secure PIN'}
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            secureTextEntry={obscurePin}
            autoCapitalize="none"
            keyboardType="number-pad"
            value={pin}
            onChangeText={setPin}
            editable={!isSubmitting}
          />
          <TouchableOpacity
            style={styles.toggle}
            onPress={() => setObscurePin((prev) => !prev)}
            disabled={isSubmitting}
          >
            <Text style={styles.toggleText}>{obscurePin ? 'Show PIN' : 'Hide PIN'}</Text>
          </TouchableOpacity>

          {mode === 'setup' ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Confirm Secure PIN"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                secureTextEntry={obscureConfirmPin}
                autoCapitalize="none"
                keyboardType="number-pad"
                value={confirmPin}
                onChangeText={setConfirmPin}
                editable={!isSubmitting}
              />
              <TouchableOpacity
                style={styles.toggle}
                onPress={() => setObscureConfirmPin((prev) => !prev)}
                disabled={isSubmitting}
              >
                <Text style={styles.toggleText}>{obscureConfirmPin ? 'Show PIN' : 'Hide PIN'}</Text>
              </TouchableOpacity>
            </>
          ) : null}

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
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
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
  input: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  toggle: {
    alignSelf: 'flex-end',
    marginTop: -12,
    marginBottom: 8,
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
