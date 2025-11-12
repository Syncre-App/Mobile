import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, DeviceEventEmitter, FlatList, Keyboard, KeyboardAvoidingView, LayoutAnimation, InteractionManager, Modal, PanResponder, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableWithoutFeedback, UIManager, View, NativeSyntheticEvent, NativeScrollEvent, Pressable } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { TapGestureHandler } from 'react-native-gesture-handler';

import { useAuth } from '../../hooks/useAuth';
import { ApiService } from '../../services/ApiService';
import { NotificationService } from '../../services/NotificationService';
import { StorageService } from '../../services/StorageService';
import { CryptoService } from '../../services/CryptoService';
import { DeviceService } from '../../services/DeviceService';
import { WebSocketMessage, WebSocketService } from '../../services/WebSocketService';
import { UserCacheService } from '../../services/UserCacheService';
import { TimezoneService } from '../../services/TimezoneService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'seen';

interface ReplyMetadata {
  messageId: string;
  senderId: string;
  senderLabel?: string;
  preview?: string;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  utcTimestamp?: string;
  timezone?: string;
  deliveredAt?: string;
  seenAt?: string;
  status?: MessageStatus;
  isPlaceholder?: boolean;
  replyTo?: ReplyMetadata;
}

type ChatListItem =
  | { kind: 'message'; id: string; message: Message }
  | { kind: 'date'; id: string; label: string }
  | { kind: 'typing'; id: string };

const MESSAGE_PAYLOAD_VERSION = 1;

const normalizePreviewText = (value: string): string => {
  if (!value) {
    return '';
  }
  const condensed = value.replace(/\s+/g, ' ').trim();
  if (condensed.length > 140) {
    return `${condensed.slice(0, 140)}…`;
  }
  return condensed;
};

const sanitizeReplyMetadata = (raw: any): ReplyMetadata | undefined => {
  if (!raw) {
    return undefined;
  }
  const replyId = raw.messageId ?? raw.id;
  const replySenderId = raw.senderId ?? raw.sender_id;
  if (!replyId || !replySenderId) {
    return undefined;
  }
  const preview =
    typeof raw.preview === 'string' && raw.preview.trim().length
      ? raw.preview
      : undefined;
  const senderLabel =
    typeof raw.senderLabel === 'string' && raw.senderLabel.trim().length
      ? raw.senderLabel
      : undefined;

  return {
    messageId: String(replyId),
    senderId: String(replySenderId),
    senderLabel,
    preview,
  };
};

const encodeMessagePayload = (text: string, replyTo?: ReplyMetadata | null): string => {
  const payload: Record<string, any> = {
    v: MESSAGE_PAYLOAD_VERSION,
    text,
  };
  if (replyTo) {
    payload.replyTo = {
      messageId: replyTo.messageId,
      senderId: replyTo.senderId,
      senderLabel: replyTo.senderLabel,
      preview: replyTo.preview,
    };
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return text;
  }
};

const decodeMessagePayload = (raw: string): { text: string; replyTo?: ReplyMetadata } => {
  if (typeof raw !== 'string') {
    return { text: '' };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.text === 'string') {
      return {
        text: parsed.text,
        replyTo: sanitizeReplyMetadata(parsed.replyTo),
      };
    }
  } catch {
    // swallow JSON parse errors and treat as plain text
  }
  return { text: raw };
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const normalizeTimestampValue = (value?: string): string | undefined => {
  if (!value || typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed.replace(' ', 'T')}Z`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}Z`;
  }
  return trimmed;
};

const pickFirstTimestamp = (source: Record<string, any>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = source?.[key];
    const normalized = normalizeTimestampValue(value);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
};

const resolveMessageTimestamps = (
  source: Record<string, any>,
  fallbackTimezone: string
): { local: string; utc: string; timezone: string } => {
  const local =
    pickFirstTimestamp(source, [
      'createdAtLocal',
      'created_at_local',
      'timestampLocal',
      'timestamp',
      'createdAt',
      'created_at',
    ]) ?? new Date().toISOString();

  const utc =
    pickFirstTimestamp(source, [
      'createdAt',
      'created_at',
      'timestamp',
      'utcTimestamp',
      'createdAtUtc',
      'created_at_utc',
    ]) ?? local;

  const timezone = source?.timezone || fallbackTimezone;
  return { local, utc, timezone };
};

const resolveDeliveryTimestamp = (source: Record<string, any>): string | undefined =>
  pickFirstTimestamp(source, ['deliveredAtLocal', 'delivered_at_local', 'deliveredAt', 'delivered_at']);

const resolveSeenTimestamp = (source: Record<string, any>): string | undefined =>
  pickFirstTimestamp(source, ['seenAtLocal', 'seen_at_local', 'seenAt', 'seen_at']);

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

const formatStatusLabel = (status: MessageStatus): string => {
  switch (status) {
    case 'sending':
      return 'Sending...';
    case 'sent':
      return 'Sent';
    case 'delivered':
      return 'Delivered';
    case 'seen':
      return 'Seen';
    default:
      return '';
  }
};

const formatTimestamp = (date: Date): string => {
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return timeFormatter.format(date);
};

const MESSAGE_CHAR_LIMIT = 2000;
const REPLY_ACCENT = 'rgba(255, 255, 255, 0.25)';


const layoutNext = () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

const TypingIndicator: React.FC = () => {
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
    </View>
  );
};

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  showStatus: boolean;
  showTimestamp: boolean;
  onReplyPress?: (reply: ReplyMetadata) => void;
  onReplySwipe?: () => void;
  onOpenThread?: (messageId: string) => void;
  isHighlighted?: boolean;
  replyCount?: number;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMine,
  isFirstInGroup,
  isLastInGroup,
  showStatus,
  showTimestamp,
  onReplyPress,
  onReplySwipe,
  onOpenThread,
  isHighlighted = false,
  replyCount = 0,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > Math.abs(gesture.dy) && gesture.dx > 6,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx > 0) {
          swipeAnim.setValue(Math.min(gesture.dx, 80));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 60 && onReplySwipe) {
          onReplySwipe();
        }
        Animated.spring(swipeAnim, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(swipeAnim, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const containerStyle = [
    styles.messageRow,
    isMine ? styles.messageRowMine : styles.messageRowTheirs,
    !isFirstInGroup && styles.messageRowStacked,
    isLastInGroup ? styles.messageRowSpaced : styles.messageRowCompact,
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

  const replyHintOpacity = swipeAnim.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const statusText =
    showStatus && message.status
      ? formatStatusLabel(message.status)
      : null;

  return (
    <>
      {showTimestamp && (
        <View style={styles.timestampContainer}>
          <Text style={styles.timestampText}>
            {formatTimestamp(parseDate(message.timestamp))}
          </Text>
        </View>
      )}
      <Animated.View
        style={[
          containerStyle,
          { opacity: fadeAnim, transform: [{ translateX: swipeAnim }] },
        ]}
        {...panResponder.panHandlers}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.replyHint,
            isMine && styles.replyHintMine,
            { opacity: replyHintOpacity, transform: [{ scale: replyHintOpacity }] },
          ]}
        >
          <Ionicons name="return-down-back-outline" size={18} color="#ffffff" />
        </Animated.View>
        <View style={bubbleStyle}>
          {message.replyTo && (
            <Pressable
              onPress={() => onReplyPress?.(message.replyTo as ReplyMetadata)}
              style={[styles.replyChip, isMine && styles.replyChipMine]}
            >
              <View style={styles.replyChipBar} />
              <View style={styles.replyChipBody}>
                <Text style={styles.replyChipLabel} numberOfLines={1}>
                  {message.replyTo.senderLabel}
                </Text>
                {message.replyTo.preview ? (
                  <Text style={styles.replyChipText} numberOfLines={1}>
                    {message.replyTo.preview}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
          <Text style={[styles.messageText, message.isPlaceholder && styles.placeholderText]}>
            {message.content}
          </Text>
        </View>
        {statusText && (
          <Text style={styles.statusText}>{statusText}</Text>
        )}
        {replyCount > 0 && onOpenThread && (
          <Pressable
            style={[styles.threadSummaryButton, isMine && styles.threadSummaryButtonMine]}
            onPress={() => onOpenThread(message.id)}
          >
            <View style={styles.threadSummaryContent}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={14}
                color="rgba(255, 255, 255, 0.9)"
              />
              <Text style={styles.threadSummaryText}>
                {replyCount} {replyCount === 1 ? 'Reply' : 'Replies'}
              </Text>
            </View>
          </Pressable>
        )}
      </Animated.View>
    </>
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
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const markSeenInFlightRef = useRef(false);
  const missingEnvelopeRef = useRef(false);
  const reencryptRequestedRef = useRef(false);
  const requestReencrypt = useCallback(
    (reason: string) => {
      if (!chatId) {
        return;
      }
      const payload: WebSocketMessage = {
        type: 'request_reencrypt',
        chatId,
        reason,
        targetDeviceId: deviceIdRef.current || undefined,
      };
      wsService.send(payload);
      reencryptRequestedRef.current = true;
      missingEnvelopeRef.current = false;
    },
    [chatId, wsService]
  );
  const typingStateRef = useRef<{ isTyping: boolean }>({ isTyping: false });
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadCompleteRef = useRef(false);
  const tapGestureRef = useRef(null);
  const isNearTopRef = useRef(false);
  const isNearBottomRef = useRef(true);

  const [receiverUsername, setReceiverUsername] = useState<string>('Loading…');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isThreadLoading, setIsThreadLoading] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const composerRef = useRef<TextInput>(null);
  const [isRemoteTyping, setIsRemoteTyping] = useState(false);
  const [replyContext, setReplyContext] = useState<ReplyMetadata | null>(null);
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [typingUserLabel, setTypingUserLabel] = useState<string>('Someone');
  const [timestampVisibleFor, setTimestampVisibleFor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);

  const currentUserId = user?.id ? String(user.id) : null;

  const getReplyLabel = useCallback(
    (senderId: string) => {
      if (currentUserId && senderId === currentUserId) {
        return 'You';
      }
      return receiverNameRef.current || receiverUsername || 'Friend';
    },
    [currentUserId, receiverUsername]
  );

  const resolveReplyMetadata = useCallback(
    (metadata?: ReplyMetadata) => {
      if (!metadata) {
        return undefined;
      }
      const previewText = metadata.preview ? normalizePreviewText(metadata.preview) : undefined;
      return {
        messageId: metadata.messageId,
        senderId: metadata.senderId,
        senderLabel: metadata.senderLabel || getReplyLabel(metadata.senderId),
        preview: previewText || 'Message',
      };
    },
    [getReplyLabel]
  );

  const buildReplyPayloadFromMessage = useCallback(
    (message: Message): ReplyMetadata => ({
      messageId: message.id,
      senderId: message.senderId,
      senderLabel: getReplyLabel(message.senderId),
      preview: normalizePreviewText(message.content) || 'Message',
    }),
    [getReplyLabel]
  );

  const threadMessages = useMemo(() => {
    if (!threadRootId) {
      return [];
    }
    const root = messages.find((msg) => msg.id === threadRootId);
    const replies = messages.filter((msg) => msg.replyTo?.messageId === threadRootId);
    const sortedReplies = replies.slice().sort((a, b) => {
      const da = parseDate(a.timestamp).getTime();
      const db = parseDate(b.timestamp).getTime();
      return da - db;
    });
    return root ? [root, ...sortedReplies] : sortedReplies;
  }, [messages, threadRootId]);

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

    let lastDate: Date | null = null;
    messages.forEach((message) => {
      const messageDate = parseDate(message.timestamp);
      if (!lastDate || startOfDay(messageDate).getTime() !== startOfDay(lastDate).getTime()) {
        lastDate = messageDate;
        items.push({
          kind: 'date',
          id: `date-${messageDate.toISOString()}`,
          label: formatDateLabel(messageDate),
        });
      }
      items.push({ kind: 'message', id: message.id, message });
    });

    if (isRemoteTyping) {
      items.push({ kind: 'typing', id: 'typing-indicator' });
    }

    return items;
  }, [messages, isRemoteTyping]);

  const replyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    messages.forEach((msg) => {
      const targetId = msg.replyTo?.messageId;
      if (targetId) {
        counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
      }
    });
    return counts;
  }, [messages]);

  const scrollToMessageById = useCallback(
    (targetId: string) => {
      const index = decoratedData.findIndex((item) => item.kind === 'message' && item.message.id === targetId);
      if (index >= 0) {
        requestAnimationFrame(() => {
          try {
            flatListRef.current?.scrollToIndex({ index, animated: true });
          } catch (error) {
            flatListRef.current?.scrollToOffset({ offset: index * 60, animated: true });
          }
          setTimestampVisibleFor(targetId);
          setHighlightedMessageId(targetId);
          setTimeout(() => {
            setHighlightedMessageId((prev) => (prev === targetId ? null : prev));
          }, 2000);
        });
      } else {
        pendingScrollIdRef.current = targetId;
      }
    },
    [decoratedData]
  );

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
    async (
      rawMessages: any[],
      otherUserId: string | null,
      token: string | null,
      options?: { timezone?: string }
    ) => {
      const results: Message[] = [];
      const ownerId = currentUserId;
      let missingEnvelope = false;
      const timezoneFallback = options?.timezone || TimezoneService.getTimezone();

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

        const { local, utc, timezone } = resolveMessageTimestamps(raw, timezoneFallback);
        const deliveredAt = resolveDeliveryTimestamp(raw);
        const seenAt = resolveSeenTimestamp(raw);

        let content: string | null = null;
        if (raw.isEncrypted && Array.isArray(raw.envelopes)) {
          if (!chatId) {
            continue;
          }
          const decrypted = await CryptoService.decryptMessage({
            chatId: String(chatId),
            envelopes: raw.envelopes,
            senderId,
            currentUserId: ownerId,
            token: token || undefined,
          });
          if (decrypted) {
            content = decrypted;
          } else {
            console.warn(`Decryption failed for historical message ${raw.id}.`);
          }
        } else {
          content = raw.content ?? '';
        }

        if (content == null) {
          missingEnvelope = true;
          continue;
        }

        let status: MessageStatus | undefined;
        if (ownerId && String(senderId) === ownerId) {
          if (seenAt) {
            status = 'seen';
          } else if (deliveredAt) {
            status = 'delivered';
          } else if (raw.id) {
            status = 'sent';
          }
        }

        const decodedPayload = decodeMessagePayload(content);
        const serverReply = resolveReplyMetadata((raw as any)?.reply);
        const replyTo = serverReply || resolveReplyMetadata(decodedPayload.replyTo);

        results.push({
          id: String(idValue),
          senderId: String(senderId),
          receiverId: String(receiverId),
          content: decodedPayload.text,
          timestamp: String(local),
          utcTimestamp: utc,
          timezone,
          deliveredAt: deliveredAt ?? undefined,
          seenAt: seenAt ?? undefined,
          status,
          replyTo,
        });
      }

      if (missingEnvelope) {
        missingEnvelopeRef.current = true;
      }
      return results;
    },
    [chatId, currentUserId, resolveReplyMetadata]
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
      wsService.sendStopTyping(chatId);
    }
  }, [chatId, wsService]);

  const updateOutgoingStatus = useCallback(
    (status: MessageStatus, messageId?: string, timestamp?: string | null) => {
      if (!currentUserId) {
        return;
      }

      setMessagesAnimated((prev) => {
        const next = prev.map((msg) => {
          if (msg.senderId !== currentUserId || msg.isPlaceholder) {
            return msg;
          }

          if (messageId) {
            if (msg.id === String(messageId)) {
              return { ...msg, status, timestamp: timestamp ?? msg.timestamp };
            }
            return msg;
          }

          if (msg.status !== 'seen') {
            return { ...msg, status, timestamp: timestamp ?? msg.timestamp };
          }

          return msg;
        });

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

        return next;
      });
    },
    [currentUserId, setMessagesAnimated]
  );

  const markChatAsSeen = useCallback(async () => {
    if (!chatId || markSeenInFlightRef.current) {
      return;
    }

    markSeenInFlightRef.current = true;

    try {
      const token = authTokenRef.current ?? (await StorageService.getAuthToken());
      if (!token) {
        return;
      }
      authTokenRef.current = token;

      const response = await ApiService.post(`/chat/${chatId}/seen`, {}, token);
      if (response.success || /already\s+read/i.test(response.error ?? '')) {
        DeviceEventEmitter.emit('unread:refresh');
      } else if (response.error) {
        console.warn(`[chat/${chatId}] Failed to sync seen state:`, response.error);
      }
    } catch (error) {
      console.error(`Failed to mark chat ${chatId} as seen:`, error);
    } finally {
      markSeenInFlightRef.current = false;
    }
  }, [chatId]);

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
      seenMessageIdsRef.current.add(messageId);
      markChatAsSeen();
    },
    [chatId, markChatAsSeen, wsService]
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
        const responseTimezone = response.data?.timezone;
        const rawMessages = response.success && Array.isArray(response.data?.messages) ? response.data.messages : [];

        if (!rawMessages.length) {
          setMessagesAnimated(() => generatePlaceholderMessages(displayName));
          setHasMore(false);
          nextCursorRef.current = null;
          initialLoadCompleteRef.current = true;
          return;
        }

        const transformed = await transformMessages(rawMessages, otherUserId ?? null, token, {
          timezone: responseTimezone,
        });
        const cleaned = transformed.filter(Boolean);

        setMessagesAnimated(() => cleaned);
        if (missingEnvelopeRef.current) {
          requestReencrypt('missing_history');
        }
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
    [generatePlaceholderMessages, scrollToBottom, setMessagesAnimated, transformMessages, requestReencrypt]
  );
  
  const refreshMessages = useCallback(async () => {
    if (!chatId) {
      return;
    }

    const token = authTokenRef.current ?? (await StorageService.getAuthToken());
    if (!token) {
      return;
    }
    authTokenRef.current = token;
    await loadMessagesForChat(token, chatId, receiverNameRef.current, otherUserIdRef.current);
  }, [chatId, loadMessagesForChat]);

  const loadChatDetails = useCallback(async () => {
    if (!chatId || !currentUserId) {
      return;
    }

    setIsThreadLoading(true);
    seenMessageIdsRef.current = new Set();
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
        const responseTimezone = response.data?.timezone;
        const rawMessages = response.success && Array.isArray(response.data?.messages) ? response.data.messages : [];
        if (!rawMessages.length) {
          setHasMore(false);
          return;
        }

        const transformed = await transformMessages(rawMessages, otherUserIdRef.current, token, {
          timezone: responseTimezone,
        });
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

      if (value.length > 0 && !typingStateRef.current.isTyping) {
        typingStateRef.current.isTyping = true;
        wsService.sendTyping(chatId);
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        if (typingStateRef.current.isTyping) {
          typingStateRef.current.isTyping = false;
          wsService.sendStopTyping(chatId);
        }
      }, 1500);
    },
    [chatId, wsService]
  );

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !currentUserId || !chatId) {
      return;
    }

    if (newMessage.length > MESSAGE_CHAR_LIMIT) {
      NotificationService.show('error', 'Messages are limited to 2000 characters');
      return;
    }

    const trimmedMessage = newMessage.trim();
    const pendingReply = replyContext;
    const normalizedReply = replyContext ? resolveReplyMetadata(replyContext) : undefined;
    const encodedPayload = encodeMessagePayload(trimmedMessage, normalizedReply);
    const temporaryId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: temporaryId,
      senderId: currentUserId,
      receiverId: String(otherUserIdRef.current ?? ''),
      content: trimmedMessage,
      timestamp: new Date().toISOString(),
      status: 'sending',
      replyTo: normalizedReply,
    };

    setMessagesAnimated((prev) => {
      const withoutPlaceholders = prev.filter((msg) => !msg.isPlaceholder);
      return [...withoutPlaceholders, optimisticMessage];
    });
    InteractionManager.runAfterInteractions(() => {
      scrollToBottom();
    });
    setNewMessage('');
    setReplyContext(null);
    requestAnimationFrame(() => {
      composerRef.current?.focus();
    });
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
        message: encodedPayload,
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
        replyMetadata: normalizedReply,
      });
    } catch (error) {
      console.error(`Error sending encrypted message to chat ${chatId}:`, error);
      NotificationService.show('error', 'Failed to send message. Please try again.');
      setMessagesAnimated((prev) => prev.filter((msg) => msg.id !== temporaryId));
      setNewMessage(trimmedMessage);
      if (pendingReply) {
        setReplyContext(pendingReply);
      }
    } finally {
      setIsSendingMessage(false);
    }
  }, [
    chatId,
    currentUserId,
    ensureTypingStopped,
    newMessage,
    replyContext,
    resolveReplyMetadata,
    scrollToBottom,
    setMessagesAnimated,
    wsService,
  ]);

  const handleThreadClose = useCallback(() => {
    setThreadRootId(null);
  }, []);

  const handleThreadJumpToChat = useCallback(() => {
    if (!threadRootId) {
      return;
    }
    const target = threadRootId;
    setThreadRootId(null);
    scrollToMessageById(target);
  }, [scrollToMessageById, threadRootId]);

  useEffect(() => {
    if (replyContext) {
      requestAnimationFrame(() => composerRef.current?.focus());
    }
  }, [replyContext]);

  useEffect(() => {
    if (!chatId || !wsService) {
      return;
    }

    const typingHandler = (data: { userId: string; username: string }) => {
      console.log('ChatScreen typing handler triggered for user:', data.userId);
      if (data.userId !== currentUserId) {
        setTypingUserLabel(data.username || receiverNameRef.current || 'Someone');
        setIsRemoteTyping(true);
        if (remoteTypingTimeoutRef.current) {
          clearTimeout(remoteTypingTimeoutRef.current);
        }
        remoteTypingTimeoutRef.current = setTimeout(() => {
          setIsRemoteTyping(false);
        }, 2500); // Keep indicator for 2.5s
        // If the user is already near the bottom, scroll so the typing indicator becomes visible
        if (isNearBottomRef.current) {
          InteractionManager.runAfterInteractions(() => {
            scrollToBottom();
          });
        }
      }
    };

    const stopTypingHandler = (data: { userId: string }) => {
      console.log('ChatScreen stop-typing handler triggered for user:', data.userId);
      if (data.userId !== currentUserId) {
        if (remoteTypingTimeoutRef.current) {
          clearTimeout(remoteTypingTimeoutRef.current);
        }
        setIsRemoteTyping(false);
      }
    };

    const unsubscribeTyping = wsService.onTyping(chatId, typingHandler);
    const unsubscribeStopTyping = wsService.onStopTyping(chatId, stopTypingHandler);

    return () => {
      unsubscribeTyping();
      unsubscribeStopTyping();
      if (remoteTypingTimeoutRef.current) {
        clearTimeout(remoteTypingTimeoutRef.current);
      }
    };
  }, [chatId, wsService, currentUserId]);

  useEffect(() => {
    // Debug: log when decorated list or typing state changes so we can confirm the typing item is present
    try {
      console.log('decoratedData updated - isRemoteTyping:', isRemoteTyping, 'items:', decoratedData.length);
      // print a compact summary of the last few items to avoid enormous logs
      const tail = decoratedData.slice(-6).map((it) => ({ kind: it.kind, id: it.id }));
      console.log('decoratedData tail:', tail);
    } catch (e) {
      // ignore logging errors
    }
  }, [decoratedData, isRemoteTyping]);

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
          const statusTimestamp =
            pickFirstTimestamp(payload, [
              'timestampLocal',
              'timestamp',
              'seenAtLocal',
              'seenAt',
              'deliveredAtLocal',
              'deliveredAt',
            ]) || null;
          updateOutgoingStatus(
            status,
            payload.messageId ? String(payload.messageId) : undefined,
            statusTimestamp
          );
          return;
        }
        case 'message_envelope_sent': {
          const ackTimestamps = resolveMessageTimestamps(
            payload,
            payload.timezone || TimezoneService.getTimezone()
          );
          applyAckToLatestMessage({
            messageId: payload.messageId ?? payload.id,
            createdAt: ackTimestamps.local,
          });
          return;
        }
        case 'message_envelope': {
          const envelopes = Array.isArray(payload.envelopes) ? payload.envelopes : [];
          if (!envelopes.length) {
            return;
          }

          try {
            const token = authTokenRef.current ?? (await StorageService.getAuthToken());
            authTokenRef.current = token || null;
            const decrypted = await CryptoService.decryptMessage({
              chatId: targetChatId,
              envelopes,
              senderId: payload.senderId ?? payload.userId ?? null,
              currentUserId,
              token: token || undefined,
            });
            if (!decrypted) {
              console.warn('Decryption failed for incoming message envelope.');
              return;
            }

            const { local, utc, timezone } = resolveMessageTimestamps(
              payload,
              payload.timezone || TimezoneService.getTimezone()
            );
            const decodedPayload = decodeMessagePayload(decrypted);
            const serverReply = resolveReplyMetadata(payload.reply);
            const replyTo = serverReply || resolveReplyMetadata(decodedPayload.replyTo);
            const newEntry: Message = {
              id: String(payload.messageId ?? payload.id ?? Date.now()),
              senderId: String(payload.senderId ?? ''),
              receiverId: String(payload.receiverId ?? otherUserIdRef.current ?? ''),
              content: decodedPayload.text,
              timestamp: local,
              utcTimestamp: utc,
              timezone,
              replyTo,
            };

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
          const { local, utc, timezone } = resolveMessageTimestamps(
            payload,
            payload.timezone || TimezoneService.getTimezone()
          );
          const decodedPayload = decodeMessagePayload(payload.content ?? '');
          const serverReply = resolveReplyMetadata(payload.reply);
          const replyTo = serverReply || resolveReplyMetadata(decodedPayload.replyTo);
          const newEntry: Message = {
            id: String(payload.messageId ?? payload.id ?? Date.now()),
            senderId: String(payload.senderId ?? ''),
            receiverId: String(payload.receiverId ?? otherUserIdRef.current ?? ''),
            content: decodedPayload.text,
            timestamp: local,
            utcTimestamp: utc,
            timezone,
            replyTo,
          };

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
        case 'message_deleted': {
          const deletedId = String(payload.messageId ?? payload.id ?? payload.data?.messageId ?? '');
          if (!deletedId) {
            return;
          }
          setMessagesAnimated((prev) => prev.filter((msg) => msg.id !== deletedId));
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
      resolveReplyMetadata,
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
    ({ viewableItems }: { viewableItems: Array<{ index: number | null; item: ChatListItem }> }) => {
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
      // Only auto-scroll if the user is near the bottom or if it's the first message
      if (isNearBottomRef.current || messages.length === 1) {
        scrollToBottom();
      }
    }
  }, [messages, scrollToBottom, isNearBottomRef]);

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
    reencryptRequestedRef.current = false;
    missingEnvelopeRef.current = false;
  }, [chatId]);

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
    const sub = DeviceEventEmitter.addListener('chat:envelopes_appended', (event: any) => {
      if (!event || !event.chatId) {
        return;
      }
      if (String(event.chatId) !== String(chatId)) {
        return;
      }
      reencryptRequestedRef.current = false;
      refreshMessages();
    });
    return () => {
      sub.remove();
    };
  }, [chatId, refreshMessages]);

  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideListener = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (!messages.length || !currentUserId) {
      return;
    }

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.isPlaceholder || message.senderId === currentUserId) {
        continue;
      }

      if (!seenMessageIdsRef.current.has(message.id)) {
        sendSeenReceipt(message.id);
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
        setTimestampVisibleFor(targetId);
        setHighlightedMessageId(targetId);
        setTimeout(() => {
          setHighlightedMessageId((prev) => (prev === targetId ? null : prev));
        }, 2000);
        pendingScrollIdRef.current = null;
      });
    } else {
      pendingScrollIdRef.current = null;
    }
  }, [decoratedData]);

  const renderChatItem = useCallback(
    ({ item, index }: { item: ChatListItem; index: number }) => {
      if (item.kind === 'typing') {
        return <TypingIndicator />;
      }

      if (item.kind === 'date') {
        return (
          <View style={styles.dateDivider}>
            <View style={styles.dateDividerLine} />
            <Text style={styles.dateDividerText}>{item.label}</Text>
            <View style={styles.dateDividerLine} />
          </View>
        );
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
        !previousMessage || previousMessage.senderId !== messageItem.senderId || !!previousMessage.isPlaceholder;
      const isLastInGroup =
        !nextMessage || nextMessage.senderId !== messageItem.senderId || !!nextMessage.isPlaceholder;

      const shouldShowStatus = lastOutgoingMessageId === messageItem.id && isMine && Boolean(messageItem.status);
      const shouldShowTimestamp = timestampVisibleFor === messageItem.id;
      const replyCount = replyCounts.get(messageItem.id) ?? 0;

      return (
        <Pressable
          onPress={() =>
            setTimestampVisibleFor((prev) => (prev === messageItem.id ? null : messageItem.id))
          }
        >
          <MessageBubble
            key={messageItem.id}
            message={messageItem}
            isMine={isMine}
            isFirstInGroup={isFirstInGroup}
            isLastInGroup={isLastInGroup}
            showStatus={shouldShowStatus}
            showTimestamp={shouldShowTimestamp}
            onReplyPress={(reply) => setThreadRootId(reply.messageId)}
            onReplySwipe={() => setReplyContext(buildReplyPayloadFromMessage(messageItem))}
            isHighlighted={highlightedMessageId === messageItem.id}
            replyCount={replyCount}
            onOpenThread={(messageId) => setThreadRootId(messageId)}
          />
        </Pressable>
      );
    },
    [
      currentUserId,
      decoratedData,
      replyCounts,
      buildReplyPayloadFromMessage,
      highlightedMessageId,
      lastOutgoingMessageId,
      timestampVisibleFor,
      typingUserLabel,
    ]
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
  const keyboardOffset = useMemo(
    () => (Platform.OS === 'ios' ? insets.bottom : 0),
    [insets.bottom]
  );

  const composerBottomPadding = useMemo(() => {
    if (Platform.OS === 'ios') {
      return Math.max(insets.bottom - 6, 4);
    }
    if (isKeyboardVisible) {
      return 2;
    }
    return Math.max(insets.bottom, 12);
  }, [insets.bottom, isKeyboardVisible]);
  const sendButtonDisabled = isComposerEmpty || isSendingMessage;

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
        },
      ]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#03040A', '#071026']}
        style={StyleSheet.absoluteFillObject}
      />
      <Stack.Screen options={{ title: receiverUsername }} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {receiverUsername}
        </Text>
        <View style={styles.headerButtonPlaceholder} />
      </View>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={keyboardOffset}
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


                      extraData={isRemoteTyping}


                      keyExtractor={(item) => item.id}


                      renderItem={renderChatItem}


                      contentContainerStyle={styles.messageList}


                      ListHeaderComponent={listHeader}


                      keyboardShouldPersistTaps="handled"


                      onScroll={handleScroll}


                      scrollEventThrottle={16}


                      onViewableItemsChanged={onViewableItemsChanged}


                      viewabilityConfig={viewabilityConfigRef.current}





                      refreshControl={


                        <RefreshControl


                          tintColor="#2C82FF"


                          titleColor="#2C82FF"


                          progressViewOffset={80}


                          refreshing={isRefreshing}


                          onRefresh={handleRefresh}


                        />


                      }


                    />


                    {showScrollToBottomButton && (


                      <Pressable


                        style={styles.scrollToBottomButton}


                        onPress={scrollToBottom}


                        accessibilityRole="button"


                      >


                        <Ionicons name="arrow-down" size={24} color="#FFFFFF" />


                      </Pressable>


                    )}


                  </Animated.View>


                )}


        
        {replyContext && (
          <View style={styles.replyPreview}>
            <View style={styles.replyPreviewBar} />
            <View style={styles.replyPreviewBody}>
              <Text style={styles.replyPreviewLabel}>{replyContext.senderLabel}</Text>
              <Text style={styles.replyPreviewText} numberOfLines={1}>
                {replyContext.preview}
              </Text>
            </View>
            <Pressable
              style={styles.replyPreviewClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => setReplyContext(null)}
              accessibilityLabel="Cancel reply"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={16} color="#ffffff" />
            </Pressable>
          </View>
        )}

        <View style={[styles.inputContainer, { paddingBottom: composerBottomPadding }]}>
          <View style={styles.composerColumn}>
            <TextInput
              ref={composerRef}
              style={styles.textInput}
              value={newMessage}
              onChangeText={handleComposerChange}
              placeholder="Message…"
              placeholderTextColor="rgba(255, 255, 255, 0.45)"
              multiline
            />
          </View>

          <Pressable
            onPress={handleSendMessage}
            style={({ pressed }) => [
              styles.sendButton,
              !sendButtonDisabled && styles.sendButtonActive,
              pressed && !sendButtonDisabled && styles.sendButtonPressed,
            ]}
            disabled={sendButtonDisabled}
            accessibilityRole="button"
          >
            {isSendingMessage ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="paper-plane" size={20} color="#ffffff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      <Modal
        visible={Boolean(threadRootId)}
        transparent
        animationType="slide"
        onRequestClose={handleThreadClose}
      >
        <View style={styles.threadModalOverlay}>
          <View style={styles.threadModalCard}>
            <View style={styles.threadModalHeader}>
              <Text style={styles.threadModalTitle}>
                {threadMessages.length > 1
                  ? `${threadMessages.length - 1} ${threadMessages.length - 1 === 1 ? 'Reply' : 'Replies'}`
                  : 'Thread'}
              </Text>
              <Pressable onPress={handleThreadClose} style={styles.threadModalClose} accessibilityRole="button">
                <Ionicons name="close" size={20} color="#ffffff" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.threadModalScroll}>
              {threadMessages.length ? (
                threadMessages.map((threadMessage, index) => (
                  <View key={`${threadMessage.id}-${index}`} style={styles.threadMessageCard}>
                    <View style={styles.threadMessageHeader}>
                      <Text style={styles.threadMessageAuthor}>
                        {getReplyLabel(threadMessage.senderId)}
                      </Text>
                      <Text style={styles.threadMessageTimestamp}>
                        {formatTimestamp(parseDate(threadMessage.timestamp))}
                      </Text>
                    </View>
                    <Text style={styles.threadMessageText}>{threadMessage.content}</Text>
                    {index === 0 && (
                      <Text style={styles.threadMessageBadge}>Original message</Text>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.threadEmptyText}>
                  Original message is not available in this history.
                </Text>
              )}
            </ScrollView>
            <Pressable style={styles.threadJumpButton} onPress={handleThreadJumpToChat}>
              <Text style={styles.threadJumpButtonText}>View in chat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 0,
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
    paddingBottom: 4,
  },
  loadMoreSpinner: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadMoreSpacer: {
    height: 12,
  },
  messageRow: {
    maxWidth: '82%',
    position: 'relative',
  },
  messageRowStacked: {
    marginTop: 6,
  },
  messageRowCompact: {
    marginBottom: 2,
  },
  messageRowSpaced: {
    marginBottom: 12,
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
  highlightedBubble: {
    shadowColor: '#2C82FF',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    backgroundColor: 'rgba(44, 130, 255, 0.2)',
  },
  replyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  replyChipMine: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  replyChipBar: {
    width: 3,
    height: '100%',
    marginRight: 8,
    borderRadius: 2,
    backgroundColor: '#2C82FF',
  },
  replyChipBody: {
    flex: 1,
  },
  replyChipLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  replyChipText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
  },
  replyHint: {
    position: 'absolute',
    left: -28,
    top: '50%',
    marginTop: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2C82FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyHintMine: {
    left: undefined,
    right: -28,
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

  statusText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  timestampContainer: {
    alignSelf: 'center',
    marginBottom: 10,
  },
  timestampText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
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
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  replyPreviewBar: {
    width: 3,
    height: '100%',
    backgroundColor: '#2C82FF',
    borderRadius: 2,
    marginRight: 10,
  },
  replyPreviewBody: {
    flex: 1,
  },
  replyPreviewLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  replyPreviewText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
  },
  replyPreviewClose: {
    marginLeft: 8,
    padding: 4,
  },
  threadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  threadModalCard: {
    backgroundColor: '#101526',
    borderRadius: 20,
    padding: 16,
    maxHeight: '80%',
  },
  threadModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  threadModalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  threadModalClose: {
    padding: 6,
  },
  threadModalScroll: {
    paddingVertical: 8,
  },
  threadMessageCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  threadMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  threadMessageAuthor: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  threadMessageTimestamp: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  threadMessageText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
  },
  threadMessageBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  threadEmptyText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 20,
  },
  threadJumpButton: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#2C82FF',
  },
  threadJumpButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  threadSummaryButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  threadSummaryButtonMine: {
    alignSelf: 'flex-end',
  },
  threadSummaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  threadSummaryText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
    backgroundColor: 'transparent',
  },
  composerColumn: {
    flex: 1,
    marginRight: 12,
  },
  textInput: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    maxHeight: 140,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  sendButtonPressed: {
    opacity: 0.8,
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
