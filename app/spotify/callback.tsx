import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { AppBackground } from '../../components/AppBackground';
import { GlassPanel } from '../../components/GlassPanel';
import { PrimaryButton } from '../../components/PrimaryButton';
import { font, spacing, useTheme } from '../../theme/designSystem';

export default function SpotifyCallbackScreen() {
  const params = useLocalSearchParams<{ success?: string; error?: string }>();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const success = params.success === 'true';

  return (
    <Screen>
      <AppBackground />
      <View style={styles.center}>
        <GlassPanel style={styles.panel} glassEffectStyle="regular">
          <Text style={styles.title}>{success ? 'Spotify connected' : 'Spotify connection failed'}</Text>
          <Text style={styles.subtitle}>
            {success ? 'You can now share your listening status.' : params.error || 'Please try again.'}
          </Text>
          <PrimaryButton title="Back to settings" onPress={() => router.replace('/settings')} />
        </GlassPanel>
      </View>
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    center: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    panel: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    title: {
      color: theme.palette.text,
      fontSize: 20,
      ...font('semibold'),
    },
    subtitle: {
      color: theme.palette.textMuted,
      fontSize: 14,
    },
  });
