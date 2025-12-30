import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  RefreshControl,
  ActionSheetIOS,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../hooks/useTheme';
import { useChatStore } from '../../../stores/chatStore';
import { useAuthStore } from '../../../stores/authStore';
import { chatApi } from '../../../services/api';
import { Avatar, LoadingSpinner } from '../../../components/ui';
import { MessageBubble, MessageInput, TypingIndicator, ReactionPicker } from '../../../components/chat';
import { Layout } from '../../../constants/layout';
import { Message, Chat, TypingUser } from '../../../types/chat';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = parseInt(id);
  
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const {
    chats,
    messages,
    typingUsers,
    hasMoreMessages,
    fetchMessages,
    addMessage,
    updateMessage,
    markChatAsRead,
    setActiveChat,
    isLoadingMessages,
  } = useChatStore();

  const [chat, setChat] = useState<Chat | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: number; name: string; preview: string } | null>(null);
  const [showTimestampForMessage, setShowTimestampForMessage] = useState<number | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const chatMessages = messages[chatId] || [];
  const chatTypingUsers = typingUsers.filter(t => t.chatId === chatId);

  useEffect(() => {
    // Find chat info
    const foundChat = chats.find(c => c.id === chatId);
    if (foundChat) {
      setChat(foundChat);
    } else {
      // Fetch chat details if not in store
      chatApi.getChat(chatId).then(setChat).catch(console.error);
    }

    // Set active chat
    setActiveChat(chatId);

    // Fetch messages
    fetchMessages(chatId);

    // Mark as read
    markChatAsRead(chatId);

    return () => {
      setActiveChat(null);
    };
  }, [chatId]);

  const getOtherParticipant = () => {
    if (!chat || chat.isGroup) return null;
    return chat.participants.find(p => p.id !== user?.id);
  };

  const getChatDisplayName = () => {
    if (!chat) return '';
    if (chat.isGroup) {
      return chat.displayName || chat.name || 'Group Chat';
    }
    const other = getOtherParticipant();
    return other?.username || 'Unknown';
  };

  const getChatAvatar = () => {
    if (!chat) return null;
    if (chat.isGroup) {
      return chat.avatarUrl;
    }
    const other = getOtherParticipant();
    return other?.profile_picture;
  };

  const handleSendMessage = async (content: string, attachments?: string[]) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;

    // Create optimistic message
    const localId = `local_${Date.now()}`;
    const optimisticMessage: Message = {
      id: Date.now(), // Temporary ID
      chatId,
      senderId: parseInt(user?.id || '0'),
      senderDeviceId: null,
      senderName: user?.username || '',
      senderAvatar: user?.profile_picture || null,
      senderBadges: [],
      isEncrypted: false,
      messageType: 'text',
      content,
      createdAt: new Date().toISOString(),
      createdAtLocal: new Date().toISOString(),
      deliveredAt: null,
      deliveredAtLocal: null,
      seenAt: null,
      seenAtLocal: null,
      editedAt: null,
      editedAtLocal: null,
      editCount: 0,
      deletedAt: null,
      deletedAtLocal: null,
      isDeleted: false,
      deletedBy: null,
      deletedByName: null,
      reply: replyTo ? {
        messageId: replyTo.id.toString(),
        senderId: '',
        preview: replyTo.preview,
        senderLabel: replyTo.name,
      } : null,
      attachments: [],
      seenBy: [],
      reactions: [],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      pending: true,
      localId,
    };

    addMessage(optimisticMessage);
    setReplyTo(null);

    // Scroll to bottom
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });

    // TODO: Send via WebSocket
    // For now, simulate success after delay
    setTimeout(() => {
      updateMessage(chatId, optimisticMessage.id, { pending: false });
    }, 500);
  };

  const handleTyping = (isTyping: boolean) => {
    // TODO: Send typing indicator via WebSocket
  };

  const handleMessagePress = (message: Message) => {
    // Toggle timestamp
    setShowTimestampForMessage(
      showTimestampForMessage === message.id ? null : message.id
    );
  };

  const handleMessageLongPress = (message: Message) => {
    setSelectedMessage(message);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Reply', 'React', 'Copy', 'Delete'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 4,
        },
        buttonIndex => {
          switch (buttonIndex) {
            case 1: // Reply
              setReplyTo({
                id: message.id,
                name: message.senderName,
                preview: message.content || '',
              });
              break;
            case 2: // React
              setShowReactionPicker(true);
              break;
            case 3: // Copy
              // TODO: Copy to clipboard
              break;
            case 4: // Delete
              handleDeleteMessage(message);
              break;
          }
        }
      );
    } else {
      Alert.alert(
        'Message Options',
        undefined,
        [
          {
            text: 'Reply',
            onPress: () => setReplyTo({
              id: message.id,
              name: message.senderName,
              preview: message.content || '',
            }),
          },
          {
            text: 'React',
            onPress: () => setShowReactionPicker(true),
          },
          {
            text: 'Copy',
            onPress: () => {
              // TODO: Copy to clipboard
            },
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => handleDeleteMessage(message),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handleDoubleTap = (message: Message) => {
    setSelectedMessage(message);
    setShowReactionPicker(true);
  };

  const handleDeleteMessage = async (message: Message) => {
    try {
      await chatApi.deleteMessage(chatId, message.id);
      // Store will be updated via WebSocket
    } catch (error) {
      Alert.alert('Error', 'Failed to delete message');
    }
  };

  const handleReaction = async (reaction: string) => {
    if (!selectedMessage) return;

    try {
      const existingReaction = selectedMessage.reactions.find(
        r => r.reaction === reaction && r.userIds.includes(user?.id || '')
      );

      if (existingReaction) {
        await chatApi.removeReaction(chatId, selectedMessage.id, reaction);
      } else {
        await chatApi.addReaction(chatId, selectedMessage.id, reaction);
      }
    } catch (error) {
      console.error('Reaction error:', error);
    }

    setSelectedMessage(null);
    setShowReactionPicker(false);
  };

  const loadMoreMessages = () => {
    if (!isLoadingMessages && hasMoreMessages[chatId]) {
      fetchMessages(chatId, true);
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwnMessage = item.senderId === parseInt(user?.id || '0');
    const prevMessage = chatMessages[index + 1];
    const showAvatar = !prevMessage || prevMessage.senderId !== item.senderId;
    const showTimestamp = showTimestampForMessage === item.id;

    return (
      <MessageBubble
        message={item}
        isOwnMessage={isOwnMessage}
        showAvatar={showAvatar}
        showTimestamp={showTimestamp}
        onPress={() => handleMessagePress(item)}
        onLongPress={() => handleMessageLongPress(item)}
        onDoubleTap={() => handleDoubleTap(item)}
        onReactionPress={reaction => {
          setSelectedMessage(item);
          handleReaction(reaction);
        }}
      />
    );
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color={colors.accent} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.headerContent}
        onPress={() => {
          const other = getOtherParticipant();
          if (other) {
            router.push(`/(app)/profile/${other.id}`);
          }
        }}
      >
        <Avatar
          source={getChatAvatar()}
          name={getChatDisplayName()}
          size="sm"
          showOnlineStatus={!chat?.isGroup}
          isOnline={getOtherParticipant()?.status === 'online'}
        />
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {getChatDisplayName()}
          </Text>
          {!chat?.isGroup && getOtherParticipant()?.status === 'online' && (
            <Text style={[styles.headerSubtitle, { color: colors.online }]}>
              Online
            </Text>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuButton}>
        <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {renderHeader()}

      {isLoadingMessages && chatMessages.length === 0 ? (
        <LoadingSpinner fullScreen message="Loading messages..." />
      ) : (
        <FlatList
          ref={flatListRef}
          data={chatMessages}
          keyExtractor={item => item.localId || item.id.toString()}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.messageList}
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            chatTypingUsers.length > 0 ? (
              <TypingIndicator users={chatTypingUsers.map(t => t.username)} />
            ) : null
          }
        />
      )}

      <MessageInput
        onSend={handleSendMessage}
        onTyping={handleTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        placeholder="Message"
      />

      <ReactionPicker
        visible={showReactionPicker}
        onClose={() => {
          setShowReactionPicker(false);
          setSelectedMessage(null);
        }}
        onSelect={handleReaction}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical: Layout.spacing.sm,
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: Layout.spacing.xs,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Layout.spacing.sm,
  },
  headerInfo: {
    marginLeft: Layout.spacing.sm,
    flex: 1,
  },
  headerTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.semibold,
  },
  headerSubtitle: {
    fontSize: Layout.fontSize.xs,
  },
  menuButton: {
    padding: Layout.spacing.sm,
  },
  messageList: {
    paddingVertical: Layout.spacing.md,
  },
});
