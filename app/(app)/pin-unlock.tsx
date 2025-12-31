import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { Host, Button as SwiftUIButton } from '@expo/ui/swift-ui';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { secureStorage } from '../../services/storage/secure';
import { Layout } from '../../constants/layout';
import { APP_CONFIG } from '../../constants/config';

/**
 * PIN Unlock Screen
 * 
 * This screen is shown when the app starts and PIN is set up.
 * This is only a local lock screen - E2EE is handled during login with password.
 */
export default function PinUnlockScreen() {
  const { colors } = useTheme();
  const { logout } = useAuthStore();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const hashPin = async (pinCode: string): Promise<string> => {
    // Use the same fixed salt as PIN setup
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pinCode + 'syncre_pin_salt'
    );
    return hash;
  };

  const handlePinChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, APP_CONFIG.PIN_MAX_LENGTH);
    setPin(digits);
    setError('');
  };

  const verifyPin = async () => {
    if (pin.length < APP_CONFIG.PIN_MIN_LENGTH) {
      setError(`PIN must be at least ${APP_CONFIG.PIN_MIN_LENGTH} digits`);
      return;
    }

    setIsLoading(true);

    try {
      const storedHash = await secureStorage.getPinHash();
      const inputHash = await hashPin(pin);

      if (inputHash === storedHash) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(app)/(tabs)');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setPin('');

        if (newAttempts >= 5) {
          setError('Too many attempts. Please log in again.');
          setTimeout(async () => {
            await logout();
            router.replace('/(auth)/login');
          }, 2000);
        } else {
          setError(`Incorrect PIN. ${5 - newAttempts} attempts remaining.`);
        }
      }
    } catch (err: any) {
      console.error('PIN verification error:', err);
      setError(err.message || 'Failed to verify PIN');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await logout();
    router.replace('/(auth)/login');
  };

  const canUnlock = pin.length >= APP_CONFIG.PIN_MIN_LENGTH;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Pressable style={styles.content} onPress={() => inputRef.current?.focus()}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.accent + '15' }]}>
            <Ionicons name="lock-closed" size={48} color={colors.accent} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Enter PIN</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter your PIN to unlock
          </Text>
        </View>

        {/* PIN Dots */}
        <View style={styles.pinContainer}>
          <View style={styles.pinDots}>
            {Array.from({ length: APP_CONFIG.PIN_MAX_LENGTH }).map((_, index) => (
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
            maxLength={APP_CONFIG.PIN_MAX_LENGTH}
            autoFocus
            secureTextEntry
            editable={!isLoading && attempts < 5}
            caretHidden
          />
        </View>

        {/* Error */}
        {error ? (
          <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
        ) : null}

        {/* Loading */}
        {isLoading && (
          <Text style={[styles.loading, { color: colors.textSecondary }]}>
            Verifying...
          </Text>
        )}
      </Pressable>

      {/* Unlock button */}
      {canUnlock && !isLoading && (
        <View style={styles.footer}>
          {Platform.OS === 'ios' ? (
            <Host style={styles.nativeButtonHost}>
              <SwiftUIButton onPress={verifyPin}>
                Unlock
              </SwiftUIButton>
            </Host>
          ) : (
            <TouchableOpacity
              style={[styles.unlockButton, { backgroundColor: colors.accent }]}
              onPress={verifyPin}
            >
              <Text style={styles.unlockButtonText}>Unlock</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Logout button */}
      <View style={styles.logoutContainer}>
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
  footer: {
    padding: Layout.spacing.lg,
  },
  nativeButtonHost: {
    height: 50,
  },
  unlockButton: {
    height: 50,
    borderRadius: Layout.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.semibold,
  },
  logoutContainer: {
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
