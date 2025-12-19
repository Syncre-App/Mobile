import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppBackground } from '../components/AppBackground';
import { GlassPanel } from '../components/GlassPanel';
import { PrimaryButton } from '../components/PrimaryButton';
import { font, spacing, useTheme } from '../theme/designSystem';
import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { NotificationService } from '../services/NotificationService';
import { Screen } from '../components/Screen';

export default function TermsScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      const response = await ApiService.post('/user/accept-terms', {}, token);
      if (!response.success) {
        NotificationService.show('error', response.error || 'Failed to accept terms.');
        return;
      }
      const me = await ApiService.get('/user/me', token);
      if (me.success && me.data) {
        await StorageService.setObject('user_data', me.data);
      }
      NotificationService.show('success', 'Terms accepted.');
      router.replace('/home');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppBackground />
      <View style={styles.hero}>
        <Text style={styles.overline}>Terms</Text>
        <Text style={styles.title}>Before you continue</Text>
        <Text style={styles.subtitle}>Please accept the terms to continue using Syncre.</Text>
      </View>

      <GlassPanel style={styles.panel} glassEffectStyle="regular">
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.body}>
            Syncre is a secure messaging platform. By continuing, you agree to follow the community
            guidelines, respect privacy, and use the service responsibly. Full terms are available
            on our website.
          </Text>
        </ScrollView>
        <PrimaryButton title="Accept terms" onPress={handleAccept} loading={isSubmitting} />
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
      flex: 1,
    },
    scroll: {
      paddingBottom: spacing.lg,
    },
    body: {
      color: theme.palette.textMuted,
      fontSize: 14,
      lineHeight: 22,
      marginBottom: spacing.lg,
    },
  });
