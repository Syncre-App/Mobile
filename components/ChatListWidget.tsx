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
  // Additional properties that might be populated
  participants?: User[];
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
}

export const ChatListWidget: React.FC<ChatListWidgetProps> = ({
  chats,
  isLoading,
  onRefresh,
  userStatuses,
  onRemoveFriend,
  removingFriendId = null,
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
  }, [chats, currentUserId]);

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

  const handleChatPress = (chat: Chat) => {
    router.push('/chat/[id]' as any, { id: chat.id } as any);
  };

  const handleChatLongPress = (chat: Chat) => {
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
    const displayName = getChatDisplayName(chat);
    const otherUserId = getOtherUserId(chat);
    const statusValue = otherUserId ? userStatuses[otherUserId] : undefined;
    const isUserOnline = statusValue === 'online';
    const statusLabel = statusValue
      ? statusValue.charAt(0).toUpperCase() + statusValue.slice(1)
      : 'Offline';
    const isRemoving = removingFriendId === otherUserId;

    return (
      <TouchableOpacity 
        onPress={() => !isRemoving && handleChatPress(chat)} 
        onLongPress={() => !isRemoving && handleChatLongPress(chat)}
        style={styles.chatItem}
        activeOpacity={0.6}
        disabled={isRemoving}
      >
        <View style={styles.chatCard}>
          <UserAvatar
            uri={otherUserId ? userDetails[otherUserId]?.profile_picture : undefined}
            name={displayName}
            size={56}
            presence={isUserOnline ? 'online' : 'offline'}
            style={styles.avatarContainer}
          />

          <View style={styles.chatContent}>
            <Text style={styles.chatName} numberOfLines={1}>{displayName}</Text>
            <Text
              style={[
                styles.chatStatus,
                isUserOnline ? styles.chatStatusOnline : styles.chatStatusOffline,
              ]}
            >
              {statusLabel}
            </Text>
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
  avatarContainer: {
    marginRight: 16,
  },
  chatContent: {
    flex: 1,
  },
  chatName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  chatStatus: {
    fontSize: 13,
    fontWeight: '500',
  },
  chatStatusOnline: {
    color: '#4CAF50',
  },
  chatStatusOffline: {
    color: 'rgba(255, 255, 255, 0.5)',
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
