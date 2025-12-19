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
import { NotificationService } from '../../services/NotificationService';
import { Screen } from '../../components/Screen';

export default function RegisterScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password) {
      NotificationService.show('error', 'Please fill all fields.');
      return;
    }
    if (password !== confirm) {
      NotificationService.show('error', 'Passwords do not match.');
      return;
    }
    if (!acceptedTerms) {
      NotificationService.show('error', 'You must accept the terms.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await ApiService.post('/auth/register', {
        username: username.trim(),
        email: email.trim(),
        password,
        acceptedTerms: true,
        acceptTerms: true,
      });
      if (!response.success) {
        NotificationService.show('error', response.error || 'Registration failed.');
        return;
      }
      NotificationService.show('success', 'Verification code sent.');
      router.replace({ pathname: '/verify', params: { email: email.trim() } } as any);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppBackground />
      <View style={styles.hero}>
        <Text style={styles.overline}>Create account</Text>
        <Text style={styles.title}>Join Syncre</Text>
        <Text style={styles.subtitle}>Your private, glassy chat space.</Text>
      </View>

      <GlassPanel style={styles.panel} glassEffectStyle="regular" isInteractive>
        <Text style={styles.panelTitle}>Sign up</Text>
        <View style={styles.fieldGroup}>
          <Field
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            leading={<Ionicons name="person" size={18} color={theme.palette.textSubtle} />}
          />
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
          <Field
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            leading={<Ionicons name="shield-checkmark" size={18} color={theme.palette.textSubtle} />}
          />
        </View>
        <Pressable style={styles.termsRow} onPress={() => setAcceptedTerms((prev) => !prev)}>
          <Ionicons
            name={acceptedTerms ? 'checkbox' : 'square-outline'}
            size={18}
            color={acceptedTerms ? theme.palette.accent : theme.palette.textSubtle}
          />
          <Text style={styles.terms}>
            I agree to the Terms & Privacy.
          </Text>
        </Pressable>
        <PrimaryButton title="Create account" onPress={handleRegister} loading={isSubmitting} />
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TextButton title="Sign in" onPress={() => router.replace('/login')} />
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
    termsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    terms: {
      color: theme.palette.textMuted,
      fontSize: 12,
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
