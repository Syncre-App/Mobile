import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { useE2EEStore } from '../../stores/e2eeStore';
import { secureStorage } from '../../services/storage/secure';
import { Layout } from '../../constants/layout';

export default function PinUnlockScreen() {
  const { colors } = useTheme();
  const { user, logout } = useAuthStore();
  const { unlockWithPassword, registerDevice } = useE2EEStore();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [pinLength, setPinLength] = useState(6); // Default, will be detected

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Focus input on mount
    setTimeout(() => inputRef.current?.focus(), 100);
    
    // Detect PIN length from stored hash (we don't know the exact length, use max)
    detectPinLength();
  }, []);

  const detectPinLength = async () => {
    // We'll use 6 as default max length
    setPinLength(6);
  };

  const hashPin = async (pinCode: string): Promise<string> => {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pinCode + (user?.id || 'salt')
    );
    return hash;
  };

  const handlePinChange = async (value: string) => {
    const digits = value.replace(/\D/g, '');
    setPin(digits);
    setError('');

    // Try to verify at 4, 5, and 6 digits
    if (digits.length >= 4 && digits.length <= 6) {
      await verifyPin(digits);
    }
  };

  const verifyPin = async (pinToVerify: string) => {
    setIsLoading(true);

    try {
      const storedHash = await secureStorage.getPinHash();
      const inputHash = await hashPin(pinToVerify);

      if (inputHash === storedHash) {
        // PIN correct!
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Unlock E2EE with PIN
        const result = await unlockWithPassword(pinToVerify);
        if (!result.success) {
          throw new Error(result.error || 'Failed to unlock encryption');
        }

        // Register device if needed
        const deviceId = await secureStorage.getDeviceId();
        if (deviceId) {
          try {
            await registerDevice(deviceId);
          } catch (e) {
            // Device might already be registered, ignore
            console.log('Device registration:', e);
          }
        }

        // Navigate to main app
        router.replace('/(app)/(tabs)');
      } else if (pinToVerify.length === pinLength) {
        // Wrong PIN at max length
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setAttempts(prev => prev + 1);
        setError('Incorrect PIN');
        setPin('');

        // Lock out after too many attempts
        if (attempts >= 4) {
          setError('Too many attempts. Please log in again.');
          setTimeout(async () => {
            await logout();
            router.replace('/(auth)/login');
          }, 2000);
        }
      }
    } catch (err: any) {
      console.error('PIN verification error:', err);
      // Don't show error if still typing
      if (pinToVerify.length === pinLength) {
        setError(err.message || 'Failed to unlock');
        setPin('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.accent + '15' }]}>
            <Ionicons name="lock-closed" size={48} color={colors.accent} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Enter PIN</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter your PIN to unlock your messages
          </Text>
        </View>

        {/* PIN Dots */}
        <View style={styles.pinContainer}>
          <View style={styles.pinDots}>
            {Array.from({ length: pinLength }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.pinDot,
                  {
                    backgroundColor: index < pin.length ? colors.accent : 'transparent',
                    borderColor: error ? colors.error : colors.border,
                  },
                ]}
              />
            ))}
          </View>

          {/* Hidden input */}
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={pin}
            onChangeText={handlePinChange}
            keyboardType="number-pad"
            maxLength={pinLength}
            autoFocus
            secureTextEntry
            editable={!isLoading}
          />
        </View>

        {/* Error */}
        {error ? (
          <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
        ) : null}

        {/* Loading */}
        {isLoading && (
          <Text style={[styles.loading, { color: colors.textSecondary }]}>
            Unlocking...
          </Text>
        )}

        {/* Attempts remaining */}
        {attempts > 0 && attempts < 5 && (
          <Text style={[styles.attemptsText, { color: colors.warning }]}>
            {5 - attempts} attempts remaining
          </Text>
        )}
      </View>

      {/* Logout button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={[styles.logoutText, { color: colors.error }]}>
            Log Out
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Layout.spacing.xxl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Layout.spacing.lg,
  },
  title: {
    fontSize: Layout.fontSize.title,
    fontWeight: Layout.fontWeight.bold,
    marginBottom: Layout.spacing.sm,
  },
  subtitle: {
    fontSize: Layout.fontSize.md,
    textAlign: 'center',
  },
  pinContainer: {
    alignItems: 'center',
    marginBottom: Layout.spacing.xl,
  },
  pinDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Layout.spacing.md,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  error: {
    textAlign: 'center',
    fontSize: Layout.fontSize.sm,
    marginBottom: Layout.spacing.md,
  },
  loading: {
    textAlign: 'center',
    fontSize: Layout.fontSize.sm,
    marginBottom: Layout.spacing.md,
  },
  attemptsText: {
    textAlign: 'center',
    fontSize: Layout.fontSize.sm,
    marginTop: Layout.spacing.sm,
  },
  footer: {
    padding: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
    alignItems: 'center',
  },
  logoutButton: {
    padding: Layout.spacing.md,
  },
  logoutText: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.medium,
  },
});
