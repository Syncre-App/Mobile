import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { AppBackground } from '../../components/AppBackground';
import { GlassPanel } from '../../components/GlassPanel';
import { font, spacing, useTheme } from '../../theme/designSystem';
import { ApiService } from '../../services/ApiService';
import { StorageService } from '../../services/StorageService';

export default function WrapScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const date = params.date || '';
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const token = await StorageService.getAuthToken();
      if (!token) return;
      const response = await ApiService.getDailyWrap(date, token);
      if (response.success) {
        setData(response.data);
      }
    };
    load();
  }, [date]);

  return (
    <Screen>
      <AppBackground />
      <View style={styles.header}>
        <Text style={styles.title}>Daily Wrap</Text>
        <Text style={styles.subtitle}>{date}</Text>
      </View>
      <GlassPanel style={styles.panel} glassEffectStyle="regular">
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionTitle}>Highlights</Text>
          <Text style={styles.body}>{data ? JSON.stringify(data, null, 2) : 'Loading...'}</Text>
          <Text style={styles.link} onPress={() => router.replace('/home')}>
            Back to home
          </Text>
        </ScrollView>
      </GlassPanel>
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      gap: spacing.xs,
    },
    title: {
      color: theme.palette.text,
      fontSize: 24,
      ...font('semibold'),
    },
    subtitle: {
      color: theme.palette.textMuted,
      fontSize: 14,
    },
    panel: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      flex: 1,
    },
    scroll: {
      paddingBottom: spacing.lg,
    },
    sectionTitle: {
      color: theme.palette.textSubtle,
      fontSize: 12,
      letterSpacing: 2,
      textTransform: 'uppercase',
      ...font('displayMedium'),
      marginBottom: spacing.sm,
    },
    body: {
      color: theme.palette.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    link: {
      color: theme.palette.accent,
      fontSize: 14,
      marginTop: spacing.md,
    },
  });
