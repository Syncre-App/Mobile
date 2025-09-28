import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { UserStatus } from '../services/WebSocketService';

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
  [key: string]: any;
}

interface ChatListWidgetProps {
  chats: Chat[];
  isLoading: boolean;
  onRefresh: () => void;
  userStatuses: UserStatus;
}

export const ChatListWidget: React.FC<ChatListWidgetProps> = ({
  chats,
  isLoading,
  onRefresh,
  userStatuses,
}) => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getCurrentUserId();
  }, []);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const getChatDisplayName = (chat: Chat): string => {
    if (!currentUserId) return 'Loading...';
    
    // Parse the users JSON string to get user IDs
    try {
      const userIds = JSON.parse(chat.users);
      const otherUserId = userIds.find((id: string) => id !== currentUserId);
      
      // For now, return the user ID. In a real app, you'd fetch user details
      return `User ${otherUserId || 'Unknown'}`;
    } catch (error) {
      return 'Unknown User';
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const handleChatPress = (chat: Chat) => {
    router.push('/chat/[id]' as any, { id: chat.id } as any);
  };

  const renderChatItem = ({ item: chat }: { item: Chat }) => {
    const displayName = getChatDisplayName(chat);

    return (
      <TouchableOpacity 
        onPress={() => handleChatPress(chat)} 
        style={styles.chatItem}
        activeOpacity={0.6}
      >
        <View style={styles.chatCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.initialsCircle}>
              <Text style={styles.initialsText}>{getInitials(displayName)}</Text>
            </View>
          </View>

          <View style={styles.chatContent}>
            <Text style={styles.chatName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.noMessages}>No messages yet</Text>
          </View>

          <View style={styles.rightColumn}>
            <Ionicons name="chevron-forward" size={16} color="rgba(255, 255, 255, 0.4)" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color="rgba(255, 255, 255, 0.3)" />
  <Text style={styles.emptyStateTitle}>Még nincs üzenet</Text>
      <Text style={styles.emptyStateMessage}>
        Start by adding friends and begin conversations!
      </Text>
    </View>
  );

  if (isLoading && chats.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2C82FF" />
  <Text style={styles.loadingText}>Üzenetek betöltése...</Text>
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
    width: 48,
    height: 48,
    marginRight: 16,
  },
  initialsCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
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
  noMessages: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
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
