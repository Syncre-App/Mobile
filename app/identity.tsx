import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '../components/GlassCard';
import { StorageService } from '../services/StorageService';
import { CryptoService } from '../services/CryptoService';
import { NotificationService } from '../services/NotificationService';
import { IdentityService } from '../services/IdentityService';

export default function IdentityBootstrapScreen() {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!password.trim()) {
      setError('Password is required to unlock your secure messages.');
      return;
    }
    setIsSubmitting(true);
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        setError('Session expired. Please sign in again.');
        router.replace('/');
        return;
      }
      await CryptoService.bootstrapIdentity({ password, token });
      IdentityService.clearCache();
      NotificationService.show('success', 'Secure messaging unlocked');
      router.replace('/home');
    } catch (err: any) {
      console.error('[IdentityBootstrap] Failed to bootstrap identity:', err);
      setError(err?.message || 'Failed to unlock keys. Please double-check your password.');
    } finally {
      setIsSubmitting(false);
      setPassword('');
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
          <Text style={styles.title}>Secure Sync Needed</Text>
          <Text style={styles.subtitle}>
            To read and send encrypted messages on this device, please confirm your account
            password so we can restore your keys.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Account password"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            editable={!isSubmitting}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Unlock Secure Messages</Text>
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
