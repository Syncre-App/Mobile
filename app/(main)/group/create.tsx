import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../../components/Screen';
import { AppBackground } from '../../../components/AppBackground';
import { GlassPanel } from '../../../components/GlassPanel';
import { Avatar } from '../../../components/Avatar';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { font, spacing, useTheme } from '../../../theme/designSystem';
import { ApiService } from '../../../services/ApiService';
import { StorageService } from '../../../services/StorageService';
import { ChatService } from '../../../services/ChatService';
import { NotificationService } from '../../../services/NotificationService';

type Friend = {
  id: string;
  username?: string;
  profile_picture?: string | null;
};

export default function GroupCreateScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [name, setName] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadFriends = async () => {
    const token = await StorageService.getAuthToken();
    if (!token) return;
    const response = await ApiService.get('/user/friends', token);
    if (response.success) {
      setFriends(response.data?.friends || []);
    }
  };

  useEffect(() => {
    loadFriends();
  }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (selected.size < 1) {
      NotificationService.show('error', 'Select at least one member.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await ChatService.createGroupChat({
        name: name.trim() || undefined,
        members: Array.from(selected),
      });
      if (!response.success || !response.data?.chat) {
        NotificationService.show('error', response.error || 'Failed to create group.');
        return;
      }
      NotificationService.show('success', 'Group created.');
      router.replace(`/chat/${response.data.chat.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppBackground />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navButton}>
          <Ionicons name="chevron-back" size={20} color={theme.palette.text} />
        </Pressable>
        <Text style={styles.title}>New group</Text>
        <View style={styles.navButton} />
      </View>

      <GlassPanel style={styles.panel} glassEffectStyle="regular" isInteractive>
        <Text style={styles.sectionTitle}>Group name</Text>
        <TextInput
          style={styles.input}
          placeholder="Optional name"
          placeholderTextColor={theme.palette.textSubtle}
          value={name}
          onChangeText={setName}
        />
        <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Members</Text>
        <View style={styles.list}>
          {friends.map((friend) => {
            const isSelected = selected.has(friend.id);
            return (
              <Pressable key={friend.id} onPress={() => toggleSelect(friend.id)} style={styles.row}>
                <Avatar uri={friend.profile_picture} name={friend.username} size={36} />
                <Text style={styles.rowText}>{friend.username || 'User'}</Text>
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={18} color={theme.palette.accent} />
                ) : (
                  <Ionicons name="ellipse-outline" size={18} color={theme.palette.textSubtle} />
                )}
              </Pressable>
            );
          })}
        </View>
        <PrimaryButton title="Create group" onPress={handleCreate} loading={isSubmitting} />
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
    input: {
      borderRadius: theme.radii.md,
      backgroundColor: theme.palette.surfaceSoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: theme.palette.text,
      fontSize: 14,
      ...font('regular'),
    },
    list: {
      gap: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    rowText: {
      flex: 1,
      color: theme.palette.text,
      fontSize: 14,
      ...font('medium'),
    },
  });
