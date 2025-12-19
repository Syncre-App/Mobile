import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppBackground } from '../../components/AppBackground';
import { Field } from '../../components/Field';
import { GlassPanel } from '../../components/GlassPanel';
import { PrimaryButton } from '../../components/PrimaryButton';
import { TextButton } from '../../components/TextButton';
import { font, spacing, useTheme } from '../../theme/designSystem';
import { ApiService } from '../../services/ApiService';
import { StorageService } from '../../services/StorageService';
import { IdentityService } from '../../services/IdentityService';
import { CryptoService } from '../../services/CryptoService';
import { NotificationService } from '../../services/NotificationService';
import { Screen } from '../../components/Screen';

export default function LoginScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      NotificationService.show('error', 'Please enter email and password.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await ApiService.post('/auth/login', {
        email: email.trim(),
        password,
      });
      if (!response.success || !response.data) {
        NotificationService.show('error', response.error || 'Login failed.');
        return;
      }

      const token =
        response.data?.token || response.data?.accessToken || response.data?.authToken || response.data?.jwt;
      const user = response.data?.user || response.data?.profile || response.data?.user_data || response.data;
      if (!token) {
        NotificationService.show('error', 'Missing auth token.');
        return;
      }
      await StorageService.setAuthToken(token);
      if (user) {
        await StorageService.setObject('user_data', user);
      }

      if (user?.requires_terms_acceptance || !user?.terms_accepted_at) {
        router.replace('/terms');
        return;
      }

      const [needsSetup, localIdentity] = await Promise.all([
        IdentityService.requiresBootstrap(token),
        CryptoService.getStoredIdentity(),
      ]);

      if (needsSetup) {
        router.replace('/identity?mode=setup');
        return;
      }

      if (!localIdentity) {
        router.replace('/identity?mode=unlock');
        return;
      }

      NotificationService.show('success', `Welcome back ${user?.username || ''}`.trim());
      router.replace('/home');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppBackground />
      <View style={styles.hero}>
        <Text style={styles.overline}>Syncre</Text>
        <Text style={styles.title}>Liquid Glass Chat</Text>
        <Text style={styles.subtitle}>Secure messages with native iOS glass.</Text>
      </View>

      <GlassPanel style={styles.panel} glassEffectStyle="regular" isInteractive>
        <Text style={styles.panelTitle}>Sign in</Text>
        <View style={styles.fieldGroup}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            leading={<Ionicons name="mail" size={18} color={theme.palette.textSubtle} />}
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leading={<Ionicons name="lock-closed" size={18} color={theme.palette.textSubtle} />}
          />
        </View>

        <View style={styles.actionsRow}>
          <TextButton title="Forgot password?" tone="muted" onPress={() => router.push('/reset')} />
        </View>

        <PrimaryButton title="Continue" onPress={handleLogin} loading={isSubmitting} />
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>No account yet?</Text>
          <TextButton title="Create one" onPress={() => router.push('/register')} />
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
      fontSize: 32,
      ...font('display'),
    },
    subtitle: {
      color: theme.palette.textMuted,
      fontSize: 15,
      ...font('regular'),
    },
    panel: {
      marginTop: spacing.xl,
      marginHorizontal: spacing.lg,
    },
    panelTitle: {
      color: theme.palette.text,
      fontSize: 18,
      ...font('semibold'),
      marginBottom: spacing.sm,
    },
    fieldGroup: {
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    actionsRow: {
      alignItems: 'flex-end',
      marginBottom: spacing.md,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.md,
      gap: spacing.xs,
    },
    footerText: {
      color: theme.palette.textMuted,
      fontSize: 14,
    },
  });
