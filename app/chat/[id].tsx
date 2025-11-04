import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  UIManager,
  View,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'seen';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  isPlaceholder?: boolean;
  status?: MessageStatus;
}

type ChatListItem =
  | { kind: 'message'; id: string; message: Message }
  | { kind: 'date'; id: string; label: string }
  | { kind: 'typing'; id: string };

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const parseDate = (value: string): Date => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  return date;
};

const formatDateLabel = (date: Date): string => {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);

  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };
  if (today.getFullYear() !== date.getFullYear()) {
    options.year = 'numeric';
  }
  return new Intl.DateTimeFormat(undefined, options).format(date);
};

const formatDetailedTime = (iso: string): string => {
  const date = parseDate(iso);
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (diffDays === 0) {
    return `Today • ${timeFormatter.format(date)}`;
  }
  if (diffDays === 1) {
    return `Yesterday • ${timeFormatter.format(date)}`;
  }

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: today.getFullYear() === date.getFullYear() ? undefined : 'numeric',
  });

  return `${dateFormatter.format(date)} • ${timeFormatter.format(date)}`;
};

const layoutNext = () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

const TypingIndicator: React.FC<{ label: string }> = ({ label }) => {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = dots.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(value, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      )
    );

    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [dots]);

  return (
    <View style={styles.typingRow}>
      <View style={styles.typingBubble}>
        {dots.map((value, index) => (
          <Animated.View
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            style={[
              styles.typingDot,
              {
                opacity: value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                }),
                transform: [
                  {
                    translateY: value.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -3],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.typingText}>{label} is typing…</Text>
    </View>
  );
};

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  showTimestamp: boolean;
  onToggleTimestamp: (messageId: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMine,
  isFirstInGroup,
  isLastInGroup,
  showTimestamp,
  onToggleTimestamp,
}) => {
  const [senderUsername, setSenderUsername] = useState<string>('Loading…');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    let mounted = true;
    if (isMine || message.isPlaceholder) {
      setSenderUsername('You');
      return () => {
        mounted = false;
      };
    }

    const fetchUsername = async () => {
      try {
        const user = await UserCacheService.getUser(message.senderId);
        if (mounted) {
          setSenderUsername(user?.username || user?.email || 'Unknown user');
        }
      } catch (error) {
        console.error(`Error resolving sender ${message.senderId}:`, error);
        if (mounted) {
          setSenderUsername('Unknown user');
        }
      }
    };

    fetchUsername();

    return () => {
      mounted = false;
    };
  }, [message.senderId, isMine, message.isPlaceholder]);

  const statusLabel: string | null = isMine
    ? message.status === 'seen'
      ? 'Seen'
      : message.status === 'delivered'
        ? 'Delivered'
        : message.status === 'sent'
          ? 'Sent'
          : 'Sending…'
    : null;

  const containerStyle = [
    styles.messageRow,
    isMine ? styles.messageRowMine : styles.messageRowTheirs,
    !isFirstInGroup && styles.messageRowStacked,
  ];

  const bubbleStyle = [
    styles.messageBubble,
    isMine ? styles.myBubble : styles.theirBubble,
    isMine
      ? isLastInGroup
        ? styles.myBubbleLast
        : styles.myBubbleStacked
      : isLastInGroup
        ? styles.theirBubbleLast
        : styles.theirBubbleStacked,
    message.isPlaceholder && styles.placeholderBubble,
  ];

  return (
    <Animated.View style={[containerStyle, { opacity: fadeAnim }]}>
      <TouchableWithoutFeedback
        onPress={() => !message.isPlaceholder && onToggleTimestamp(message.id)}
        disabled={message.isPlaceholder}
      >
        <View style={bubbleStyle}>
          {!isMine && isFirstInGroup && !message.isPlaceholder && (
            <Text style={styles.senderLabel}>{senderUsername}</Text>
          )}
          <Text style={[styles.messageText, message.isPlaceholder && styles.placeholderText]}>
            {message.content}
          </Text>
          {isMine && statusLabel && (
            <Text style={styles.statusLabelText}>{statusLabel}</Text>
          )}
        </View>
      </TouchableWithoutFeedback>
      {showTimestamp && (
        <View style={styles.timestampPill}>
          <Text style={styles.timestampText}>{formatDetailedTime(message.timestamp)}</Text>
        </View>
      )}
    </Animated.View>
  );
};

const ChatScreen: React.FC = () => {
  const { id } = useLocalSearchParams();
  const chatId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
  const { user } = useAuth();

  const wsService = useMemo(() => WebSocketService.getInstance(), []);
  const flatListRef = useRef<FlatList<ChatListItem>>(null);

  const receiverNameRef = useRef('Loading…');
  const otherUserIdRef = useRef<string | null>(null);
  const participantIdsRef = useRef<string[]>([]);
  const authTokenRef = useRef<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);

  const typingStateRef = useRef<{ isTyping: boolean }>({ isTyping: false });
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const remoteTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [receiverUsername, setReceiverUsername] = useState<string>('Loading…');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isThreadLoading, setIsThreadLoading] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [activeTimestampId, setActiveTimestampId] = useState<string | null>(null);
  const [isRemoteTyping, setIsRemoteTyping] = useState(false);
  const [typingUserLabel, setTypingUserLabel] = useState<string>('Someone');

  const setMessagesAnimated = useCallback(
    (updater: (prev: Message[]) => Message[]) => {
      layoutNext();
      setMessages((prev) => updater(prev));
    },
    []
  );

  const generatePlaceholderMessages = useCallback(
    (displayName: string) => {
      const friendlyName = displayName || 'your friend';
      const now = Date.now();
      return [
        {
          id: 'placeholder-1',
          senderId: 'friend',
          receiverId: String(user?.id ?? 'me'),
          content: `👋 ${friendlyName} hasn't sent any messages yet, but this space is ready when they do.`,
          timestamp: new Date(now - 60_000).toISOString(),
          isPlaceholder: true,
        },
        {
          id: 'placeholder-2',
          senderId: String(user?.id ?? 'me'),
          receiverId: 'friend',
          content: `Start the conversation with a quick hello!`,
          timestamp: new Date(now - 30_000).toISOString(),
          isPlaceholder: true,
        },
      ] as Message[];
    },
    [user?.id]
  );

  const decoratedData = useMemo<ChatListItem[]>(() => {
    if (!messages.length && !isRemoteTyping) {
      return [];
    }

    const items: ChatListItem[] = [];
    let lastDateKey: string | null = null;

    messages.forEach((message) => {
      const date = parseDate(message.timestamp);
      const dateKey = startOfDay(date).toISOString();

      if (dateKey !== lastDateKey) {
        items.push({
          kind: 'date',
          id: `date-${dateKey}`,
          label: formatDateLabel(date),
        });
        lastDateKey = dateKey;
      }

      items.push({
        kind: 'message',
        id: message.id,
        message,
      });
    });

    if (isRemoteTyping) {
      items.push({ kind: 'typing', id: 'typing-indicator' });
    }

    return items;
  }, [messages, isRemoteTyping]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

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

        if (!rawMessages.length) {
          setMessagesAnimated(() => generatePlaceholderMessages(displayName));
          return;
        }

        const normalisedMessages: Message[] = [];

        for (const msg of rawMessages) {
          const baseMessage = {
            id: String(msg.id ?? `${chatIdentifier}-${msg.created_at ?? Date.now()}`),
            senderId: String(msg.sender_id ?? msg.senderId ?? ''),
            receiverId: String(msg.receiver_id ?? msg.receiverId ?? otherUserId ?? ''),
            timestamp: msg.created_at ?? msg.timestamp ?? new Date().toISOString(),
            status: undefined as MessageStatus | undefined,
            isPlaceholder: false,
          };

          if (msg.isEncrypted && Array.isArray(msg.envelopes)) {
            const decrypted = await CryptoService.decryptMessage(chatIdentifier, msg.envelopes);
            if (!decrypted) {
              continue;
            }

            normalisedMessages.push({
              ...baseMessage,
              content: decrypted,
              status:
                baseMessage.senderId === String(user?.id) ? 'delivered' : undefined,
            });
          } else {
            normalisedMessages.push({
              ...baseMessage,
              content: msg.content ?? '',
              status:
                baseMessage.senderId === String(user?.id) ? 'delivered' : undefined,
            });
          }
        }

        setMessagesAnimated(() => normalisedMessages);
        setActiveTimestampId(null);
        scrollToBottom();
      } catch (error) {
        console.error(`Error loading messages for chat ${chatIdentifier}:`, error);
        setMessagesAnimated(() => generatePlaceholderMessages(displayName));
      }
    },
    [generatePlaceholderMessages, scrollToBottom, setMessagesAnimated, user?.id]
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
      setTypingUserLabel(displayName);

      try {
        await CryptoService.ensureIdentity(token);
      } catch (cryptoError) {
        console.error('Failed to ensure E2EE identity before loading messages:', cryptoError);
      }

      await loadMessagesForChat(token, chatId, displayName, otherParticipantId);
    } catch (error) {
      console.error(`Error loading chat ${chatId}:`, error);
      const fallbackName = receiverNameRef.current === 'Loading…' ? 'your friend' : receiverNameRef.current;
      setMessagesAnimated(() => generatePlaceholderMessages(fallbackName));
    } finally {
      setIsThreadLoading(false);
    }
  }, [
    chatId,
    user?.id,
    loadMessagesForChat,
    generatePlaceholderMessages,
    setMessagesAnimated,
  ]);

  const toggleTimestamp = useCallback((messageId: string) => {
    setActiveTimestampId((prev) => (prev === messageId ? null : messageId));
  }, []);

  const applyAckToLatestMessage = useCallback(
    (incoming: { messageId?: string | number; createdAt?: string }) => {
      const currentUserId = user?.id ? String(user.id) : null;
      if (!currentUserId) {
        return;
      }

      setMessagesAnimated((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i -= 1) {
          const msg = next[i];
          if (msg.senderId === currentUserId && msg.status && msg.status !== 'delivered' && !msg.isPlaceholder) {
            next[i] = {
              ...msg,
              id: incoming.messageId ? String(incoming.messageId) : msg.id,
              status: 'delivered',
              timestamp: incoming.createdAt ?? msg.timestamp,
            };
            break;
          }
        }
        return next;
      });
    },
    [setMessagesAnimated, user?.id]
  );

  const handleIncomingMessage = useCallback(
    async (message: WebSocketMessage) => {
      if (!chatId) {
        return;
      }

      const payload: any = message;
      const targetChatId = String(payload.chatId ?? payload.data?.chatId ?? '');

      if (message.type === 'typing') {
        const incomingChatId = String(payload.chatId ?? '');
        const fromUser = payload.userId ? String(payload.userId) : payload.senderId ? String(payload.senderId) : '';
        if (incomingChatId === chatId && fromUser && fromUser !== String(user?.id)) {
          setTypingUserLabel(payload.username || receiverNameRef.current || 'Someone');
          setIsRemoteTyping(Boolean(payload.isTyping));
          if (remoteTypingTimeoutRef.current) {
            clearTimeout(remoteTypingTimeoutRef.current);
          }
          if (payload.isTyping) {
            remoteTypingTimeoutRef.current = setTimeout(() => setIsRemoteTyping(false), 2500);
          }
        }
        return;
      }

      if (!targetChatId || targetChatId !== chatId) {
        return;
      }

      if (message.type === 'message_envelope_sent') {
        applyAckToLatestMessage({
          messageId: payload.messageId ?? payload.id,
          createdAt: payload.created_at ?? payload.timestamp,
        });
        return;
      }

      if (message.type === 'message_envelope') {
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
            status: undefined,
          };

          setIsRemoteTyping(false);
          setMessagesAnimated((prev) => {
            const withoutPlaceholders = prev.filter((msg) => !msg.isPlaceholder);
            const exists = withoutPlaceholders.some((msg) => msg.id === newEntry.id);
            if (exists) {
              return withoutPlaceholders;
            }
            return [...withoutPlaceholders, newEntry];
          });
          setActiveTimestampId(null);
          scrollToBottom();
        } catch (error) {
          console.error('Failed to decrypt incoming message envelope:', error);
        }
        return;
      }

      if (message.type === 'new_message') {
        const newEntry: Message = {
          id: String(payload.messageId ?? payload.id ?? Date.now()),
          senderId: String(payload.senderId ?? ''),
          receiverId: String(payload.receiverId ?? otherUserIdRef.current ?? ''),
          content: payload.content ?? '',
          timestamp: payload.created_at ?? payload.timestamp ?? new Date().toISOString(),
          status: undefined,
        };

        setIsRemoteTyping(false);
        setMessagesAnimated((prev) => {
          const withoutPlaceholders = prev.filter((msg) => !msg.isPlaceholder);
          if (withoutPlaceholders.some((msg) => msg.id === newEntry.id)) {
            return withoutPlaceholders;
          }
          return [...withoutPlaceholders, newEntry];
        });
        setActiveTimestampId(null);
        scrollToBottom();
      }
    },
    [
      applyAckToLatestMessage,
      chatId,
      scrollToBottom,
      setMessagesAnimated,
      user?.id,
    ]
  );

  const ensureTypingStopped = useCallback(() => {
    if (!chatId) {
      return;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (typingStateRef.current.isTyping) {
      typingStateRef.current.isTyping = false;
      wsService.sendTyping(chatId, false);
    }
  }, [chatId, wsService]);

  const handleComposerChange = useCallback(
    (value: string) => {
      setNewMessage(value);
      if (!chatId) {
        return;
      }

      if (!typingStateRef.current.isTyping) {
        typingStateRef.current.isTyping = true;
        wsService.sendTyping(chatId, true);
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        typingStateRef.current.isTyping = false;
        wsService.sendTyping(chatId, false);
      }, 1500);
    },
    [chatId, wsService]
  );

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
      status: 'sent',
    };

    setMessagesAnimated((prev) => {
      const withoutPlaceholders = prev.filter((msg) => !msg.isPlaceholder);
      return [...withoutPlaceholders, optimisticMessage];
    });
    scrollToBottom();
    setActiveTimestampId(null);
    setNewMessage('');
    setIsSendingMessage(true);
    ensureTypingStopped();

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
      setMessagesAnimated((prev) => prev.filter((msg) => msg.id !== temporaryId));
      setNewMessage(trimmedMessage);
    } finally {
      setIsSendingMessage(false);
    }
  }, [
    newMessage,
    user?.id,
    chatId,
    ensureTypingStopped,
    scrollToBottom,
    setMessagesAnimated,
    wsService,
  ]);

  useEffect(() => {
    if (!user?.id || !chatId) {
      return;
    }
    loadChatDetails();
  }, [user?.id, chatId, loadChatDetails]);

  useEffect(() => {
    DeviceService.getOrCreateDeviceId()
      .then((id) => {
        deviceIdRef.current = id;
        if (chatId) {
          wsService.joinChat(chatId, id);
        }
      })
      .catch((error) => console.error('Failed to resolve device ID for chat join:', error));

    return () => {
      if (chatId) {
        wsService.leaveChat(chatId);
      }
    };
  }, [chatId, wsService]);

  useEffect(() => {
    wsService.connect().catch((error) => console.error('Failed to ensure WebSocket connection for chat screen:', error));
    const unsubscribe = wsService.addMessageListener(handleIncomingMessage);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      ensureTypingStopped();
      if (remoteTypingTimeoutRef.current) {
        clearTimeout(remoteTypingTimeoutRef.current);
      }
    };
  }, [wsService, handleIncomingMessage, ensureTypingStopped]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  const renderChatItem = useCallback(
    ({ item, index }: { item: ChatListItem; index: number }) => {
      if (item.kind === 'date') {
        return (
          <View style={styles.dateDivider}>
            <View style={styles.dateDividerLine} />
            <Text style={styles.dateDividerText}>{item.label}</Text>
            <View style={styles.dateDividerLine} />
          </View>
        );
      }

      if (item.kind === 'typing') {
        return <TypingIndicator label={typingUserLabel} />;
      }

      const messageItem = item.message;
      const previousMessage = (() => {
        for (let i = index - 1; i >= 0; i -= 1) {
          if (decoratedData[i]?.kind === 'message') {
            return decoratedData[i].message;
          }
        }
        return null;
      })();

      const nextMessage = (() => {
        for (let i = index + 1; i < decoratedData.length; i += 1) {
          if (decoratedData[i]?.kind === 'message') {
            return decoratedData[i].message;
          }
        }
        return null;
      })();

      const isMine = user?.id != null && messageItem.senderId === String(user.id);
      const isFirstInGroup =
        !previousMessage || previousMessage.senderId !== messageItem.senderId || previousMessage.isPlaceholder;
      const isLastInGroup =
        !nextMessage || nextMessage.senderId !== messageItem.senderId || nextMessage.isPlaceholder;

      return (
        <MessageBubble
          key={messageItem.id}
          message={messageItem}
          isMine={Boolean(isMine)}
          isFirstInGroup={isFirstInGroup}
          isLastInGroup={isLastInGroup}
          showTimestamp={activeTimestampId === messageItem.id}
          onToggleTimestamp={toggleTimestamp}
        />
      );
    },
    [activeTimestampId, decoratedData, toggleTimestamp, typingUserLabel, user?.id]
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
        <Text style={styles.headerTitle} numberOfLines={1}>{receiverUsername}</Text>
        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            data={decoratedData}
            keyExtractor={(item) => item.id}
            renderItem={renderChatItem}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={scrollToBottom}
          />
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={newMessage}
            onChangeText={handleComposerChange}
            placeholder="Message…"
            placeholderTextColor="rgba(255, 255, 255, 0.45)"
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
              <Ionicons name="send" size={22} color="#ffffff" />
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
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
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
  messageRow: {
    marginBottom: 2,
    maxWidth: '82%',
  },
  messageRowStacked: {
    marginTop: 2,
  },
  messageRowMine: {
    alignSelf: 'flex-end',
  },
  messageRowTheirs: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },
  myBubble: {
    backgroundColor: '#1F86FF',
    borderBottomRightRadius: 6,
  },
  myBubbleStacked: {
    borderBottomRightRadius: 6,
    borderTopRightRadius: 6,
    marginTop: 2,
  },
  myBubbleLast: {
    borderBottomRightRadius: 22,
  },
  theirBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomLeftRadius: 6,
  },
  theirBubbleStacked: {
    borderBottomLeftRadius: 6,
    borderTopLeftRadius: 6,
    marginTop: 2,
  },
  theirBubbleLast: {
    borderBottomLeftRadius: 22,
  },
  placeholderBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  senderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.72)',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#ffffff',
  },
  placeholderText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
  },
  statusLabelText: {
    marginTop: 6,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'right',
  },
  timestampPill: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(10, 15, 28, 0.85)',
    borderRadius: 14,
  },
  timestampText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(4, 8, 18, 0.72)',
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: 'white',
    maxHeight: 140,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: '#0EA5FF',
    borderRadius: 20,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0EA5FF',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 14,
    gap: 8,
  },
  dateDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  dateDividerText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    fontWeight: '500',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 12,
    gap: 10,
  },
  typingBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 6,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  typingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default ChatScreen;
