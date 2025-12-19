import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../../components/Screen';
import { AppBackground } from '../../../components/AppBackground';
import { GlassPanel } from '../../../components/GlassPanel';
import { Avatar } from '../../../components/Avatar';
import { font, spacing, useTheme } from '../../../theme/designSystem';
import { ApiService } from '../../../services/ApiService';
import { StorageService } from '../../../services/StorageService';
import { NotificationService } from '../../../services/NotificationService';

type BlockedUser = {
  id: string;
  username?: string;
  profile_picture?: string | null;
};

export default function BlockedUsersScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);

  const loadBlocked = async () => {
    const token = await StorageService.getAuthToken();
    if (!token) return;
    const response = await ApiService.get('/user/blocked', token);
    if (response.success && Array.isArray(response.data?.blocked)) {
      setBlocked(response.data.blocked);
    }
  };

  const handleUnblock = async (id: string) => {
    const token = await StorageService.getAuthToken();
    if (!token) return;
    const response = await ApiService.post('/user/unblock', { targetUserId: id }, token);
    if (response.success) {
      NotificationService.show('success', 'User unblocked.');
      await loadBlocked();
    } else {
      NotificationService.show('error', response.error || 'Failed to unblock.');
    }
  };

  useEffect(() => {
    loadBlocked();
  }, []);

  return (
    <Screen>
      <AppBackground />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navButton}>
          <Ionicons name="chevron-back" size={20} color={theme.palette.text} />
        </Pressable>
        <Text style={styles.title}>Blocked Users</Text>
        <View style={styles.navButton} />
      </View>

      <GlassPanel style={styles.panel} glassEffectStyle="regular" isInteractive>
        {blocked.length ? (
          blocked.map((user) => (
            <View key={user.id} style={styles.row}>
              <Avatar uri={user.profile_picture} name={user.username} size={40} />
              <View style={styles.info}>
                <Text style={styles.name}>{user.username || 'User'}</Text>
                <Text style={styles.subtitle}>@{user.id}</Text>
              </View>
              <Pressable onPress={() => handleUnblock(user.id)} style={styles.unblock}>
                <Text style={styles.unblockText}>Unblock</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>No blocked users.</Text>
        )}
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider,
    },
    info: {
      flex: 1,
    },
    name: {
      color: theme.palette.text,
      fontSize: 15,
      ...font('semibold'),
    },
    subtitle: {
      color: theme.palette.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    unblock: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.palette.surfaceSoft,
    },
    unblockText: {
      color: theme.palette.text,
      fontSize: 12,
      ...font('semibold'),
    },
    empty: {
      color: theme.palette.textMuted,
      fontSize: 14,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
  });
