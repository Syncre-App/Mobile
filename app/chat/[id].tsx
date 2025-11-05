import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  InteractionManager,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { TapGestureHandler } from 'react-native-gesture-handler';

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
  status?: MessageStatus;
  isPlaceholder?: boolean;
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

const formatStatusLabel = (status: MessageStatus, timestamp: string) => {
  const label = status === 'sending'
    ? 'Sending…'
    : status.charAt(0).toUpperCase() + status.slice(1);

  if (status === 'sending') {
    return label;
  }

  const date = parseDate(timestamp);
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);

  const timePart = timeFormatter.format(date);

  if (diffDays === 0) {
    return `${label} • ${timePart}`;
  }

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: today.getFullYear() === date.getFullYear() ? undefined : 'numeric',
  });

  return `${label} • ${dateFormatter.format(date)} ${timePart}`;
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
          // eslint-disable-next-line react/no-array-index-key
          <Animated.View
            key={index}
            style={[
              styles.typingDot,
              {
                opacity: value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.35, 1],
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
      <Text style={styles.typingText}>{`${label} is typing…`}</Text>
    </View>
  );
};

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  showStatus: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMine,
  isFirstInGroup,
  isLastInGroup,
  showStatus,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const statusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    Animated.timing(statusAnim, {
      toValue: showStatus ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showStatus, statusAnim]);

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

  const statusText =
    showStatus && message.status
      ? formatStatusLabel(message.status, message.timestamp)
      : null;

  return (
    <Animated.View style={[containerStyle, { opacity: fadeAnim }]}>
      <View style={bubbleStyle}>
        <Text style={[styles.messageText, message.isPlaceholder && styles.placeholderText]}>
          {message.content}
        </Text>
      </View>
      {statusText && (
        <Animated.View style={[
          styles.statusPill, 
          {
            opacity: statusAnim,
            transform: [
              { 
                scale: statusAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                })
              },
              {
                translateY: statusAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                })
              }
            ]
          }
        ]}>
          <Text style={styles.statusText}>{statusText}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
};

const ChatScreen: React.FC = () => {
  const { id } = useLocalSearchParams();
  const chatId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const wsService = useMemo(() => WebSocketService.getInstance(), []);
  const flatListRef = useRef<FlatList<ChatListItem>>(null);

  const receiverNameRef = useRef('Loading…');
  const otherUserIdRef = useRef<string | null>(null);
  const participantIdsRef = useRef<string[]>([]);
  const authTokenRef = useRef<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const nextCursorRef = useRef<string | null>(null);
  const topVisibleIdRef = useRef<string | null>(null);
  const pendingScrollIdRef = useRef<string | null>(null);
  const lastSeenMessageIdRef = useRef<string | null>(null);
  const typingStateRef = useRef<{ isTyping: boolean }>({ isTyping: false });
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const remoteTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadCompleteRef = useRef(false);
  const tapGestureRef = useRef(null);
  const isNearTopRef = useRef(false);
  const isNearBottomRef = useRef(true);

  const [receiverUsername, setReceiverUsername] = useState<string>('Loading…');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isThreadLoading, setIsThreadLoading] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isRemoteTyping, setIsRemoteTyping] = useState(false);
  const [typingUserLabel, setTypingUserLabel] = useState<string>('Someone');
  const [statusVisibleFor, setStatusVisibleFor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);

  const currentUserId = user?.id ? String(user.id) : null;

  const setMessagesWithoutAnimation = useCallback(
    (updater: (prev: Message[]) => Message[]) => {
      setMessages((prev) => updater(prev));
    },
    []
  );

  const setMessagesAnimated = useCallback(
    (updater: (prev: Message[]) => Message[]) => {
      layoutNext();
      setMessages((prev) => updater(prev));
    },
    []
  );

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
    });
  }, []);

  const decoratedData = useMemo<ChatListItem[]>(() => {
    const items: ChatListItem[] = [];
    if (!messages.length && !isRemoteTyping) {
      return items;
    }

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

      items.push({ kind: 'message', id: message.id, message });
    });

    if (isRemoteTyping) {
      items.push({ kind: 'typing', id: 'typing-indicator' });
    }

    return items;
  }, [messages, isRemoteTyping]);

  const lastOutgoingMessageId = useMemo(() => {
    if (!currentUserId) {
      return null;
    }
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (!message.isPlaceholder && message.senderId === currentUserId) {
        return message.id;
      }
    }
    return null;
  }, [messages, currentUserId]);

  const transformMessages = useCallback(
    async (rawMessages: any[], otherUserId: string | null) => {
      const results: Message[] = [];
      const ownerId = currentUserId;

      for (const raw of rawMessages) {
        const idValue = raw.id ?? `${chatId}-${raw.createdAt ?? raw.created_at ?? Date.now()}`;
        const senderId = raw.senderId ?? raw.sender_id;
        if (!senderId) {
          continue;
        }

        const receiverId =
          raw.receiverId ??
          raw.receiver_id ??
          otherUserId ??
          (participantIdsRef.current.find((pid) => pid !== String(senderId)) ?? '');

        const timestamp = raw.createdAt ?? raw.created_at ?? new Date().toISOString();

        let content: string | null = null;
        if (raw.isEncrypted && Array.isArray(raw.envelopes)) {
          if (!chatId) {
            continue;
          }
          const decrypted = await CryptoService.decryptMessage(String(chatId), raw.envelopes);
          if (decrypted) {
            content = decrypted;
          }
        } else {
          content = raw.content ?? '';
        }

        if (content == null) {
          continue;
        }

        let status: MessageStatus | undefined;
        if (ownerId && String(senderId) === ownerId) {
          if (raw.seenAt) {
            status = 'seen';
          } else if (raw.deliveredAt) {
            status = 'delivered';
          } else {
            status = 'sent';
          }
        }

        results.push({
          id: String(idValue),
          senderId: String(senderId),
          receiverId: String(receiverId),
          content,
          timestamp: String(timestamp),
          status,
        });
      }

      return results;
    },
    [chatId, currentUserId]
  );

  const generatePlaceholderMessages = useCallback(
    (displayName: string) => {
      const friendlyName = displayName || 'your friend';
      const now = Date.now();
      return [
        {
          id: 'placeholder-1',
          senderId: 'friend',
          receiverId: String(currentUserId ?? 'me'),
          content: `👋 ${friendlyName} hasn't sent any messages yet, but this space is ready when they do.`,
          timestamp: new Date(now - 60_000).toISOString(),
          isPlaceholder: true,
        },
        {
          id: 'placeholder-2',
          senderId: String(currentUserId ?? 'me'),
          receiverId: 'friend',
          content: 'Start the conversation with a quick hello!',
          timestamp: new Date(now - 30_000).toISOString(),
          isPlaceholder: true,
        },
      ] as Message[];
    },
    [currentUserId]
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

  const updateOutgoingStatus = useCallback(
    (status: MessageStatus, messageId?: string, timestamp?: string | null) => {
      if (!currentUserId) {
        return;
      }

      setMessagesAnimated((prev) => {
        let targetFound = false;
        const next = prev.map((msg, index) => {
          if (msg.senderId !== currentUserId || msg.isPlaceholder) {
            return msg;
          }

          if (messageId) {
            if (msg.id === String(messageId)) {
              targetFound = true;
              return { ...msg, status, timestamp: timestamp ?? msg.timestamp };
            }
            return { ...msg, status: undefined };
          }

          if (index === prev.length - 1) {
            targetFound = true;
            return { ...msg, status, timestamp: timestamp ?? msg.timestamp };
          }

          return { ...msg, status: undefined };
        });

        if (messageId && !targetFound) {
          return prev;
        }

        return next;
      });
    },
    [currentUserId, setMessagesAnimated]
  );

  const applyAckToLatestMessage = useCallback(
    (incoming: { messageId?: string | number; createdAt?: string }) => {
      if (!currentUserId || !incoming?.messageId) {
        return;
      }
      const messageId = String(incoming.messageId);

      setMessagesAnimated((prev) => {
        const next = [...prev];
        let updated = false;
        for (let i = next.length - 1; i >= 0; i -= 1) {
          const message = next[i];
          if (message.senderId === currentUserId && !message.isPlaceholder) {
            next[i] = {
              ...message,
              id: messageId,
              status: 'sent',
              timestamp: incoming.createdAt ?? message.timestamp,
            };
            updated = true;
            break;
          }
        }

        if (!updated) {
          return prev;
        }

        return next.map((msg) => {
          if (msg.senderId === currentUserId && msg.id !== messageId) {
            return { ...msg, status: undefined };
          }
          return msg;
        });
      });
    },
    [currentUserId, setMessagesAnimated]
  );

  const sendSeenReceipt = useCallback(
    (messageId: string) => {
      if (!chatId || !messageId) {
        return;
      }
      if (lastSeenMessageIdRef.current === messageId) {
        return;
      }
      wsService.send({
        type: 'message_seen',
        chatId,
        messageId,
      });
      lastSeenMessageIdRef.current = messageId;
    },
    [chatId, wsService]
  );

  const loadMessagesForChat = useCallback(
    async (token: string, chatIdentifier: string, displayName: string, otherUserId?: string | null) => {
      try {
        const deviceIdentifier = deviceIdRef.current;
        const params = new URLSearchParams();
        params.set('limit', '20');
        if (deviceIdentifier) {
          params.set('deviceId', deviceIdentifier);
        }

        const response = await ApiService.get(`/chat/${chatIdentifier}/messages?${params.toString()}`, token);
        const rawMessages = response.success && Array.isArray(response.data?.messages) ? response.data.messages : [];

        if (!rawMessages.length) {
          setMessagesAnimated(() => generatePlaceholderMessages(displayName));
          setHasMore(false);
          nextCursorRef.current = null;
          initialLoadCompleteRef.current = true;
          return;
        }

        const transformed = await transformMessages(rawMessages, otherUserId ?? null);
        const cleaned = transformed.filter(Boolean);

        setMessagesAnimated(() => cleaned);
        lastSeenMessageIdRef.current = null;
        setHasMore(response.data?.hasMore ?? false);
        nextCursorRef.current = response.data?.nextCursor || null;
        initialLoadCompleteRef.current = true;
        InteractionManager.runAfterInteractions(() => {
          scrollToBottom();
        });
      } catch (error) {
        console.error(`Error loading messages for chat ${chatIdentifier}:`, error);
        setMessagesAnimated(() => generatePlaceholderMessages(displayName));
        setHasMore(false);
        nextCursorRef.current = null;
        lastSeenMessageIdRef.current = null;
        initialLoadCompleteRef.current = true;
      }
    },
    [generatePlaceholderMessages, scrollToBottom, setMessagesAnimated, transformMessages]
  );

  const loadChatDetails = useCallback(async () => {
    if (!chatId || !currentUserId) {
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
      setHasMore(false);
      nextCursorRef.current = null;
      lastSeenMessageIdRef.current = null;
      initialLoadCompleteRef.current = true;
    } finally {
      setIsThreadLoading(false);
    }
  }, [
    chatId,
    currentUserId,
    generatePlaceholderMessages,
    loadMessagesForChat,
    setMessagesAnimated,
  ]);

  const loadEarlier = useCallback(
    async (options: { viaRefresh?: boolean } = {}) => {
      const { viaRefresh = false } = options;
      if (!chatId || isLoadingMore || !hasMore) {
        if (viaRefresh) {
          setIsRefreshing(false);
        }
        return;
      }
      const token = authTokenRef.current ?? (await StorageService.getAuthToken());
      if (!token) {
        if (viaRefresh) {
          setIsRefreshing(false);
        }
        return;
      }
      authTokenRef.current = token;
      if (!nextCursorRef.current) {
        if (viaRefresh) {
          setIsRefreshing(false);
        }
        return;
      }

      setIsLoadingMore(true);
      if (viaRefresh) {
        setIsRefreshing(true);
      }
      pendingScrollIdRef.current = topVisibleIdRef.current;

      try {
        const params = new URLSearchParams();
        params.set('limit', '20');
        params.set('before', nextCursorRef.current);
        if (deviceIdRef.current) {
          params.set('deviceId', deviceIdRef.current);
        }

        const response = await ApiService.get(`/chat/${chatId}/messages?${params.toString()}`, token);
        const rawMessages = response.success && Array.isArray(response.data?.messages) ? response.data.messages : [];
        if (!rawMessages.length) {
          setHasMore(false);
          return;
        }

        const transformed = await transformMessages(rawMessages, otherUserIdRef.current);
        const cleaned = transformed.filter(Boolean);

        setMessagesWithoutAnimation((prev) => {
          const existingIds = new Set(prev.map((msg) => msg.id));
          const filtered = cleaned.filter((msg) => !existingIds.has(msg.id));
          if (!filtered.length) {
            return prev;
          }
          return [...filtered, ...prev];
        });

        setHasMore(response.data?.hasMore ?? false);
        nextCursorRef.current = response.data?.nextCursor || null;
      } catch (error) {
        console.error('Failed to load earlier messages:', error);
      } finally {
        setIsLoadingMore(false);
        if (viaRefresh) {
          setIsRefreshing(false);
        }
        isNearTopRef.current = false;
      }
    },
    [chatId, hasMore, isLoadingMore, messages, setMessagesAnimated, transformMessages]
  );

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
    if (!newMessage.trim() || !currentUserId || !chatId) {
      return;
    }

    const trimmedMessage = newMessage.trim();
    const temporaryId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: temporaryId,
      senderId: currentUserId,
      receiverId: String(otherUserIdRef.current ?? ''),
      content: trimmedMessage,
      timestamp: new Date().toISOString(),
      status: 'sending',
    };

    setMessagesAnimated((prev) => {
      const cleared = prev.map((msg) =>
        msg.senderId === currentUserId ? { ...msg, status: undefined } : msg
      );
      const withoutPlaceholders = cleared.filter((msg) => !msg.isPlaceholder);
      return [...withoutPlaceholders, optimisticMessage];
    });
    InteractionManager.runAfterInteractions(() => {
      scrollToBottom();
    });
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
        .filter((participantId) => participantId !== currentUserId)
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
        currentUserId,
      });

      wsService.send({
        type: 'message_send',
        chatId,
        envelopes: encryptedPayload.envelopes,
        senderDeviceId: encryptedPayload.senderDeviceId,
        messageType: 'e2ee',
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
    chatId,
    currentUserId,
    ensureTypingStopped,
    newMessage,
    scrollToBottom,
    setMessagesAnimated,
    wsService,
  ]);

  const handleIncomingMessage = useCallback(
    async (message: WebSocketMessage) => {
      if (!chatId) {
        return;
      }

      const payload: any = message;
      const targetChatId = String(payload.chatId ?? payload.data?.chatId ?? '');
      if (targetChatId && targetChatId !== chatId) {
        return;
      }

      switch (message.type) {
        case 'message_status': {
          const status = payload.status as MessageStatus | undefined;
          if (!status) {
            return;
          }
          const statusTimestamp = payload.timestamp || payload.deliveredAt || payload.seenAt || null;
          updateOutgoingStatus(
            status,
            payload.messageId ? String(payload.messageId) : undefined,
            statusTimestamp
          );
          return;
        }
        case 'message_envelope_sent': {
          applyAckToLatestMessage({
            messageId: payload.messageId ?? payload.id,
            createdAt: payload.created_at ?? payload.timestamp,
          });
          return;
        }
        case 'typing': {
          const fromUser = payload.userId ? String(payload.userId) : payload.senderId ? String(payload.senderId) : '';
          if (fromUser && fromUser !== currentUserId) {
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
        case 'message_envelope': {
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

            setIsRemoteTyping(false);
            setMessagesAnimated((prev) => {
              const withoutPlaceholders = prev.filter((msg) => !msg.isPlaceholder);
              const exists = withoutPlaceholders.some((msg) => msg.id === newEntry.id);
              if (exists) {
                return withoutPlaceholders;
              }
              return [...withoutPlaceholders, newEntry];
            });
            scrollToBottom();
          } catch (error) {
            console.error('Failed to decrypt incoming message envelope:', error);
          }
          return;
        }
        case 'new_message': {
          const newEntry: Message = {
            id: String(payload.messageId ?? payload.id ?? Date.now()),
            senderId: String(payload.senderId ?? ''),
            receiverId: String(payload.receiverId ?? otherUserIdRef.current ?? ''),
            content: payload.content ?? '',
            timestamp: payload.created_at ?? payload.timestamp ?? new Date().toISOString(),
          };

          setIsRemoteTyping(false);
          setMessagesAnimated((prev) => {
            const withoutPlaceholders = prev.filter((msg) => !msg.isPlaceholder);
            if (withoutPlaceholders.some((msg) => msg.id === newEntry.id)) {
              return withoutPlaceholders;
            }
            return [...withoutPlaceholders, newEntry];
          });
          scrollToBottom();
          return;
        }
        default:
          break;
      }
    },
    [
      applyAckToLatestMessage,
      chatId,
      currentUserId,
      scrollToBottom,
      setMessagesAnimated,
      updateOutgoingStatus,
    ]
  );

  const handleRefresh = useCallback(() => {
    if (!hasMore || isLoadingMore || isRefreshing) {
      setIsRefreshing(false);
      return;
    }
    setIsRefreshing(true);
    loadEarlier({ viaRefresh: true }).catch((error) => {
      console.error('Failed to refresh earlier messages:', error);
      setIsRefreshing(false);
      isNearTopRef.current = false;
    });
  }, [hasMore, isLoadingMore, isRefreshing, loadEarlier]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!initialLoadCompleteRef.current) {
        return;
      }
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const hasScrollableContent = contentSize.height > layoutMeasurement.height + 40;
      if (!hasScrollableContent) {
        isNearTopRef.current = false;
        return;
      }
      const nearTop = contentOffset.y <= 18;

      if (nearTop && !isNearTopRef.current) {
        isNearTopRef.current = true;
        if (!isLoadingMore && !isRefreshing && hasMore) {
          loadEarlier().catch((err) => {
            console.error('Failed to load earlier messages (scroll):', err);
            isNearTopRef.current = false;
          });
        }
      } else if (!nearTop) {
        isNearTopRef.current = false;
      }

      const nearBottom = contentSize.height - layoutMeasurement.height - contentOffset.y <= 20;

      if (nearBottom && !isNearBottomRef.current) {
        isNearBottomRef.current = true;
        if (showScrollToBottomButton) {
          setShowScrollToBottomButton(false);
        }
      } else if (!nearBottom && isNearBottomRef.current) {
        isNearBottomRef.current = false;
        if (!showScrollToBottomButton) {
          setShowScrollToBottomButton(true);
        }
      }
    },
    [hasMore, isLoadingMore, isRefreshing, loadEarlier, showScrollToBottomButton]
  );



  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index?: number; item: ChatListItem }> }) => {
      if (!viewableItems.length) {
        return;
      }
      const earliest = viewableItems.reduce((previous, current) => {
        if (previous.index == null) {
          return current;
        }
        if (current.index == null) {
          return previous;
        }
        return current.index < previous.index ? current : previous;
      });
      if (earliest?.item?.id) {
        topVisibleIdRef.current = earliest.item.id;
      }
    }
  ).current;

  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 60,
  });

  useEffect(() => {
    if (initialLoadCompleteRef.current && messages.length > 0) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!user?.id || !chatId) {
      return;
    }
    initialLoadCompleteRef.current = false;
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
  }, [ensureTypingStopped, handleIncomingMessage, wsService]);

  useEffect(() => {
    if (!messages.length || !currentUserId) {
      return;
    }

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.isPlaceholder) {
        continue;
      }

      if (message.senderId !== currentUserId) {
        sendSeenReceipt(message.id);
        break;
      }
    }
  }, [messages, currentUserId, sendSeenReceipt]);

  useEffect(() => {
    if (!pendingScrollIdRef.current) {
      return;
    }
    const targetId = pendingScrollIdRef.current;
    const index = decoratedData.findIndex((item) => item.id === targetId);
    if (index >= 0) {
      requestAnimationFrame(() => {
        try {
          flatListRef.current?.scrollToIndex({ index, animated: false });
        } catch (error) {
          const fallbackOffset = index * 60; // approximate row height
          flatListRef.current?.scrollToOffset({ offset: fallbackOffset, animated: false });
        }
        pendingScrollIdRef.current = null;
      });
    } else {
      pendingScrollIdRef.current = null;
    }
  }, [decoratedData]);

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
          const prevItem = decoratedData[i];
          if (prevItem?.kind === 'message') {
            return prevItem.message;
          }
        }
        return null;
      })();

      const nextMessage = (() => {
        for (let i = index + 1; i < decoratedData.length; i += 1) {
          const nextItem = decoratedData[i];
          if (nextItem?.kind === 'message') {
            return nextItem.message;
          }
        }
        return null;
      })();

      const isMine = Boolean(currentUserId && messageItem.senderId === currentUserId);
      const isFirstInGroup =
        !previousMessage || previousMessage.senderId !== messageItem.senderId || previousMessage.isPlaceholder;
      const isLastInGroup =
        !nextMessage || nextMessage.senderId !== messageItem.senderId || nextMessage.isPlaceholder;

      const shouldShowStatus = statusVisibleFor === messageItem.id && isMine && Boolean(messageItem.status);

      return (
        <TouchableOpacity onPress={() => setStatusVisibleFor(prev => prev === messageItem.id ? null : messageItem.id)} activeOpacity={0.8}>
          <MessageBubble
            key={messageItem.id}
            message={messageItem}
            isMine={isMine}
            isFirstInGroup={isFirstInGroup}
            isLastInGroup={isLastInGroup}
            showStatus={shouldShowStatus}
          />
        </TouchableOpacity>
      );
    },
    [currentUserId, decoratedData, lastOutgoingMessageId, statusVisibleFor, typingUserLabel]
  );

  const listHeader = useMemo(
    () =>
      isLoadingMore ? (
        <View style={styles.loadMoreSpinner} />
      ) : (
        <View style={styles.loadMoreSpacer} />
      ),
    [isLoadingMore]
  );

  if (!chatId) {
    return (
      <SafeAreaView style={styles.fallbackContainer}>
        <Text style={styles.fallbackText}>Unable to open this chat.</Text>
      </SafeAreaView>
    );
  }

  const isComposerEmpty = newMessage.trim().length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Stack.Screen options={{ title: receiverUsername }} />

      <View style={styles.backgroundOverlay} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {receiverUsername}
        </Text>
        <View style={styles.headerButtonPlaceholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {isThreadLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#2C82FF" />
            <Text style={styles.loadingStateText}>Loading conversation…</Text>
          </View>
        ) : (
          <Animated.View style={styles.messagesWrapper}>
            <FlatList
              ref={flatListRef}
              data={decoratedData}
              keyExtractor={(item) => item.id}
              renderItem={renderChatItem}
              contentContainerStyle={styles.messageList}
              ListHeaderComponent={listHeader}
              keyboardShouldPersistTaps="handled"
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfigRef.current}
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
                autoscrollToTopThreshold: 80,
              }}
              refreshControl={
                <RefreshControl
                  tintColor="#2C82FF"
                  titleColor="#2C82FF"
                  progressViewOffset={80}
                  refreshing={isRefreshing}
                                      onRefresh={handleRefresh}
                                    />
                                  }            />
            {showScrollToBottomButton && (
              <TouchableOpacity
                style={styles.scrollToBottomButton}
                onPress={scrollToBottom}
                accessibilityRole="button"
              >
                <Ionicons name="arrow-down" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        <View style={[styles.inputContainer, { paddingBottom: insets.bottom }]}>
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
            style={[
              styles.sendButton,
              !isComposerEmpty && styles.sendButtonActive,
              isSendingMessage && styles.sendButtonDisabled,
            ]}
            disabled={isComposerEmpty || isSendingMessage}
            accessibilityRole="button"
          >
            {isSendingMessage ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="paper-plane" size={20} color="#ffffff" />
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
    backgroundColor: '#04070F',
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 4, 10, 0.95)',
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
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
    paddingBottom: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingStateText: {
    marginTop: 12,
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 15,
  },
  messagesWrapper: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  loadMoreSpinner: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadMoreSpacer: {
    height: 12,
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
    paddingHorizontal: 16,
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
    backgroundColor: '#1E84FF',
  },
  myBubbleStacked: {
    borderBottomRightRadius: 10,
  },
  myBubbleLast: {
    borderBottomRightRadius: 22,
  },
  theirBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  theirBubbleStacked: {
    borderBottomLeftRadius: 10,
  },
  theirBubbleLast: {
    borderBottomLeftRadius: 22,
  },
  placeholderBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  messageText: {
    fontSize: 16,
    color: '#ffffff',
    lineHeight: 22,
  },
  placeholderText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontStyle: 'italic',
  },
  statusPill: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(18, 34, 58, 0.85)',
  },
  statusText: {
    color: '#B6CAFF',
    fontSize: 12,
    fontWeight: '500',
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
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
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
    marginTop: 10,
    marginBottom: 14,
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
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(4, 9, 19, 0.85)',
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    maxHeight: 140,
    marginRight: 12,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  sendButtonActive: {
    backgroundColor: '#1E84FF',
    shadowColor: '#1E84FF',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatScreen;
