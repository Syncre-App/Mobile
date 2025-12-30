import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { authApi } from '../../services/api';
import { Button, Input } from '../../components/ui';
import { Layout } from '../../constants/layout';

type Step = 'request' | 'verify' | 'complete';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleRequestReset = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await authApi.requestPasswordReset({ email: email.trim().toLowerCase() });
      setResetToken(response.resetToken);
      setStep('verify');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (value: string, index: number) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  };

  const handleVerifyCode = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Please enter the complete code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await authApi.verifyPasswordReset({
        email: email.trim().toLowerCase(),
        code: fullCode,
        token: resetToken,
      });
      setStep('complete');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired code');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteReset = async () => {
    if (newPassword.length < 8 || newPassword.length > 64) {
      setError('Password must be 8-64 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await authApi.completePasswordReset({
        email: email.trim().toLowerCase(),
        code: code.join(''),
        token: resetToken,
        newPassword,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(auth)/login');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'request':
        return (
          <>
            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: colors.accent + '15' }]}>
                <Ionicons name="key-outline" size={40} color={colors.accent} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Forgot Password?</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Enter your email and we'll send you a reset code
              </Text>
            </View>

            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon="mail-outline"
            />

            <Button
              title="Send Reset Code"
              onPress={handleRequestReset}
              loading={isLoading}
              fullWidth
              style={styles.button}
            />
          </>
        );

      case 'verify':
        return (
          <>
            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: colors.accent + '15' }]}>
                <Ionicons name="shield-checkmark-outline" size={40} color={colors.accent} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Enter Code</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                We've sent a 6-digit code to {email}
              </Text>
            </View>

            <View style={styles.codeContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={ref => { inputRefs.current[index] = ref; }}
                  style={[
                    styles.codeInput,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: digit ? colors.accent : colors.inputBorder,
                      color: colors.text,
                    },
                  ]}
                  value={digit}
                  onChangeText={value => handleCodeChange(value, index)}
                  onKeyPress={e => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            <Button
              title="Verify Code"
              onPress={handleVerifyCode}
              loading={isLoading}
              disabled={code.some(d => !d)}
              fullWidth
              style={styles.button}
            />
          </>
        );

      case 'complete':
        return (
          <>
            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: colors.accent + '15' }]}>
                <Ionicons name="lock-closed-outline" size={40} color={colors.accent} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>New Password</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Create a strong password for your account
              </Text>
            </View>

            <Input
              label="New Password"
              placeholder="Enter new password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              leftIcon="lock-closed-outline"
              hint="Must be 8-64 characters"
            />

            <Input
              label="Confirm Password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              leftIcon="lock-closed-outline"
            />

            <Button
              title="Reset Password"
              onPress={handleCompleteReset}
              loading={isLoading}
              fullWidth
              style={styles.button}
            />
          </>
        );
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
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => {
              if (step === 'request') {
                router.back();
              } else if (step === 'verify') {
                setStep('request');
                setError('');
              } else {
                setStep('verify');
                setError('');
              }
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          {error && (
            <View style={[styles.errorContainer, { backgroundColor: colors.error + '15' }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          {renderStep()}
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
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.lg,
  },
  backButton: {
    marginBottom: Layout.spacing.lg,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Layout.spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
    paddingHorizontal: Layout.spacing.lg,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Layout.spacing.xl,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderRadius: Layout.radius.md,
    fontSize: Layout.fontSize.xl,
    fontWeight: Layout.fontWeight.bold,
    textAlign: 'center',
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
});
