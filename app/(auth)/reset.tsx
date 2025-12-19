import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppBackground } from '../../components/AppBackground';
import { Field } from '../../components/Field';
import { GlassPanel } from '../../components/GlassPanel';
import { PrimaryButton } from '../../components/PrimaryButton';
import { TextButton } from '../../components/TextButton';
import { font, spacing, useTheme } from '../../theme/designSystem';
import { ApiService } from '../../services/ApiService';
import { NotificationService } from '../../services/NotificationService';
import { Screen } from '../../components/Screen';

export default function ResetScreen() {
  const params = useLocalSearchParams<{ email?: string; code?: string; token?: string }>();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [email, setEmail] = useState(params.email || '');
  const [code, setCode] = useState(params.code || '');
  const [token, setToken] = useState(params.token || '');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequest = async () => {
    if (!email.trim()) {
      NotificationService.show('error', 'Email is required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await ApiService.post('/auth/password-reset/request', { email: email.trim() });
      if (!response.success) {
        NotificationService.show('error', response.error || 'Reset request failed.');
        return;
      }
      NotificationService.show('success', 'Reset code sent. Check your email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!email.trim() || !code.trim() || !password) {
      NotificationService.show('error', 'Email, code, and password are required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await ApiService.post('/auth/password-reset/complete', {
        email: email.trim(),
        code: code.trim(),
        token: token.trim(),
        newPassword: password,
      });
      if (!response.success) {
        NotificationService.show('error', response.error || 'Reset failed.');
        return;
      }
      NotificationService.show('success', 'Password updated. Please sign in.');
      router.replace('/login');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppBackground />
      <View style={styles.hero}>
        <Text style={styles.overline}>Reset</Text>
        <Text style={styles.title}>Recover your account</Text>
        <Text style={styles.subtitle}>Use the code and token from your email.</Text>
      </View>

      <GlassPanel style={styles.panel} glassEffectStyle="regular" isInteractive>
        <View style={styles.fieldGroup}>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <Field label="Code" value={code} onChangeText={setCode} keyboardType="number-pad" />
          <Field label="Token" value={token} onChangeText={setToken} autoCapitalize="none" />
          <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry />
        </View>
        <PrimaryButton title="Reset password" onPress={handleComplete} loading={isSubmitting} />
        <View style={styles.footerRow}>
          <TextButton title="Send reset email" tone="muted" onPress={handleRequest} />
        </View>
      </GlassPanel>
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    hero: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxl,
      gap: spacing.xs,
    },
    overline: {
      color: theme.palette.textSubtle,
      ...font('displayMedium'),
      letterSpacing: 3,
      textTransform: 'uppercase',
      fontSize: 12,
    },
    title: {
      color: theme.palette.text,
      fontSize: 30,
      ...font('display'),
    },
    subtitle: {
      color: theme.palette.textMuted,
      fontSize: 14,
      ...font('regular'),
    },
    panel: {
      marginTop: spacing.xl,
      marginHorizontal: spacing.lg,
    },
    fieldGroup: {
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    footerRow: {
      alignItems: 'center',
      marginTop: spacing.md,
    },
  });
