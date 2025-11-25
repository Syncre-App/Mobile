import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { UserCacheService } from '../services/UserCacheService';
import { UserStatus } from '../services/WebSocketService';
import { palette, radii, spacing } from '../theme/designSystem';
import { UserAvatar } from './UserAvatar';

interface Chat {
  id: number;
  users: string; // JSON string of user IDs
  created_at: string;
  updated_at: string;
  isGroup?: boolean;
  name?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  ownerId?: string | null;
  participants?: User[];
  // Additional properties that might be populated
  lastMessage?: {
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
  };
  unreadCount?: number;
}

interface User {
  id: string;
  username: string;
  email: string;
  profile_picture?: string | null;
  [key: string]: any;
}

interface ChatListWidgetProps {
  chats: Chat[];
  isLoading: boolean;
  onRefresh: () => void;
  userStatuses: UserStatus;
  onRemoveFriend: (friendId: string) => void;
  removingFriendId?: string | null;
  unreadCounts?: Record<string, number>;
  onEditGroup?: (chat: Chat) => void;
  onDeleteGroup?: (chat: Chat) => void;
  onMarkRead?: (chatId: string) => void;
  onMarkUnread?: (chatId: string) => void;
}

export const ChatListWidget: React.FC<ChatListWidgetProps> = ({
  chats,
  isLoading,
  onRefresh,
  userStatuses,
  onRemoveFriend,
  removingFriendId = null,
  unreadCounts = {},
  onEditGroup = () => {},
  onDeleteGroup = () => {},
  onMarkRead = () => {},
  onMarkUnread = () => {},
}) => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userDetails, setUserDetails] = useState<{ [key: string]: User }>({});

  useEffect(() => {
    getCurrentUserId();
  }, []);

  useEffect(() => {
    if (chats.length > 0 && currentUserId) {
      fetchUserDetails();
    }
  }, [chats, currentUserId, fetchUserDetails]);

  const getCurrentUserId = async () => {
    try {
      const token = await StorageService.getAuthToken();
      if (token) {
        const response = await ApiService.get('/user/me', token);
        if (response.success && response.data) {
          setCurrentUserId(response.data.id);
        }
      }
    } catch (error) {
      console.log('❌ Error getting current user ID:', error);
    }
  };

  const fetchUserDetails = useCallback(async () => {
    try {
      const token = await StorageService.getAuthToken();
      if (!token) return;

      const userIds = new Set<string>();
      
      chats.forEach(chat => {
        try {
          const chatUserIds = JSON.parse(chat.users);
          chatUserIds.forEach((id: string) => {
            if (id !== currentUserId) {
              userIds.add(id);
            }
          });
        } catch (error) {
          console.log('Error parsing chat users:', error);
        }
      });

      const newUserDetails: { [key: string]: User } = { ...userDetails };
      
      for (const userId of userIds) {
        if (!newUserDetails[userId]) {
          try {
            const response = await ApiService.getUserById(userId, token);
            if (response.success && response.data) {
              newUserDetails[userId] = response.data;
              UserCacheService.addUser({
                ...response.data,
                id: response.data.id?.toString?.() ?? String(response.data.id),
              });
            }
          } catch (error) {
            console.log(`Error fetching user ${userId}:`, error);
            newUserDetails[userId] = {
              id: userId,
              username: 'Loading...',
              email: '',
            };
          }
        }
      }

      setUserDetails(newUserDetails);
    } catch (error) {
      console.log('❌ Error fetching user details:', error);
    }
  }, [chats, currentUserId, userDetails]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const getOtherUserId = (chat: Chat): string | null => {
    if (!currentUserId) return null;
    try {
      const userIds = JSON.parse(chat.users);
      const otherUserId = userIds.find((id: string) => id !== currentUserId);
      return otherUserId || null;
    } catch (error) {
      console.log('Error parsing chat users:', error);
      return null;
    }
  };

  const getChatDisplayName = (chat: Chat): string => {
    if (!currentUserId) return 'Loading...';
    
    const otherUserId = getOtherUserId(chat);
    if (!otherUserId) return 'Unknown User';

    const user = userDetails[otherUserId];
    if (user) {
      return user.username || user.email || 'Loading...';
    }

    return 'Loading...';
  };

  const getGroupDisplayName = (chat: Chat): string => {
    return chat.name || chat.displayName || 'Group chat';
  };

  const getGroupSubtitle = (chat: Chat): string => {
    if (!Array.isArray(chat.participants) || !chat.participants.length) {
      return '';
    }

    const names = chat.participants
      .filter((participant) => participant.id?.toString?.() !== currentUserId)
      .map((participant) => participant.username || participant.email || 'Member');

    const visible = names.slice(0, 3);
    let label = visible.join(', ');
    const remaining = names.length - visible.length;
    if (remaining > 0) {
      label = `${label} +${remaining}`;
    }
    return label;
  };

  const handleChatPress = (chat: Chat) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: chat.id?.toString?.() ?? String(chat.id) },
    } as any);
  };

  const handleChatLongPress = (chat: Chat) => {
    const chatIdKey = chat.id?.toString?.() ?? String(chat.id);
    const unread = unreadCounts[chatIdKey] || 0;
    const hasUnread = unread > 0;
    const commonActions = [
      hasUnread
        ? { text: 'Mark as read', onPress: () => onMarkRead(chatIdKey) }
        : { text: 'Mark as unread', onPress: () => onMarkUnread(chatIdKey) },
      { text: 'Cancel', style: 'cancel' as const },
    ];

    if (chat.isGroup) {
      const ownerId = chat.ownerId?.toString?.();
      if (!ownerId || ownerId !== currentUserId) {
        Alert.alert(getGroupDisplayName(chat), undefined, commonActions);
        return;
      }
      Alert.alert(
        'Group Options',
        getGroupDisplayName(chat),
        [
          ...commonActions,
          { text: 'Edit group', onPress: () => onEditGroup(chat) },
          {
            text: 'Delete group',
            style: 'destructive',
            onPress: () => onDeleteGroup(chat),
          },
        ],
      );
      return;
    }

    const otherUserId = getOtherUserId(chat);
    if (!otherUserId) return;

    const displayName = getChatDisplayName(chat);

    Alert.alert(
      'Chat Options',
      displayName,
      [
        ...commonActions,
        {
          text: 'Remove Friend',
          style: 'destructive',
          onPress: () => onRemoveFriend(otherUserId),
        },
      ],
    );
  };

  const renderChatItem = ({ item: chat }: { item: Chat }) => {
    const isGroupChat = Boolean(chat.isGroup);
    const displayName = isGroupChat ? getGroupDisplayName(chat) : getChatDisplayName(chat);
    const otherUserId = isGroupChat ? null : getOtherUserId(chat);
    const cachedUser = otherUserId ? userDetails[otherUserId] : null;
    const statusValueRaw =
      otherUserId && userStatuses[otherUserId]
        ? userStatuses[otherUserId]
        : cachedUser?.status;
    const normalizedStatus = statusValueRaw
      ? String(statusValueRaw).toLowerCase()
      : 'offline';
    const isUserOnline = !isGroupChat && normalizedStatus === 'online';
    const isRemoving = !isGroupChat && removingFriendId === otherUserId;
    const chatIdKey = chat.id?.toString?.() ?? String(chat.id);
    const unread = unreadCounts[chatIdKey] || 0;
    const hasUnread = unread > 0;
    const avatarUri = isGroupChat
      ? chat.avatarUrl || undefined
      : otherUserId
        ? userDetails[otherUserId]?.profile_picture
        : undefined;
    const groupSubtitle = isGroupChat ? getGroupSubtitle(chat) : null;
    const presenceValue = isGroupChat ? undefined : (isUserOnline ? 'online' : 'offline');

    return (
      <TouchableOpacity
        onPress={() => !isRemoving && handleChatPress(chat)}
        onLongPress={() => !isRemoving && handleChatLongPress(chat)}
        style={styles.chatItem}
        activeOpacity={0.75}
        disabled={isRemoving}
      >
        <View style={[styles.chatCard, hasUnread && styles.chatCardUnread]}>
          <UserAvatar
            uri={avatarUri}
            name={displayName}
            size={56}
            presence={presenceValue}
            presencePlacement="overlay"
            style={styles.avatarContainer}
          />

          <View style={styles.chatContent}>
            <View style={styles.chatTitleRow}>
              <Text style={styles.chatName} numberOfLines={1}>
                {displayName}
              </Text>
              {hasUnread && (
                <View style={styles.chatUnreadPill}>
                  <Text style={styles.chatUnreadText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              )}
            </View>
            {groupSubtitle ? (
              <Text style={styles.chatSubtitle} numberOfLines={1}>
                {groupSubtitle}
              </Text>
            ) : null}
          </View>

          <View style={styles.rightColumn}>
            {isRemoving ? (
              <ActivityIndicator size="small" color={palette.error} />
            ) : (
              <Ionicons name="chevron-forward" size={16} color="rgba(255, 255, 255, 0.4)" />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color="rgba(255, 255, 255, 0.3)" />
      <Text style={styles.emptyStateTitle}>No chats yet</Text>
      <Text style={styles.emptyStateMessage}>
        Start by adding friends and begin conversations!
      </Text>
    </View>
  );

  if (isLoading && chats.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        {[0, 1, 2, 3].map((key) => (
          <View key={key} style={styles.skeletonCard}>
            <View style={styles.skeletonAvatar} />
            <View style={styles.skeletonBody}>
              <View style={styles.skeletonLineWide} />
              <View style={styles.skeletonLineNarrow} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={chats}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderChatItem}
      ListEmptyComponent={renderEmptyState}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={palette.accent}
          colors={[palette.accent]}
        />
      }
      contentContainerStyle={styles.listContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    />
  );
};

const styles = StyleSheet.create({
  listContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  chatItem: {
    marginBottom: spacing.sm,
  },
  chatCard: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#010103',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  chatCardUnread: {
    borderColor: 'rgba(37, 99, 235, 0.35)',
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
  },
  avatarContainer: {
    marginRight: spacing.md,
  },
  chatContent: {
    flex: 1,
  },
  chatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chatName: {
    color: palette.text,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-SemiBold',
    marginBottom: 2,
  },
  chatSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
  },
  chatUnreadPill: {
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
  },
  chatUnreadText: {
    color: palette.text,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  rightColumn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyStateTitle: {
    color: palette.text,
    fontSize: 20,
    fontFamily: 'PlusJakartaSans-SemiBold',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyStateMessage: {
    color: palette.textMuted,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'stretch',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: 16,
    marginTop: spacing.sm,
  },
  skeletonCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  skeletonAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginRight: spacing.md,
  },
  skeletonBody: {
    flex: 1,
    gap: spacing.xs,
  },
  skeletonLineWide: {
    height: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    width: '72%',
  },
  skeletonLineNarrow: {
    height: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    width: '50%',
  },
});
