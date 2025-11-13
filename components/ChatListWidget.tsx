import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { UserCacheService } from '../services/UserCacheService';
import { UserStatus } from '../services/WebSocketService';
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

  const fetchUserDetails = async () => {
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
  };

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
    if (chat.isGroup) {
      const ownerId = chat.ownerId?.toString?.();
      if (!ownerId || ownerId !== currentUserId) {
        return;
      }
      Alert.alert(
        'Group Options',
        getGroupDisplayName(chat),
        [
          { text: 'Cancel', style: 'cancel' },
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
      `Do you want to remove ${displayName} from your friends?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
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

    return (
      <TouchableOpacity 
        onPress={() => !isRemoving && handleChatPress(chat)} 
        onLongPress={() => !isRemoving && handleChatLongPress(chat)}
        style={styles.chatItem}
        activeOpacity={0.6}
        disabled={isRemoving}
      >
        <View style={[styles.chatCard, hasUnread && styles.chatCardUnread]}>
          <UserAvatar
            uri={avatarUri}
            name={displayName}
            size={56}
            presence={!isGroupChat && isUserOnline ? 'online' : undefined}
            presencePlacement="overlay"
            style={styles.avatarContainer}
          />

          <View style={styles.chatContent}>
            <View style={styles.chatTitleRow}>
              <Text style={styles.chatName} numberOfLines={1}>{displayName}</Text>
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
              <ActivityIndicator size="small" color="#FF6B6B" />
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
        <ActivityIndicator size="large" color="#2C82FF" />
  <Text style={styles.loadingText}>Loading chats...</Text>
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
          tintColor="#2C82FF"
          colors={['#2C82FF']}
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
  },
  chatItem: {
    marginBottom: 0,
  },
  chatCard: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  chatCardUnread: {
    backgroundColor: 'rgba(30, 132, 255, 0.08)',
  },
  avatarContainer: {
    marginRight: 16,
  },
  chatContent: {
    flex: 1,
  },
  chatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  chatSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  chatUnreadPill: {
    backgroundColor: '#1E84FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  chatUnreadText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  rightColumn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  emptyStateMessage: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    marginTop: 16,
  },
});
