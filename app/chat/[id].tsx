import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../../hooks/useAuth';
import { ApiService } from '../../services/ApiService';
import { NotificationService } from '../../services/NotificationService';
import { StorageService } from '../../services/StorageService';
import { CryptoService } from '../../services/CryptoService';
import { DeviceService } from '../../services/DeviceService';
import { WebSocketMessage, WebSocketService } from '../../services/WebSocketService';
import { UserCacheService } from '../../services/UserCacheService';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  isPlaceholder?: boolean;
}

interface MessageBubbleProps {
  item: Message;
  isMyMessage: boolean;
  isPlaceholder: boolean;
  currentUserId: string | null;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ item, isMyMessage, isPlaceholder, currentUserId }) => {
  const [senderUsername, setSenderUsername] = useState<string>('Loading...');

  useEffect(() => {
    let isMounted = true;

    const resolveSender = async () => {
      if (isPlaceholder || isMyMessage) {
        if (isMounted) {
          setSenderUsername(isMyMessage ? 'You' : 'Placeholder');
        }
        return;
      }

      try {
        const sender = await UserCacheService.getUser(item.senderId);
        if (isMounted) {
          setSenderUsername(sender?.username || sender?.email || 'Unknown User');
        }
      } catch (error) {
        console.error(`Error fetching sender username for ID: ${item.senderId}:`, error);
        if (isMounted) {
          setSenderUsername('Unknown User');
        }
      }
    };

    resolveSender();

    return () => {
      isMounted = false;
    };
  }, [item.senderId, isMyMessage, isPlaceholder]);

  const bubbleStyles = [
    styles.messageBubble,
    isPlaceholder ? styles.placeholderMessage : isMyMessage ? styles.myMessage : styles.theirMessage,
  ];

  return (
    <View style={bubbleStyles}>
      {!isPlaceholder && !isMyMessage && senderUsername && senderUsername !== 'Loading...' && (
        <Text style={styles.senderName}>{senderUsername}</Text>
      )}

      <Text style={[styles.messageContent, isPlaceholder && styles.placeholderContent]}>{item.content}</Text>

      {!isPlaceholder && (
        <Text style={styles.messageTimestamp}>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      )}
    </View>
  );
};

const ChatScreen: React.FC = () => {
  const { id } = useLocalSearchParams();
  const chatId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
  const { user } = useAuth();

  const flatListRef = useRef<FlatList<Message>>(null);
  const receiverNameRef = useRef('Loading...');
  const otherUserIdRef = useRef<string | null>(null);
  const participantIdsRef = useRef<string[]>([]);
  const authTokenRef = useRef<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const wsService = useMemo(() => WebSocketService.getInstance(), []);

  const [receiverUsername, setReceiverUsername] = useState<string>('Loading...');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isThreadLoading, setIsThreadLoading] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const generatePlaceholderMessages = useCallback(
    (displayName: string, otherUserId?: string | null) => {
      const friendlyName = displayName || 'your friend';
      const now = Date.now();
      return [
        {
          id: 'placeholder-1',
          senderId: otherUserId || 'friend',
          receiverId: String(user?.id ?? 'me'),
          content: `👋 ${friendlyName} hasn't sent any messages yet, but this space is ready when they do.`,
          timestamp: new Date(now - 60_000).toISOString(),
          isPlaceholder: true,
        },
        {
          id: 'placeholder-2',
          senderId: String(user?.id ?? 'me'),
          receiverId: otherUserId || 'friend',
          content: `Start the conversation by sending a quick hello!`,
          timestamp: new Date(now - 30_000).toISOString(),
          isPlaceholder: true,
        },
      ] as Message[];
    },
    [user?.id]
  );

  const loadMessagesForChat = useCallback(
    async (token: string, chatIdentifier: string, displayName: string, otherUserId?: string | null) => {
      try {
        const deviceIdentifier = deviceIdRef.current;
        const query = deviceIdentifier ? `?deviceId=${encodeURIComponent(deviceIdentifier)}` : '';
        const response = await ApiService.get(`/chat/${chatIdentifier}/messages${query}`, token);
        const rawMessages = response.success
          ? Array.isArray(response.data?.messages)
            ? response.data.messages
            : Array.isArray(response.data)
              ? response.data
              : []
          : [];

        if (rawMessages.length === 0) {
          setMessages(generatePlaceholderMessages(displayName, otherUserId));
          return;
        }

        const decryptedMessages: Message[] = [];
        for (const msg of rawMessages) {
          if (msg.isEncrypted && Array.isArray(msg.envelopes)) {
            const decrypted = await CryptoService.decryptMessage(chatIdentifier, msg.envelopes);
            if (!decrypted) {
              continue;
            }
            decryptedMessages.push({
              id: String(msg.id ?? `${chatIdentifier}-${msg.created_at ?? Date.now()}`),
              senderId: String(msg.sender_id ?? msg.senderId ?? ''),
              receiverId: String(otherUserId ?? ''),
              content: decrypted,
              timestamp: msg.created_at ?? msg.timestamp ?? new Date().toISOString(),
            });
          } else {
            decryptedMessages.push({
              id: String(msg.id ?? `${chatIdentifier}-${msg.created_at ?? Date.now()}`),
              senderId: String(msg.sender_id ?? msg.senderId ?? ''),
              receiverId: String(msg.receiver_id ?? msg.receiverId ?? otherUserId ?? ''),
              content: msg.content ?? '',
              timestamp: msg.created_at ?? msg.timestamp ?? new Date().toISOString(),
            });
          }
        }

        setMessages(decryptedMessages.length ? decryptedMessages : generatePlaceholderMessages(displayName, otherUserId));
      } catch (error) {
        console.error(`Error loading messages for chat ${chatIdentifier}:`, error);
        setMessages(generatePlaceholderMessages(displayName, otherUserId));
      }
    },
    [generatePlaceholderMessages]
  );

  const loadChatDetails = useCallback(async () => {
    if (!chatId || !user?.id) {
      return;
    }

    setIsThreadLoading(true);
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        throw new Error('Missing authentication token');
      }
      authTokenRef.current = token;

      const chatResponse = await ApiService.get(`/chat/${chatId}`, token);
      if (!chatResponse.success || !chatResponse.data?.chat) {
        throw new Error('Chat not found');
      }

      const chatData = chatResponse.data.chat;

      let participantIds: string[] = [];
      try {
        const parsed = JSON.parse(chatData.users ?? '[]');
        participantIds = Array.isArray(parsed) ? parsed.map((pid: any) => pid?.toString?.() ?? String(pid)) : [];
      } catch {
        participantIds = [];
      }
      participantIdsRef.current = participantIds;

      const currentUserId = user.id.toString();
      const otherParticipantId =
        participantIds.find((pid) => pid !== currentUserId) ?? (participantIds.length > 0 ? participantIds[0] : null);

      otherUserIdRef.current = otherParticipantId || null;

      let displayName = 'Friend';
      if (otherParticipantId) {
        const userResponse = await ApiService.getUserById(otherParticipantId, token);
        if (userResponse.success && userResponse.data) {
          const fetchedUser = userResponse.data;
          displayName = fetchedUser.username || fetchedUser.email || displayName;
        }
      }

      receiverNameRef.current = displayName;
      setReceiverUsername(displayName);

      try {
        await CryptoService.ensureIdentity(token);
      } catch (cryptoError) {
        console.error('Failed to ensure E2EE identity before loading messages:', cryptoError);
      }

      await loadMessagesForChat(token, chatId, displayName, otherParticipantId);
    } catch (error) {
      console.error(`Error loading chat ${chatId}:`, error);
      const fallbackName = receiverNameRef.current === 'Loading...' ? 'your friend' : receiverNameRef.current;
      setMessages(generatePlaceholderMessages(fallbackName, otherUserIdRef.current));
    } finally {
      setIsThreadLoading(false);
    }
  }, [chatId, user?.id, loadMessagesForChat, generatePlaceholderMessages]);

  const handleIncomingMessage = useCallback(
    async (message: WebSocketMessage) => {
      if (!chatId) {
        return;
      }

      const payload: any = message;
      const targetChatId = String(payload.chatId ?? payload.data?.chatId ?? '');

      if (!targetChatId || targetChatId !== chatId) {
        return;
      }

      if (message.type === 'message_envelope' || message.type === 'message_envelope_sent') {
        const envelopes = Array.isArray(payload.envelopes) ? payload.envelopes : [];
        if (!envelopes.length) {
          return;
        }

        try {
          const decrypted = await CryptoService.decryptMessage(targetChatId, envelopes);
          if (!decrypted) {
            return;
          }

          const newEntry: Message = {
            id: String(payload.messageId ?? payload.id ?? Date.now()),
            senderId: String(payload.senderId ?? ''),
            receiverId: String(payload.receiverId ?? otherUserIdRef.current ?? ''),
            content: decrypted,
            timestamp: payload.created_at ?? payload.timestamp ?? new Date().toISOString(),
          };

          setMessages((prev) => {
            const withoutPlaceholders = prev.filter((msg) => !msg.isPlaceholder);
            const deduped = withoutPlaceholders.filter((msg) => {
              if (!user?.id) {
                return true;
              }
              const isOptimisticMatch =
                msg.id.startsWith('temp-') && msg.senderId === String(user.id) && msg.content === newEntry.content;
              return !isOptimisticMatch;
            });

            if (deduped.some((msg) => msg.id === newEntry.id)) {
              return deduped;
            }

            return [...deduped, newEntry];
          });
        } catch (error) {
          console.error('Failed to decrypt incoming message envelope:', error);
        }
        return;
      }

      if (message.type !== 'new_message') {
        return;
      }

      const newEntry: Message = {
        id: String(payload.messageId ?? payload.id ?? Date.now()),
        senderId: String(payload.senderId ?? ''),
        receiverId: String(payload.receiverId ?? otherUserIdRef.current ?? ''),
        content: payload.content ?? '',
        timestamp: payload.created_at ?? payload.timestamp ?? new Date().toISOString(),
      };

      setMessages((prev) => {
        const withoutPlaceholders = prev.filter((msg) => !msg.isPlaceholder);
        if (withoutPlaceholders.some((msg) => msg.id === newEntry.id)) {
          return withoutPlaceholders;
        }
        return [...withoutPlaceholders, newEntry];
      });
    },
    [chatId, user?.id]
  );

  useEffect(() => {
    if (!user?.id || !chatId) {
      return;
    }
    loadChatDetails();
  }, [user?.id, chatId, loadChatDetails]);

  useEffect(() => {
    let isMounted = true;
    DeviceService.getOrCreateDeviceId()
      .then((id) => {
        if (!isMounted) {
          return;
        }
        deviceIdRef.current = id;
        setDeviceId(id);
        if (chatId) {
          wsService.joinChat(chatId, id);
        }
      })
      .catch((error) => console.error('Failed to resolve device ID for chat join:', error));

    return () => {
      isMounted = false;
      if (chatId) {
        wsService.leaveChat(chatId);
      }
    };
  }, [chatId, wsService]);

  useEffect(() => {
    wsService.connect().catch((error) => console.error('Failed to ensure WebSocket connection for chat screen:', error));
    const listener = (incoming: WebSocketMessage) => {
      handleIncomingMessage(incoming);
    };
    const unsubscribe = wsService.addMessageListener(listener);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [wsService, handleIncomingMessage]);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !user?.id || !chatId) {
      return;
    }

    const trimmedMessage = newMessage.trim();
    const temporaryId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: temporaryId,
      senderId: String(user.id),
      receiverId: String(otherUserIdRef.current ?? ''),
      content: trimmedMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => {
      const withoutPlaceholders = prev.filter((msg) => !msg.isPlaceholder);
      return [...withoutPlaceholders, optimisticMessage];
    });
    setNewMessage('');
    setIsSendingMessage(true);

    try {
      const token = authTokenRef.current ?? (await StorageService.getAuthToken());
      if (!token) {
        throw new Error('Missing auth token for encrypted send');
      }
      authTokenRef.current = token;

      const otherParticipants = participantIdsRef.current
        .filter((participantId) => participantId !== String(user.id))
        .filter(Boolean);

      const recipientIds =
        otherParticipants.length > 0
          ? otherParticipants
          : otherUserIdRef.current
            ? [otherUserIdRef.current]
            : [];

      if (!recipientIds.length) {
        throw new Error('No chat recipients available');
      }

      const encryptedPayload = await CryptoService.buildEncryptedPayload({
        chatId,
        message: trimmedMessage,
        recipientUserIds: recipientIds,
        token,
        currentUserId: String(user.id),
      });

      wsService.send({
        type: 'message_send',
        chatId,
        envelopes: encryptedPayload.envelopes,
        senderDeviceId: encryptedPayload.senderDeviceId,
        messageType: 'encrypted',
        preview: encryptedPayload.preview,
      });
    } catch (error) {
      console.error(`Error sending encrypted message to chat ${chatId}:`, error);
      NotificationService.show('error', 'Failed to send message. Please try again.');
      setMessages((prev) => prev.filter((msg) => msg.id !== temporaryId));
      setNewMessage(trimmedMessage);
    } finally {
      setIsSendingMessage(false);
    }
  }, [chatId, newMessage, user?.id, wsService]);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isPlaceholder = Boolean(item.isPlaceholder);
      const isMyMessage = !isPlaceholder && user?.id != null && item.senderId === String(user.id);
      return (
        <MessageBubble
          item={item}
          isMyMessage={isMyMessage}
          isPlaceholder={isPlaceholder}
          currentUserId={user?.id ?? null}
        />
      );
    },
    [user?.id]
  );

  if (!chatId) {
    return (
      <SafeAreaView style={styles.fallbackContainer}>
        <Text style={styles.fallbackText}>Unable to open this chat.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Stack.Screen options={{ title: `Chat with ${receiverUsername}` }} />

      <LinearGradient
        colors={['#03040A', '#071026']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton} accessibilityRole="button">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{`Chat with ${receiverUsername}`}</Text>
        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {isThreadLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#2C82FF" />
            <Text style={styles.loadingStateText}>Loading conversation…</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message…"
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            multiline
            editable={!isSendingMessage}
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            style={[styles.sendButton, isSendingMessage && styles.sendButtonDisabled]}
            disabled={isSendingMessage}
            accessibilityRole="button"
          >
            {isSendingMessage ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="send" size={24} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#03040A',
  },
  fallbackText: {
    color: '#ffffff',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 12,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#2C82FF',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomLeftRadius: 4,
  },
  placeholderMessage: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  senderName: {
    fontWeight: '600',
    marginBottom: 4,
    color: '#ffffff',
  },
  messageContent: {
    fontSize: 16,
    color: '#ffffff',
  },
  placeholderContent: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontStyle: 'italic',
  },
  messageTimestamp: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingStateText: {
    marginTop: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: 'white',
    maxHeight: 120,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#0EA5FF',
    borderRadius: 20,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
});

export default ChatScreen;
