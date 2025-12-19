import React, { useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { AppBackground } from '../components/AppBackground';
import { GlassPanel } from '../components/GlassPanel';
import { PrimaryButton } from '../components/PrimaryButton';
import { font, spacing, useTheme } from '../theme/designSystem';
import { UpdateService } from '../services/UpdateService';
import { Screen } from '../components/Screen';

export default function UpdateScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const release = UpdateService.consumePendingUpdate();

  return (
    <Screen>
      <AppBackground />
      <View style={styles.center}>
        <GlassPanel style={styles.panel} glassEffectStyle="regular">
          <Text style={styles.title}>Update required</Text>
          <Text style={styles.subtitle}>
            A new version of Syncre is required to continue. Please update from the store.
          </Text>
          {release?.version ? <Text style={styles.version}>Latest: {release.version}</Text> : null}
          <PrimaryButton
            title="Open update link"
            onPress={() => {
              const link = release?.url || 'https://github.com/Syncre-App/Mobile/releases/latest';
              Linking.openURL(link);
            }}
          />
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
      lineHeight: 20,
    },
    version: {
      color: theme.palette.textSubtle,
      fontSize: 12,
    },
  });
