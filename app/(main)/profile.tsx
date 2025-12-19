import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { AppBackground } from '../../components/AppBackground';
import { GlassPanel } from '../../components/GlassPanel';
import { Avatar } from '../../components/Avatar';
import { font, spacing, useTheme } from '../../theme/designSystem';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { user, signOut } = useAuth();

  return (
    <Screen>
      <AppBackground />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navButton}>
          <Ionicons name="chevron-back" size={20} color={theme.palette.text} />
        </Pressable>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.navButton} />
      </View>

      <GlassPanel style={styles.panel} glassEffectStyle="regular" isInteractive>
        <View style={styles.profileRow}>
          <Avatar uri={user?.profile_picture} name={user?.username} size={72} />
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{user?.username || 'User'}</Text>
            <Text style={styles.email}>{user?.email || ''}</Text>
            <Text style={styles.meta}>ID: {user?.id}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={() => router.push('/settings/edit-profile')} style={styles.actionRow}>
            <Text style={styles.actionText}>Edit profile</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.palette.textSubtle} />
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} style={styles.actionRow}>
            <Text style={styles.actionText}>Settings</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.palette.textSubtle} />
          </Pressable>
          <Pressable
            onPress={async () => {
              await signOut();
              router.replace('/login');
            }}
            style={styles.actionRow}
          >
            <Text style={[styles.actionText, { color: theme.palette.error }]}>Sign out</Text>
            <Ionicons name="log-out-outline" size={16} color={theme.palette.error} />
          </Pressable>
        </View>
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
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    profileInfo: {
      flex: 1,
    },
    name: {
      color: theme.palette.text,
      fontSize: 20,
      ...font('semibold'),
    },
    email: {
      color: theme.palette.textMuted,
      fontSize: 14,
      marginTop: 4,
    },
    meta: {
      color: theme.palette.textSubtle,
      fontSize: 12,
      marginTop: 4,
    },
    actions: {
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.palette.divider,
    },
    actionText: {
      color: theme.palette.text,
      fontSize: 15,
      ...font('medium'),
    },
  });
