import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '../../../components/Screen';
import { AppBackground } from '../../../components/AppBackground';
import { GlassPanel } from '../../../components/GlassPanel';
import { font, spacing, useTheme } from '../../../theme/designSystem';
import { StorageService } from '../../../services/StorageService';

export default function SettingsScreen() {
  const { theme, mode, setMode } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [readReceipts, setReadReceipts] = useState(true);
  const [typingIndicator, setTypingIndicator] = useState(true);
  const [lastSeen, setLastSeen] = useState(true);

  useEffect(() => {
    const load = async () => {
      setReadReceipts(await StorageService.getReadReceipts());
      setTypingIndicator(await StorageService.getTypingIndicator());
      setLastSeen(await StorageService.getLastSeen());
    };
    load();
  }, []);

  const updateReadReceipts = async (value: boolean) => {
    setReadReceipts(value);
    await StorageService.setReadReceipts(value);
  };

  const updateTyping = async (value: boolean) => {
    setTypingIndicator(value);
    await StorageService.setTypingIndicator(value);
  };

  const updateLastSeen = async (value: boolean) => {
    setLastSeen(value);
    await StorageService.setLastSeen(value);
  };

  return (
    <Screen>
      <AppBackground />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navButton}>
          <Ionicons name="chevron-back" size={20} color={theme.palette.text} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.navButton} />
      </View>

      <GlassPanel style={styles.panel} glassEffectStyle="regular" isInteractive>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.themeToggle}>
          {(['system', 'light', 'dark'] as const).map((value) => {
            const active = mode === value;
            return (
              <Pressable
                key={value}
                onPress={() => setMode(value)}
                style={[styles.themeOption, active && styles.themeOptionActive]}
              >
                <Text style={[styles.themeOptionText, active && styles.themeOptionTextActive]}>
                  {value === 'system' ? 'Auto' : value === 'light' ? 'Light' : 'Dark'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Privacy</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>Read receipts</Text>
          <Switch
            value={readReceipts}
            onValueChange={updateReadReceipts}
            trackColor={{ false: theme.palette.divider, true: theme.palette.accent }}
            thumbColor={theme.palette.text}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>Typing indicators</Text>
          <Switch
            value={typingIndicator}
            onValueChange={updateTyping}
            trackColor={{ false: theme.palette.divider, true: theme.palette.accent }}
            thumbColor={theme.palette.text}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>Last seen</Text>
          <Switch
            value={lastSeen}
            onValueChange={updateLastSeen}
            trackColor={{ false: theme.palette.divider, true: theme.palette.accent }}
            thumbColor={theme.palette.text}
          />
        </View>

        <Pressable style={styles.linkRow} onPress={() => router.push('/settings/edit-profile')}>
          <Text style={styles.linkText}>Edit profile</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.palette.textSubtle} />
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => router.push('/settings/privacy')}>
          <Text style={styles.linkText}>Privacy settings</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.palette.textSubtle} />
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => router.push('/settings/blocked-users')}>
          <Text style={styles.linkText}>Blocked users</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.palette.textSubtle} />
        </Pressable>
      </GlassPanel>
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    navButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceSoft,
    },
    title: {
      flex: 1,
      color: theme.palette.text,
      fontSize: 18,
      ...font('semibold'),
    },
    panel: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      gap: spacing.md,
    },
    sectionTitle: {
      color: theme.palette.textSubtle,
      fontSize: 12,
      letterSpacing: 2,
      textTransform: 'uppercase',
      ...font('displayMedium'),
    },
    themeToggle: {
      flexDirection: 'row',
      backgroundColor: theme.palette.surfaceSoft,
      borderRadius: theme.radii.pill,
      padding: 4,
      gap: 4,
    },
    themeOption: {
      flex: 1,
      paddingVertical: spacing.xs,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
    },
    themeOptionActive: {
      backgroundColor: theme.palette.surfaceStrong,
    },
    themeOptionText: {
      color: theme.palette.textMuted,
      fontSize: 12,
      ...font('semibold'),
    },
    themeOptionTextActive: {
      color: theme.palette.text,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider,
    },
    toggleText: {
      color: theme.palette.text,
      fontSize: 15,
      ...font('medium'),
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    linkText: {
      color: theme.palette.text,
      fontSize: 15,
      ...font('medium'),
    },
  });
