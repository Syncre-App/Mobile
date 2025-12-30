import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui';
import { Layout } from '../../constants/layout';
import { APP_CONFIG } from '../../constants/config';

export default function VerifyScreen() {
  const { colors } = useTheme();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verify, isLoading, error, clearError } = useAuthStore();

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    // Cooldown timer
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleCodeChange = (value: string, index: number) => {
    // Only allow digits
    const digit = value.replace(/[^0-9]/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (digit && index === 5) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
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

  const handleVerify = async (fullCode?: string) => {
    clearError();
    const codeToVerify = fullCode || code.join('');

    if (codeToVerify.length !== 6) {
      return;
    }

    const result = await verify(email!, codeToVerify);

    if (result.success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Go to login after successful verification
      router.replace('/(auth)/login');
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Clear code on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = () => {
    // TODO: Implement resend API call
    setResendCooldown(APP_CONFIG.VERIFICATION_RESEND_COOLDOWN);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.accent + '15' }]}>
              <Ionicons name="mail-outline" size={40} color={colors.accent} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Verify Your Email</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              We've sent a 6-digit code to
            </Text>
            <Text style={[styles.email, { color: colors.text }]}>{email}</Text>
          </View>

          {/* Code Input */}
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

          {error && (
            <View style={[styles.errorContainer, { backgroundColor: colors.error + '15' }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          <Button
            title="Verify"
            onPress={() => handleVerify()}
            loading={isLoading}
            disabled={code.some(d => !d)}
            fullWidth
            style={styles.button}
          />

          {/* Resend */}
          <View style={styles.resendContainer}>
            <Text style={[styles.resendText, { color: colors.textSecondary }]}>
              Didn't receive the code?{' '}
            </Text>
            {resendCooldown > 0 ? (
              <Text style={[styles.cooldownText, { color: colors.textSecondary }]}>
                Resend in {resendCooldown}s
              </Text>
            ) : (
              <TouchableOpacity onPress={handleResend}>
                <Text style={[styles.resendLink, { color: colors.accent }]}>Resend</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
  },
  backButton: {
    marginBottom: Layout.spacing.lg,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Layout.spacing.xxl,
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
  },
  email: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.semibold,
    marginTop: Layout.spacing.xs,
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
    marginBottom: Layout.spacing.lg,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    fontSize: Layout.fontSize.sm,
  },
  resendLink: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.semibold,
  },
  cooldownText: {
    fontSize: Layout.fontSize.sm,
  },
});
