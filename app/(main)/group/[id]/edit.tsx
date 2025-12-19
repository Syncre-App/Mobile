import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../../../components/Screen';
import { AppBackground } from '../../../../components/AppBackground';
import { GlassPanel } from '../../../../components/GlassPanel';
import { Avatar } from '../../../../components/Avatar';
import { PrimaryButton } from '../../../../components/PrimaryButton';
import { font, spacing, useTheme } from '../../../../theme/designSystem';
import { ApiService } from '../../../../services/ApiService';
import { StorageService } from '../../../../services/StorageService';
import { ChatService } from '../../../../services/ChatService';
import { NotificationService } from '../../../../services/NotificationService';
import { useAuth } from '../../../../hooks/useAuth';

type Member = {
  id: string;
  username?: string;
  profile_picture?: string | null;
};

export default function GroupEditScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const chatId = params.id?.toString?.() ?? '';
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [friends, setFriends] = useState<Member[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadChat = async () => {
    const token = await StorageService.getAuthToken();
    if (!token || !chatId) return;
    const response = await ApiService.get(`/chat/${chatId}`, token);
    if (response.success && response.data?.chat) {
      setName(response.data.chat.name || response.data.chat.displayName || '');
      setMembers(response.data.chat.participants || []);
    }
  };

  const loadFriends = async () => {
    const token = await StorageService.getAuthToken();
    if (!token) return;
    const response = await ApiService.get('/user/friends', token);
    if (response.success) {
      setFriends(response.data?.friends || []);
    }
  };

  useEffect(() => {
    loadChat();
    loadFriends();
  }, []);

  const handleRename = async () => {
    setIsSubmitting(true);
    try {
      const response = await ChatService.updateGroupName(chatId, name.trim());
      if (!response.success) {
        NotificationService.show('error', response.error || 'Failed to rename.');
        return;
      }
      NotificationService.show('success', 'Group updated.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMembers = async (id: string) => {
    const response = await ChatService.addMembers(chatId, [id]);
    if (response.success) {
      NotificationService.show('success', 'Member added.');
      await loadChat();
    } else {
      NotificationService.show('error', response.error || 'Failed to add member.');
    }
  };

  const handleRemoveMember = async (id: string) => {
    const response = await ChatService.removeMember(chatId, id);
    if (response.success) {
      NotificationService.show('success', 'Member removed.');
      await loadChat();
      if (id === user?.id?.toString?.()) {
        router.replace('/home');
      }
    } else {
      NotificationService.show('error', response.error || 'Failed to remove member.');
    }
  };

  return (
    <Screen>
      <AppBackground />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navButton}>
          <Ionicons name="chevron-back" size={20} color={theme.palette.text} />
        </Pressable>
        <Text style={styles.title}>Edit group</Text>
        <View style={styles.navButton} />
      </View>

      <GlassPanel style={styles.panel} glassEffectStyle="regular" isInteractive>
        <Text style={styles.sectionTitle}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Group name"
          placeholderTextColor={theme.palette.textSubtle}
        />
        <PrimaryButton title="Save name" onPress={handleRename} loading={isSubmitting} />

        <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Members</Text>
        {members.map((member) => (
          <View key={member.id} style={styles.row}>
            <Avatar uri={member.profile_picture} name={member.username} size={36} />
            <Text style={styles.rowText}>{member.username || 'User'}</Text>
            <Pressable onPress={() => handleRemoveMember(member.id)} style={styles.iconButton}>
              <Ionicons name="remove-circle" size={18} color={theme.palette.error} />
            </Pressable>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Add friends</Text>
        {friends
          .filter((friend) => !members.some((member) => member.id === friend.id))
          .map((friend) => (
            <View key={friend.id} style={styles.row}>
              <Avatar uri={friend.profile_picture} name={friend.username} size={34} />
              <Text style={styles.rowText}>{friend.username || 'User'}</Text>
              <Pressable onPress={() => handleAddMembers(friend.id)} style={styles.iconButton}>
                <Ionicons name="add-circle" size={18} color={theme.palette.accent} />
              </Pressable>
            </View>
          ))}
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
    iconButton: {
      padding: spacing.xs,
    },
  });
