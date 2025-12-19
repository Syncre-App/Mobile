import { Link } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppBackground } from '../components/AppBackground';
import { GlassPanel } from '../components/GlassPanel';
import { font, spacing, useTheme } from '../theme/designSystem';
import { Screen } from '../components/Screen';

export default function NotFound() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Screen>
      <AppBackground />
      <View style={styles.center}>
        <GlassPanel style={styles.panel} glassEffectStyle="regular">
          <Text style={styles.title}>Page not found</Text>
          <Text style={styles.subtitle}>This route does not exist.</Text>
          <Link href="/home" style={styles.link}>
            Back to home
          </Link>
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
      gap: spacing.sm,
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
    link: {
      color: theme.palette.accent,
      fontSize: 14,
    },
  });
