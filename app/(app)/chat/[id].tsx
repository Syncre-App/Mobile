import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  GestureResponderEvent,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../hooks/useTheme';
import { useChatStore } from '../../../stores/chatStore';
import { useAuthStore } from '../../../stores/authStore';
import { useE2EEStore } from '../../../stores/e2eeStore';
import { chatApi } from '../../../services/api';
import { wsClient } from '../../../services/websocket/client';
import { WSMessage, WSNewMessage, WSTypingEvent, WSMessageDeletedEvent, WSChatMessage } from '../../../services/websocket/types';
import { Avatar, LoadingSpinner, GlassContextMenu } from '../../../components/ui';
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
    addTypingUser,
    removeTypingUser,
  } = useChatStore();
  const {
    isUnlocked: isE2EEUnlocked,
    encryptMessage,
    decryptMessage,
    fetchRecipientDevices,
  } = useE2EEStore();

  const [chat, setChat] = useState<Chat | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [replyTo, setReplyTo] = useState<{ id: number; name: string; preview: string } | null>(null);
  const [showTimestampForMessage, setShowTimestampForMessage] = useState<number | null>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<Record<number, string>>({});
  
  const flatListRef = useRef<FlatList>(null);
  const chatMessages = messages[chatId] || [];
  const chatTypingUsers = typingUsers.filter(t => t.chatId === chatId);

  // Fetch recipient devices for E2EE when chat loads
  useEffect(() => {
    if (chat && isE2EEUnlocked) {
      const participantIds = chat.participants.map(p => p.id);
      fetchRecipientDevices(participantIds);
    }
  }, [chat, isE2EEUnlocked]);

  // Decrypt encrypted messages
  useEffect(() => {
    const decryptMessages = async () => {
      if (!isE2EEUnlocked || !user?.id || !user?.activeDeviceId) return;

      const newDecrypted: Record<number, string> = { ...decryptedMessages };
      
      for (const message of chatMessages) {
        if (message.isEncrypted && message.envelopes && !decryptedMessages[message.id]) {
          try {
            const plaintext = await decryptMessage(
              message.envelopes,
              user.id,
              user.activeDeviceId
            );
            if (plaintext) {
              newDecrypted[message.id] = plaintext;
            }
          } catch (error) {
            console.error(`Failed to decrypt message ${message.id}:`, error);
          }
        }
      }

      if (Object.keys(newDecrypted).length !== Object.keys(decryptedMessages).length) {
        setDecryptedMessages(newDecrypted);
      }
    };

    decryptMessages();
  }, [chatMessages, isE2EEUnlocked, user?.id, user?.activeDeviceId]);

  // Get display content for a message (decrypted if E2EE)
  const getMessageContent = useCallback((message: Message): string | null => {
    if (message.isEncrypted) {
      return decryptedMessages[message.id] || '[Encrypted message]';
    }
    return message.content;
  }, [decryptedMessages]);

  // WebSocket setup
  useEffect(() => {
    if (!user?.id || !user?.activeDeviceId) return; 

    const senderId = parseInt(user.id);
    const senderDeviceId = user.activeDeviceId; 

    wsClient.joinChat(chatId, senderDeviceId);

    const handleNewMessage = (wsMessage: WSMessage) => {
      if (wsMessage.type === 'new_message' || wsMessage.type === 'message_envelope') {
        const wsMsg = wsMessage as WSNewMessage;
        if (wsMsg.chatId === chatId) {
          // Convert WSNewMessage to Message format
          const newMessage: Message = {
            id: wsMsg.messageId,
            chatId: wsMsg.chatId,
            senderId: wsMsg.senderId,
            senderDeviceId: null,
            senderName: wsMsg.senderUsername,
            senderAvatar: wsMsg.senderAvatar || null,
            senderBadges: wsMsg.senderBadges || [],
            isEncrypted: wsMsg.message_type === 'e2ee',
            messageType: wsMsg.message_type as Message['messageType'],
            content: wsMsg.content || null,
            envelopes: wsMsg.envelopes,
            createdAt: wsMsg.createdAt || wsMsg.created_at,
            createdAtLocal: wsMsg.createdAt || wsMsg.created_at,
            deliveredAt: null,
            deliveredAtLocal: null,
            seenAt: null,
            seenAtLocal: null,
            editedAt: wsMsg.editedAt || null,
            editedAtLocal: wsMsg.editedAt || null,
            editCount: 0,
            deletedAt: wsMsg.deletedAt || null,
            deletedAtLocal: wsMsg.deletedAt || null,
            isDeleted: !!wsMsg.deletedAt,
            deletedBy: null,
            deletedByName: null,
            reply: wsMsg.reply || null,
            attachments: wsMsg.attachments || [],
            seenBy: [],
            reactions: [],
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            pending: false,
          };
          addMessage(newMessage);
          // Scroll to bottom only if it's not our own message
          if (wsMsg.senderId !== senderId) {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }
        }
      }
    };

    const handleMessageDelete = (wsMessage: WSMessage) => {
      const deleteMsg = wsMessage as WSMessageDeletedEvent;
      if (deleteMsg.chatId === chatId) {
        updateMessage(chatId, deleteMsg.messageId, { 
          isDeleted: true, 
          deletedAt: deleteMsg.deletedAt,
          deletedBy: deleteMsg.deletedBy.toString(),
          deletedByName: deleteMsg.deletedByName,
        });
      }
    };

    const handleTypingEvent = (wsMessage: WSMessage) => {
      if (wsMessage.type === 'typing') {
        const typingMsg = wsMessage as WSTypingEvent;
        if (typingMsg.chatId === chatId && typingMsg.userId !== senderId) {
          addTypingUser({ chatId, userId: typingMsg.userId, username: typingMsg.username, timestamp: Date.now() });
        }
      } else if (wsMessage.type === 'stop-typing') {
        const typingMsg = wsMessage as WSTypingEvent;
        if (typingMsg.chatId === chatId && typingMsg.userId !== senderId) {
          removeTypingUser(chatId, typingMsg.userId);
        }
      }
    };

    const unsubscribeNewMessage = wsClient.on('new_message', handleNewMessage);
    const unsubscribeMessageEnvelope = wsClient.on('message_envelope', handleNewMessage);
    const unsubscribeMessageDeleted = wsClient.on('message_deleted', handleMessageDelete);
    const unsubscribeTyping = wsClient.on('typing', handleTypingEvent);
    const unsubscribeStopTyping = wsClient.on('stop-typing', handleTypingEvent);

    return () => {
      wsClient.leaveChat(chatId);
      unsubscribeNewMessage();
      unsubscribeMessageEnvelope();
      unsubscribeMessageDeleted();
      unsubscribeTyping();
      unsubscribeStopTyping();
    };
  }, [chatId, user?.id, user?.activeDeviceId, addMessage, updateMessage, addTypingUser, removeTypingUser]);

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
  }, [chatId, chats, fetchMessages, markChatAsRead, setActiveChat]);

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
    if (!user?.id || !user?.activeDeviceId) {
      Alert.alert('Error', 'User not authenticated.');
      return;
    }
    if (!chat) {
      Alert.alert('Error', 'Chat not loaded.');
      return;
    }

    // Create optimistic message
    const localId = `local_${Date.now()}`;
    const isEncrypted = isE2EEUnlocked;
    
    const optimisticMessage: Message = {
      id: Date.now(), // Temporary ID, will be replaced by server ID
      chatId,
      senderId: parseInt(user.id),
      senderDeviceId: user.activeDeviceId,
      senderName: user.username || '',
      senderAvatar: user.profile_picture || null,
      senderBadges: [],
      isEncrypted,
      messageType: isEncrypted ? 'e2ee' : 'text',
      content: isEncrypted ? null : content, // Content is null for E2EE messages
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
    
    // Store decrypted content locally for display
    if (isEncrypted) {
      setDecryptedMessages(prev => ({ ...prev, [optimisticMessage.id]: content }));
    }
    
    setReplyTo(null);

    // Scroll to bottom
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });

    // Encrypt and send via WebSocket
    if (isEncrypted) {
      const participantIds = chat.participants.map(p => p.id);
      const envelopes = await encryptMessage(content, participantIds, user.activeDeviceId);
      
      if (envelopes && envelopes.length > 0) {
        wsClient.sendMessage({
          type: 'chat_message',
          chatId,
          localId,
          message_type: 'e2ee',
          senderDeviceId: user.activeDeviceId,
          envelopes,
          preview: content.slice(0, 50), // Short preview for notifications
          replyMetadata: replyTo ? {
            messageId: replyTo.id.toString(),
            senderId: '',
            preview: replyTo.preview,
            senderLabel: replyTo.name,
          } : undefined,
        } as WSChatMessage);
      } else {
        // Fallback to unencrypted if encryption fails
        console.warn('E2EE encryption failed, sending unencrypted');
        wsClient.sendMessage({
          type: 'chat_message',
          chatId,
          localId,
          content,
          senderDeviceId: user.activeDeviceId,
          replyMetadata: replyTo ? {
            messageId: replyTo.id.toString(),
            senderId: '',
            preview: replyTo.preview,
            senderLabel: replyTo.name,
          } : undefined,
        } as WSChatMessage);
      }
    } else {
      // Send unencrypted
      wsClient.sendMessage({
        type: 'chat_message',
        chatId,
        localId,
        content,
        senderDeviceId: user.activeDeviceId,
        replyMetadata: replyTo ? {
          messageId: replyTo.id.toString(),
          senderId: '',
          preview: replyTo.preview,
          senderLabel: replyTo.name,
        } : undefined,
      } as WSChatMessage);
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (!user?.activeDeviceId) return;
    wsClient.sendTyping(chatId, isTyping);
  };

  const handleMessagePress = (message: Message) => {
    // Toggle timestamp
    setShowTimestampForMessage(
      showTimestampForMessage === message.id ? null : message.id
    );
  };

  const handleMessageLongPress = (message: Message, event: GestureResponderEvent) => {
    setSelectedMessage(message);
    setContextMenuPos({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
    setShowContextMenu(true);
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
    
    // Get display content - use decrypted for E2EE, otherwise use message.content
    const displayContent = getMessageContent(item);

    return (
      <MessageBubble
        message={item}
        isOwnMessage={isOwnMessage}
        showAvatar={showAvatar}
        showTimestamp={showTimestamp}
        displayContent={displayContent}
        onPress={() => handleMessagePress(item)}
        onLongPress={(e) => handleMessageLongPress(item, e)}
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
          keyExtractor={(item, index) => `msg_${item.id}_${item.localId || ''}_${index}`}
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

      <GlassContextMenu
        visible={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        anchorPosition={contextMenuPos}
        items={[
          {
            label: 'Reply',
            icon: 'arrow-undo-outline',
            onPress: () => {
              if (selectedMessage) {
                setReplyTo({
                  id: selectedMessage.id,
                  name: selectedMessage.senderName,
                  preview: selectedMessage.content || '',
                });
              }
            },
          },
          {
            label: 'React',
            icon: 'happy-outline',
            onPress: () => setShowReactionPicker(true),
          },
          {
            label: 'Copy',
            icon: 'copy-outline',
            onPress: () => {
              // TODO: Copy to clipboard
            },
          },
          {
            label: 'Delete',
            icon: 'trash-outline',
            destructive: true,
            onPress: () => {
              if (selectedMessage) {
                handleDeleteMessage(selectedMessage);
              }
            },
          },
        ]}
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
