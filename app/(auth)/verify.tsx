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

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [email, setEmail] = useState(params.email || '');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVerify = async () => {
    if (!email.trim() || !code.trim()) {
      NotificationService.show('error', 'Email and code are required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await ApiService.post('/auth/verify', { email: email.trim(), code: code.trim() });
      if (!response.success) {
        NotificationService.show('error', response.error || 'Verification failed.');
        return;
      }
      NotificationService.show('success', 'Email verified. Please sign in.');
      router.replace('/login');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppBackground />
      <View style={styles.hero}>
        <Text style={styles.overline}>Verification</Text>
        <Text style={styles.title}>Confirm your email</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code sent to you.</Text>
      </View>

      <GlassPanel style={styles.panel} glassEffectStyle="regular" isInteractive>
        <View style={styles.fieldGroup}>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <Field label="Code" value={code} onChangeText={setCode} keyboardType="number-pad" />
        </View>
        <PrimaryButton title="Verify" onPress={handleVerify} loading={isSubmitting} />
        <View style={styles.footerRow}>
          <TextButton title="Back to login" tone="muted" onPress={() => router.replace('/login')} />
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
