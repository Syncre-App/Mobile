import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Host, ContextMenu, Button } from '@expo/ui/swift-ui';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../hooks/useTheme';
import { useChatStore } from '../../../stores/chatStore';
import { useAuthStore } from '../../../stores/authStore';
import { Avatar, LoadingSpinner } from '../../../components/ui';
import { Layout } from '../../../constants/layout';
import { Chat } from '../../../types/chat';
import { formatDistanceToNow } from 'date-fns';

export default function ChatsScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();
  const { chats, fetchChats, fetchUnreadSummary, unreadSummary, isLoading } = useChatStore();

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    fetchChats();
    fetchUnreadSummary();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchChats(), fetchUnreadSummary()]);
    setRefreshing(false);
  }, []);

  const getOtherParticipant = (chat: Chat) => {
    if (chat.isGroup) return null;
    return chat.participants.find(p => p.id !== user?.id);
  };

  const getChatDisplayName = (chat: Chat) => {
    if (chat.isGroup) {
      return chat.displayName || chat.name || 'Group Chat';
    }
    const other = getOtherParticipant(chat);
    return other?.username || 'Unknown';
  };

  const getChatAvatar = (chat: Chat) => {
    if (chat.isGroup) {
      return chat.avatarUrl;
    }
    const other = getOtherParticipant(chat);
    return other?.profile_picture;
  };

  const handleMuteChat = (chatId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: Implement mute chat
    Alert.alert('Muted', 'Chat has been muted');
  };

  const handlePinChat = (chatId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: Implement pin chat
    Alert.alert('Pinned', 'Chat has been pinned');
  };

  const handleDeleteChat = (chatId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Delete Chat',
      'Are you sure you want to delete this chat? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement delete chat
          },
        },
      ]
    );
  };

  const renderChatItem = ({ item }: { item: Chat }) => {
    const displayName = getChatDisplayName(item);
    const avatarUrl = getChatAvatar(item);
    const unreadCount = unreadSummary?.chats[item.id] || 0;
    const lastMessageTime = item.updated_at
      ? formatDistanceToNow(new Date(item.updated_at), { addSuffix: false })
      : '';

    const chatContent = (
      <TouchableOpacity
        style={[styles.chatItem, { backgroundColor: colors.background }]}
        onPress={() => router.push(`/(app)/chat/${item.id}`)}
        activeOpacity={0.7}
      >
        <Avatar
          source={avatarUrl}
          name={displayName}
          size="lg"
          showOnlineStatus={!item.isGroup}
          isOnline={getOtherParticipant(item)?.status === 'online'}
        />

        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text
              style={[
                styles.chatName,
                { color: colors.text },
                unreadCount > 0 && styles.chatNameUnread,
              ]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text style={[styles.chatTime, { color: colors.textSecondary }]}>
              {lastMessageTime}
            </Text>
          </View>

          <View style={styles.chatFooter}>
            <Text
              style={[
                styles.chatLastMessage,
                { color: unreadCount > 0 ? colors.text : colors.textSecondary },
                unreadCount > 0 && styles.chatLastMessageUnread,
              ]}
              numberOfLines={1}
            >
              {item.lastMessage?.content || 'No messages yet'}
            </Text>

            {unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.unreadText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );

    // Use SwiftUI ContextMenu on iOS for native long-press menu
    if (Platform.OS === 'ios') {
      return (
        <Host matchContents>
          <ContextMenu>
            <ContextMenu.Items>
              <Button
                systemImage="bell.slash"
                onPress={() => handleMuteChat(item.id)}
              >
                Mute
              </Button>
              <Button
                systemImage="pin"
                onPress={() => handlePinChat(item.id)}
              >
                Pin
              </Button>
              <Button
                systemImage="trash"
                onPress={() => handleDeleteChat(item.id)}
              >
                Delete
              </Button>
            </ContextMenu.Items>
            <ContextMenu.Trigger>
              {chatContent}
            </ContextMenu.Trigger>
          </ContextMenu>
        </Host>
      );
    }

    return chatContent;
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Chats Yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Start a conversation with your friends
      </Text>
      <TouchableOpacity
        style={[styles.startChatButton, { backgroundColor: colors.accent }]}
        onPress={() => router.push('/(app)/new-chat')}
      >
        <Text style={styles.startChatButtonText}>Start a Chat</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isLoading && chats.length === 0 ? (
        <LoadingSpinner fullScreen message="Loading chats..." />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={item => item.id.toString()}
          renderItem={renderChatItem}
          contentContainerStyle={chats.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingTop: Layout.spacing.sm,
  },
  emptyList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
  },
  chatContent: {
    flex: 1,
    marginLeft: Layout.spacing.md,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.medium,
    flex: 1,
    marginRight: Layout.spacing.sm,
  },
  chatNameUnread: {
    fontWeight: Layout.fontWeight.bold,
  },
  chatTime: {
    fontSize: Layout.fontSize.xs,
  },
  chatFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatLastMessage: {
    fontSize: Layout.fontSize.sm,
    flex: 1,
    marginRight: Layout.spacing.sm,
  },
  chatLastMessageUnread: {
    fontWeight: Layout.fontWeight.medium,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: Layout.fontWeight.bold,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.xl,
  },
  emptyTitle: {
    fontSize: Layout.fontSize.xl,
    fontWeight: Layout.fontWeight.semibold,
    marginTop: Layout.spacing.lg,
    marginBottom: Layout.spacing.sm,
  },
  emptySubtitle: {
    fontSize: Layout.fontSize.md,
    textAlign: 'center',
    marginBottom: Layout.spacing.xl,
  },
  startChatButton: {
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.md,
  },
  startChatButtonText: {
    color: '#FFFFFF',
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.semibold,
  },
});
