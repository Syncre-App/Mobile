import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppBackground } from '../components/AppBackground';
import { GlassPanel } from '../components/GlassPanel';
import { font, spacing, useTheme } from '../theme/designSystem';
import { Screen } from '../components/Screen';

export default function MaintenanceScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Screen>
      <AppBackground />
      <View style={styles.center}>
        <GlassPanel style={styles.panel} glassEffectStyle="regular">
          <Text style={styles.title}>We will be right back</Text>
          <Text style={styles.subtitle}>
            The service is in maintenance mode. Please check again soon.
          </Text>
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
    },
    title: {
      color: theme.palette.text,
      fontSize: 20,
      ...font('semibold'),
      marginBottom: spacing.xs,
    },
    subtitle: {
      color: theme.palette.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
