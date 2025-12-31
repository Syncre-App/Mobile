import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { useE2EEStore } from '../../stores/e2eeStore';
import { keysApi } from '../../services/api';
import { secureStorage } from '../../services/storage/secure';
import { Button, Input } from '../../components/ui';
import { Layout } from '../../constants/layout';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { login, isLoading: authLoading, error, clearError } = useAuthStore();
  const { setupIdentityKey, unlockWithPassword, registerDevice } = useE2EEStore();
  const [isSettingUp, setIsSettingUp] = useState(false);
  const isLoading = authLoading || isSettingUp;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const validate = () => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!email.includes('@')) {
      errors.email = 'Please enter a valid email';
    }

    if (!password) {
      errors.password = 'Password is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async () => {
    clearError();

    if (!validate()) return;

    const result = await login({ email: email.trim().toLowerCase(), password });

    if (result.success) {
      setIsSettingUp(true);
      
      try {
        // Check if user has identity key on server
        let hasIdentityKey = false;
        try {
          await keysApi.getIdentityKey();
          hasIdentityKey = true;
        } catch (e: any) {
          hasIdentityKey = e.status !== 404;
        }

        if (hasIdentityKey) {
          // Unlock E2EE with password
          const unlockResult = await unlockWithPassword(password);
          if (!unlockResult.success) {
            console.error('Failed to unlock E2EE:', unlockResult.error);
            // Continue anyway, might need re-setup
          }
        } else {
          // Create new identity key with password
          const setupResult = await setupIdentityKey(password);
          if (!setupResult.success) {
            throw new Error(setupResult.error || 'Failed to setup encryption');
          }
        }

        // Register device
        const deviceId = await secureStorage.getDeviceId();
        if (deviceId) {
          try {
            await registerDevice(deviceId);
          } catch (e) {
            console.log('Device registration:', e);
          }
        }

        // Check if PIN is set up
        const hasPin = await secureStorage.hasPinSetup();
        if (hasPin) {
          // PIN exists, E2EE already unlocked, go to main app
          router.replace('/(app)/(tabs)');
        } else {
          // No PIN, need to set up (E2EE already done)
          router.replace('/(auth)/pin-setup');
        }
      } catch (err: any) {
        console.error('E2EE setup error:', err);
        // Still go to app, might work
        router.replace('/(app)/(tabs)');
      } finally {
        setIsSettingUp(false);
      }
    } else if (result.verified === false) {
      // User not verified, redirect to verification
      router.push({
        pathname: '/(auth)/verify',
        params: { email: email.trim().toLowerCase() },
      });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Sign in to continue to Syncre
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon="mail-outline"
              error={validationErrors.email}
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              leftIcon="lock-closed-outline"
              error={validationErrors.password}
            />

            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              style={styles.forgotPassword}
            >
              <Text style={[styles.forgotPasswordText, { color: colors.accent }]}>
                Forgot Password?
              </Text>
            </TouchableOpacity>

            {error && (
              <View style={[styles.errorContainer, { backgroundColor: colors.error + '15' }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            )}

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              fullWidth
              style={styles.button}
            />
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Don't have an account?{' '}
            </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={[styles.footerLink, { color: colors.accent }]}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.xxl,
    paddingBottom: Layout.spacing.lg,
  },
  header: {
    marginBottom: Layout.spacing.xxl,
  },
  title: {
    fontSize: Layout.fontSize.largeTitle,
    fontWeight: Layout.fontWeight.bold,
    marginBottom: Layout.spacing.sm,
  },
  subtitle: {
    fontSize: Layout.fontSize.md,
  },
  form: {
    flex: 1,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: Layout.spacing.lg,
    marginTop: -Layout.spacing.sm,
  },
  forgotPasswordText: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.medium,
  },
  errorContainer: {
    padding: Layout.spacing.md,
    borderRadius: Layout.radius.md,
    marginBottom: Layout.spacing.md,
  },
  errorText: {
    fontSize: Layout.fontSize.sm,
    textAlign: 'center',
  },
  button: {
    marginTop: Layout.spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Layout.spacing.xl,
  },
  footerText: {
    fontSize: Layout.fontSize.md,
  },
  footerLink: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.semibold,
  },
});
