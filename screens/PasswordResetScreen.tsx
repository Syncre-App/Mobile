import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBackground } from '../components/AppBackground';
import { GlassCard } from '../components/GlassCard';
import { TransparentField } from '../components/TransparentField';
import { ApiService } from '../services/ApiService';
import { CryptoService } from '../services/CryptoService';
import { IdentityService } from '../services/IdentityService';
import { notificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';
import { palette, radii, spacing } from '../theme/designSystem';

export const PasswordResetScreen: React.FC = () => {
  const params = useLocalSearchParams<{ email?: string; code?: string; token?: string }>();
  const [email, setEmail] = useState<string>((params.email as string) || '');
  const [code, setCode] = useState<string>((params.code as string) || '');
  const [resetToken, setResetToken] = useState<string>((params.token as string) || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof params.email === 'string') {
      setEmail(params.email);
    }
    if (typeof params.code === 'string') {
      setCode(params.code);
    }
    if (typeof params.token === 'string') {
      setResetToken(params.token);
    }
  }, [params.code, params.email, params.token]);

  const formattedExpiry = useMemo(() => {
    if (!expiresAt) return null;
    try {
      return new Date(expiresAt).toLocaleString();
    } catch {
      return expiresAt;
    }
  }, [expiresAt]);

  const handleRequestReset = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      notificationService.show('error', 'Enter a valid email address', 'Error');
      return;
    }
    setRequesting(true);
    setStatusMessage(null);

    try {
      const response = await ApiService.post('/auth/password-reset/request', { email: trimmedEmail });
      if (response.success) {
        const payload: any = response.data || {};
        setResetToken(payload.resetToken || '');
        setExpiresAt(payload.expires_at || null);
        setStatusMessage('We emailed you a 6-digit code. Use it within 15 minutes to set a new password.');
        notificationService.show('success', 'Reset email sent. Check your inbox.', 'Sent');
      } else {
        notificationService.show('error', response.error || 'Unable to start reset', 'Error');
      }
    } catch (error: any) {
      notificationService.show('error', error?.message || 'Network error', 'Error');
    } finally {
      setRequesting(false);
    }
  };

  const handleCompleteReset = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      notificationService.show('error', 'Enter a valid email address', 'Error');
      return;
    }
    if (!resetToken) {
      notificationService.show('error', 'Missing reset token. Request a new link.', 'Error');
      return;
    }
    const normalizedCode = code.replace(/\D/g, '').slice(0, 6);
    if (!normalizedCode || normalizedCode.length < 6) {
      notificationService.show('error', 'Add the 6-digit code from your email', 'Error');
      return;
    }
    if (!password || password.length < 8) {
      notificationService.show('error', 'Password must be at least 8 characters', 'Error');
      return;
    }
    if (password !== confirmPassword) {
      notificationService.show('error', 'Passwords do not match', 'Error');
      return;
    }

    setSubmitting(true);
    try {
      const response = await ApiService.post('/auth/password-reset/complete', {
        email: trimmedEmail,
        code: normalizedCode,
        token: resetToken,
        newPassword: password,
      });

      if (response.success && response.data) {
        await StorageService.removeAuthToken();
        await StorageService.removeItem('user_data');
        await CryptoService.resetIdentity().catch(() => null);
        notificationService.show('success', 'Password updated. Please sign in with your new password.', 'Success');
        router.replace('/' as any);
      } else {
        notificationService.show('error', response.error || 'Reset failed', 'Error');
      }
    } catch (error: any) {
      notificationService.show('error', error?.message || 'Unable to reset password', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppBackground />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.overline}>Reset access</Text>
          <Text style={styles.title}>Secure your account</Text>
          <Text style={styles.description}>
            We’ll send a one-time code to your email. Use it within 15 minutes to set a fresh password.
          </Text>
        </View>

        <GlassCard style={styles.card} variant="subtle" padding={spacing.lg}>
          <View style={styles.stack}>
            <TransparentField
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              prefixIcon={<Ionicons name="mail-outline" size={18} color={palette.textSubtle} />}
              style={styles.field}
            />

            <TouchableOpacity
              style={[styles.button, requesting && styles.buttonDisabled]}
              onPress={handleRequestReset}
              disabled={requesting}
              activeOpacity={0.92}
            >
              <LinearGradient
                colors={requesting ? ['#475569', '#334155'] : ['#22d3ee', '#2563eb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {requesting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Send reset code</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>Then finish here</Text>
              <View style={styles.dividerLine} />
            </View>

            <TransparentField
              placeholder="6-digit code"
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoCapitalize="none"
              prefixIcon={<Ionicons name="key-outline" size={18} color={palette.textSubtle} />}
              style={styles.field}
            />

            <TransparentField
              placeholder="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              prefixIcon={<Ionicons name="lock-closed-outline" size={18} color={palette.textSubtle} />}
              style={styles.field}
            />

            <TransparentField
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              prefixIcon={<Ionicons name="shield-checkmark-outline" size={18} color={palette.textSubtle} />}
              style={styles.field}
            />

            <TouchableOpacity
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={handleCompleteReset}
              disabled={submitting}
              activeOpacity={0.92}
            >
              <LinearGradient
                colors={submitting ? ['#475569', '#334155'] : ['#38bdf8', '#0ea5e9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Update password</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {statusMessage ? <Text style={styles.status}>{statusMessage}</Text> : null}
            {formattedExpiry ? (
              <Text style={styles.expiry}>Link expires at {formattedExpiry}</Text>
            ) : null}
          </View>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    gap: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  overline: {
    color: palette.textSubtle,
    fontFamily: 'SpaceGrotesk-Medium',
    letterSpacing: 4,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 24,
    textAlign: 'center',
    fontFamily: 'SpaceGrotesk-SemiBold',
  },
  description: {
    color: palette.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontSize: 15,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  stack: {
    gap: spacing.sm,
  },
  field: {
    marginBottom: spacing.xs,
  },
  button: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  buttonGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerLabel: {
    color: palette.textSubtle,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  status: {
    color: palette.text,
    fontSize: 14,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  expiry: {
    color: palette.textMuted,
    fontSize: 13,
  },
});
