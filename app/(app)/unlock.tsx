import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { secureStorage } from '../../services/storage/secure';
import { Button, Input } from '../../components/ui';
import { Layout } from '../../constants/layout';

export default function UnlockScreen() {
  const { colors } = useTheme();
  const { setNeedsUnlock, logout, token, setToken } = useAuthStore();

  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const biometricEnabled = await secureStorage.isBiometricEnabled();

    setIsBiometricAvailable(hasHardware && isEnrolled && biometricEnabled);

    if (hasHardware) {
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType(Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition');
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType(Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint');
      }
    }

    // Auto-trigger biometric if available
    if (hasHardware && isEnrolled && biometricEnabled) {
      handleBiometricAuth();
    } else {
      setShowPasswordInput(true);
    }
  };

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Syncre',
        cancelLabel: 'Use Password',
        disableDeviceFallback: true,
      });

      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Token should already be in store, just mark as unlocked
        if (token) {
          try {
            await setToken(token);
            router.replace('/(app)/(tabs)');
          } catch (err) {
            // Token invalid, need to re-login
            setShowPasswordInput(true);
            setError('Session expired. Please enter your password.');
          }
        }
      } else {
        if (result.error === 'user_cancel') {
          setShowPasswordInput(true);
        }
      }
    } catch (err) {
      console.error('Biometric error:', err);
      setShowPasswordInput(true);
    }
  };

  const handlePasswordUnlock = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Verify token is still valid
      if (token) {
        await setToken(token);
        
        // Store password for future biometric unlocks if enabled
        const biometricEnabled = await secureStorage.isBiometricEnabled();
        if (biometricEnabled) {
          await secureStorage.setEncryptedPassword(password);
        }
        
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(app)/(tabs)');
      } else {
        // No token, need to re-login
        setError('Session expired. Please log in again.');
        setTimeout(() => {
          logout();
          router.replace('/(auth)/login');
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to unlock. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.accent + '15' }]}>
            <Ionicons 
              name={isBiometricAvailable ? 'finger-print' : 'lock-closed'} 
              size={48} 
              color={colors.accent} 
            />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isBiometricAvailable && !showPasswordInput
              ? `Use ${biometricType} to unlock`
              : 'Enter your password to continue'}
          </Text>
        </View>

        {showPasswordInput ? (
          <View style={styles.form}>
            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              leftIcon="lock-closed-outline"
              error={error}
            />

            <Button
              title="Unlock"
              onPress={handlePasswordUnlock}
              loading={isLoading}
              fullWidth
              style={styles.button}
            />

            {isBiometricAvailable && (
              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleBiometricAuth}
              >
                <Ionicons name="finger-print" size={24} color={colors.accent} />
                <Text style={[styles.biometricText, { color: colors.accent }]}>
                  Use {biometricType}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.biometricPrompt}>
            <TouchableOpacity
              style={[styles.biometricCircle, { borderColor: colors.accent }]}
              onPress={handleBiometricAuth}
            >
              <Ionicons name="finger-print" size={64} color={colors.accent} />
            </TouchableOpacity>
            <Text style={[styles.tapText, { color: colors.textSecondary }]}>
              Tap to unlock with {biometricType}
            </Text>

            <TouchableOpacity
              style={styles.usePasswordLink}
              onPress={() => setShowPasswordInput(true)}
            >
              <Text style={[styles.usePasswordText, { color: colors.accent }]}>
                Use Password Instead
              </Text>
            </TouchableOpacity>
          </View>
        )}

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
  form: {
    flex: 1,
  },
  button: {
    marginTop: Layout.spacing.md,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Layout.spacing.lg,
    padding: Layout.spacing.md,
  },
  biometricText: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.medium,
    marginLeft: Layout.spacing.sm,
  },
  biometricPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Layout.spacing.lg,
  },
  tapText: {
    fontSize: Layout.fontSize.md,
    marginBottom: Layout.spacing.xl,
  },
  usePasswordLink: {
    padding: Layout.spacing.md,
  },
  usePasswordText: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.medium,
  },
  logoutButton: {
    alignItems: 'center',
    padding: Layout.spacing.md,
    marginBottom: Layout.spacing.lg,
  },
  logoutText: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.medium,
  },
});
