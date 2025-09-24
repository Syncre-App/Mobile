import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { UserStatus } from '../services/WebSocketService';
import { GlassCard } from './GlassCard';

interface Chat {
  id: string;
  participants: User[];
  lastMessage?: {
    id: string;
    content: string;
    createdAt: string;
    user: User;
  };
  [key: string]: any;
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
    
    // Find the other participant (not current user)
    const otherParticipant = chat.participants?.find(
      (participant) => participant.id !== currentUserId
    );
    
    return otherParticipant?.username || 'Unknown User';
  };

  const getChatStatusColor = (chat: Chat): string => {
    if (!currentUserId) return 'rgba(255, 255, 255, 0.3)';
    
    const otherParticipant = chat.participants?.find(
      (participant) => participant.id !== currentUserId
    );
    
    if (otherParticipant) {
      const status = userStatuses[otherParticipant.id];
      switch (status) {
        case 'online':
          return '#4CAF50';
        case 'away':
          return '#FFA726';
        case 'offline':
        default:
          return 'rgba(255, 255, 255, 0.3)';
      }
    }
    
    return 'rgba(255, 255, 255, 0.3)';
  };

  const formatLastMessageTime = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      
      if (diff < 60000) { // Less than 1 minute
        return 'now';
      } else if (diff < 3600000) { // Less than 1 hour
        return `${Math.floor(diff / 60000)}m`;
      } else if (diff < 86400000) { // Less than 1 day
        return `${Math.floor(diff / 3600000)}h`;
      } else { // More than 1 day
        return `${Math.floor(diff / 86400000)}d`;
      }
    } catch (error) {
      return '';
    }
  };

  const handleChatPress = (chat: Chat) => {
    router.push('/chat/[id]' as any, { id: chat.id } as any);
  };

  const renderChatItem = ({ item: chat }: { item: Chat }) => {
    const displayName = getChatDisplayName(chat);
    const statusColor = getChatStatusColor(chat);
    const lastMessage = chat.lastMessage;
    
    const otherParticipant = chat.participants?.find((p) => p.id !== currentUserId) as User | undefined;
    const avatar = otherParticipant?.avatar || otherParticipant?.avatarUrl || null;

    return (
      <TouchableOpacity onPress={() => handleChatPress(chat)} style={styles.chatItem}>
        <GlassCard style={styles.chatCard}>
          <View style={styles.leftColumn}>
            <View style={styles.avatarContainer}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <Image source={require('../assets/logo.png')} style={styles.avatar} />
              )}
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            </View>
          </View>

          <View style={styles.chatContent}>
            <View style={styles.chatHeaderRow}>
              <Text style={styles.chatName} numberOfLines={1}>{displayName}</Text>
              {lastMessage && (
                <Text style={styles.lastMessageTime}>{formatLastMessageTime(lastMessage.createdAt)}</Text>
              )}
            </View>

            {lastMessage ? (
              <View style={styles.lastMessageContainer}>
                <Text style={styles.lastMessageSender} numberOfLines={1}>
                  {lastMessage.user.id === currentUserId ? 'You' : lastMessage.user.username}:
                </Text>
                <Text style={styles.lastMessageContent} numberOfLines={1}>
                  {lastMessage.content}
                </Text>
              </View>
            ) : (
              <Text style={styles.noMessages}>No messages yet</Text>
            )}
          </View>

          <View style={styles.rightColumn}>
            <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.3)" />
          </View>
        </GlassCard>
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
    <View style={styles.container}>
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContainer: {
    paddingBottom: 16,
  },
  chatItem: {
    marginBottom: 12,
  },
  chatCard: {
  padding: 12,
  flexDirection: 'row',
  alignItems: 'center',
  },
  chatContent: {
    flex: 1,
  },
  leftColumn: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rightColumn: {
    width: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lastMessageTime: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  lastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessageSender: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginRight: 4,
  },
  lastMessageContent: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    flex: 1,
  },
  noMessages: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateMessage: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    marginTop: 16,
  },
});
