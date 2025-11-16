import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ActionSheetIOS, Alert, Animated, BackHandler, DeviceEventEmitter, FlatList, Keyboard, KeyboardAvoidingView, LayoutAnimation, InteractionManager, Modal, PanResponder, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableWithoutFeedback, UIManager, View, NativeSyntheticEvent, NativeScrollEvent, Pressable, Linking, Share } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';

import { useAuth } from '../../hooks/useAuth';
import { ApiService } from '../../services/ApiService';
import { NotificationService } from '../../services/NotificationService';
import { StorageService } from '../../services/StorageService';
import { CryptoService } from '../../services/CryptoService';
import { DeviceService } from '../../services/DeviceService';
import { WebSocketMessage, WebSocketService } from '../../services/WebSocketService';
import { UserCacheService } from '../../services/UserCacheService';
import { TimezoneService } from '../../services/TimezoneService';
import { ChatService } from '../../services/ChatService';
import { GroupMemberPicker } from '../../components/GroupMemberPicker';
import { UserAvatar } from '../../components/UserAvatar';

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

interface MessageAttachment {
  id: string;
  name: string;
  mimeType: string;
  fileSize: number;
  status: 'pending' | 'active' | 'expired';
  isImage: boolean;
  previewUrl?: string;
  downloadUrl?: string;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  senderName?: string | null;
  senderAvatar?: string | null;
  content: string;
  timestamp: string;
  utcTimestamp?: string;
  timezone?: string;
  deliveredAt?: string;
  seenAt?: string;
  status?: MessageStatus;
  isPlaceholder?: boolean;
  replyTo?: ReplyMetadata;
  attachments?: MessageAttachment[];
  isDeleted?: boolean;
  deletedByName?: string | null;
  deletedAt?: string | null;
  editedAt?: string | null;
  isEdited?: boolean;
  deletedLabel?: string | null;
}

interface ChatParticipant {
  id: string;
  username: string;
  profile_picture?: string | null;
  status?: string | null;
}

type ChatListItem =
  | { kind: 'message'; id: string; message: Message }
  | { kind: 'date'; id: string; label: string }
  | { kind: 'typing'; id: string };

const MESSAGE_PAYLOAD_VERSION = 1;
const ATTACHMENT_STATUS_MAP: Record<string, 'pending' | 'active' | 'expired'> = {
  pending: 'pending',
  active: 'active',
  expired: 'expired',
};

const buildAbsoluteUrl = (pathValue?: string | null): string | undefined => {
  if (!pathValue) {
    return undefined;
  }
  if (/^https?:\/\//i.test(pathValue)) {
    return pathValue;
  }
  const normalized = pathValue.startsWith('/') ? pathValue : `/${pathValue}`;
  return `${ApiService.baseUrl}${normalized}`;
};

const formatBytes = (size: number): string => {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const mapServerAttachment = (raw: any): MessageAttachment => ({
  id: String(raw.id),
  name: raw.name || raw.fileName || 'Attachment',
  mimeType: raw.mimeType || 'application/octet-stream',
  fileSize: Number(raw.fileSize) || 0,
  status: ATTACHMENT_STATUS_MAP[String(raw.status)] ?? 'active',
  isImage: Boolean(raw.isImage),
  previewUrl: buildAbsoluteUrl(raw.previewPath),
  downloadUrl: buildAbsoluteUrl(raw.downloadPath),
});

const mapServerAttachments = (raw?: any): MessageAttachment[] => {
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.map((entry) => mapServerAttachment(entry));
  }
  return [];
};

const LINK_REGEX = /(https?:\/\/[^\s]+)/gi;
const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp)$/i.test(url.split('?')[0]);

const splitTextByLinks = (text: string): Array<{ type: 'text' | 'link'; value: string }> => {
  if (!text || typeof text !== 'string') {
    return [{ type: 'text', value: '' }];
  }
  const segments: Array<{ type: 'text' | 'link'; value: string }> = [];
  let lastIndex = 0;
  text.replace(LINK_REGEX, (match, _offset, index) => {
    const startIndex = typeof index === 'number' ? index : text.indexOf(match, lastIndex);
    if (startIndex > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, startIndex) });
    }
    segments.push({ type: 'link', value: match });
    lastIndex = startIndex + match.length;
    return match;
  });
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  if (!segments.length) {
    segments.push({ type: 'text', value: text });
  }
  return segments;
};

const findEmbeddableLink = (text: string): string | null => {
  if (!text) {
    return null;
  }
  const matches = text.match(LINK_REGEX);
  if (!matches) {
    return null;
  }
  const match = matches.find((url) => isImageUrl(url));
  return match || null;
};

const buildDeletedLabel = (username?: string | null) => {
  if (!username) {
    return 'Message deleted';
  }
  return `${username} deleted a message`;
};

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

const MESSAGE_CHAR_LIMIT = 5000;
const REPLY_ACCENT = 'rgba(255, 255, 255, 0.25)';
const SWIPE_REPLY_THRESHOLD = 18;
const MIN_GROUP_MEMBERS = 3;
const MAX_GROUP_MEMBERS = 10;


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
  showSenderMetadata?: boolean;
  onBubblePress?: () => void;
  onBubbleLongPress?: () => void;
  onAttachmentPress?: (attachment: MessageAttachment) => void;
  onLinkPress?: (url: string) => void;
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
  showSenderMetadata = false,
  onBubblePress,
  onBubbleLongPress,
  onAttachmentPress,
  onLinkPress,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const swipePeakRef = useRef(0);
  const textSegments = useMemo(() => splitTextByLinks(message.content || ''), [message.content]);
  const embeddableLink = useMemo(() => {
    if (message.isPlaceholder || message.attachments?.length) {
      return null;
    }
    return findEmbeddableLink(message.content || '');
  }, [message.attachments, message.content, message.isPlaceholder]);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 6,
        onPanResponderGrant: () => {
          swipePeakRef.current = 0;
        },
        onPanResponderMove: (_, gesture) => {
          let nextValue = 0;
          if (!isMine && gesture.dx > 0) {
            nextValue = Math.min(gesture.dx, 80);
          } else if (isMine && gesture.dx < 0) {
            nextValue = Math.max(gesture.dx, -80);
          }
          swipeAnim.setValue(nextValue);
          const magnitude = isMine ? -nextValue : nextValue;
          if (magnitude > swipePeakRef.current) {
            swipePeakRef.current = magnitude;
          }
        },
        onPanResponderRelease: (_, gesture) => {
          const magnitude =
            swipePeakRef.current ||
            (isMine ? Math.abs(Math.min(gesture.dx, 0)) : Math.abs(Math.max(gesture.dx, 0)));
          if (magnitude > SWIPE_REPLY_THRESHOLD && onReplySwipe) {
            onReplySwipe();
          }
          swipePeakRef.current = 0;
          Animated.spring(swipeAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          swipePeakRef.current = 0;
          Animated.spring(swipeAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [isMine, onReplySwipe, swipeAnim]
  );

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

  const replyHintOpacity = useMemo(() => {
    if (isMine) {
      return swipeAnim.interpolate({
        inputRange: [-SWIPE_REPLY_THRESHOLD, -10, 0],
        outputRange: [1, 0, 0],
        extrapolate: 'clamp',
      });
    }
    return swipeAnim.interpolate({
      inputRange: [0, 10, SWIPE_REPLY_THRESHOLD],
      outputRange: [0, 0, 1],
      extrapolate: 'clamp',
    });
  }, [isMine, swipeAnim]);

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
        <Pressable
          onPress={onBubblePress}
          onLongPress={onBubbleLongPress}
          style={[
            styles.messageContent,
            isMine ? styles.messageContentMine : styles.messageContentTheirs,
          ]}
          delayLongPress={120}
        >
          {showSenderMetadata && !isMine ? (
            <View style={styles.senderMetaRow}>
              <UserAvatar
                uri={message.senderAvatar || undefined}
                name={message.senderName || 'Member'}
                size={32}
                style={styles.senderMetaAvatar}
              />
              <Text style={styles.senderMetaName} numberOfLines={1}>
                {message.senderName || 'Member'}
              </Text>
            </View>
          ) : null}
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
            {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
              <View style={styles.attachmentGroup}>
                {message.attachments.map((attachment) => {
                  const isExpired = attachment.status === 'expired';
                  const isPreviewable = attachment.isImage && attachment.previewUrl;
                  return (
                    <Pressable
                      key={`${message.id}-attachment-${attachment.id}`}
                      style={[
                        styles.attachmentCard,
                        isPreviewable ? styles.attachmentImageCard : styles.attachmentFileCard,
                      ]}
                      onPress={() => !isExpired && onAttachmentPress?.(attachment)}
                      disabled={isExpired}
                    >
                      {isPreviewable ? (
                        <Image
                          source={{ uri: attachment.previewUrl }}
                          style={styles.attachmentImage}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.attachmentFileRow}>
                          <Ionicons
                            name="document-text-outline"
                            size={18}
                            color="rgba(255,255,255,0.9)"
                            style={styles.attachmentFileIcon}
                          />
                          <View style={styles.attachmentFileBody}>
                            <Text style={styles.attachmentFileName} numberOfLines={1}>
                              {attachment.name}
                            </Text>
                            <Text style={styles.attachmentFileMeta}>
                              {formatBytes(attachment.fileSize)}
                            </Text>
                          </View>
                        </View>
                      )}
                      {isExpired ? (
                        <View style={styles.attachmentExpiredOverlay}>
                          <Text style={styles.attachmentExpiredText}>File or Image expired</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {message.content?.length ? (
              <Text style={[styles.messageText, message.isPlaceholder && styles.placeholderText]}>
                {textSegments.map((segment, idx) =>
                  segment.type === 'link' ? (
                    <Text
                      key={`${message.id}-link-${idx}`}
                      style={styles.linkText}
                      onPress={() => onLinkPress?.(segment.value)}
                    >
                      {segment.value}
                    </Text>
                  ) : (
                    <Text key={`${message.id}-text-${idx}`}>{segment.value}</Text>
                  )
                )}
              </Text>
            ) : null}
            {embeddableLink ? (
              <Pressable
                style={styles.embedPreview}
                onPress={() => onLinkPress?.(embeddableLink)}
              >
                <Image source={{ uri: embeddableLink }} style={styles.embedImage} contentFit="cover" />
                <Text style={styles.embedLabel}>Tap to open</Text>
              </Pressable>
            ) : null}
            {message.isEdited && !message.isPlaceholder ? (
              <Text style={styles.editedLabel}>Edited</Text>
            ) : null}
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
        </Pressable>
      </Animated.View>
    </>
  );
};

const ChatScreen: React.FC = () => {
  const { id } = useLocalSearchParams();
  const chatId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  const wsService = useMemo(() => WebSocketService.getInstance(), []);
  const flatListRef = useRef<FlatList<ChatListItem>>(null);
  const composerLimitWarningRef = useRef(false);

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
  const isNearTopRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [attachmentPickerBusy, setAttachmentPickerBusy] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<MessageAttachment | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  const [receiverUsername, setReceiverUsername] = useState<string>('Loading…');
  const [chatDetails, setChatDetails] = useState<{
    id: string;
    isGroup: boolean;
    ownerId: string | null;
    name: string | null;
    avatarUrl: string | null;
    participants: ChatParticipant[];
  } | null>(null);
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
  const [friendRoster, setFriendRoster] = useState<ChatParticipant[]>([]);
  const [isFriendRosterLoading, setIsFriendRosterLoading] = useState(false);
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);
  const [memberPickerMode, setMemberPickerMode] = useState<'create' | 'add'>('create');
  const [lockedMemberIds, setLockedMemberIds] = useState<string[]>([]);
  const [excludedMemberIds, setExcludedMemberIds] = useState<string[]>([]);
  const [memberPickerError, setMemberPickerError] = useState<string | null>(null);
  const [memberPickerBusy, setMemberPickerBusy] = useState(false);
  const participantLookupRef = useRef<Record<string, ChatParticipant>>({});

  const handleNavigateBack = useCallback(() => {
    if (threadRootId) {
      setThreadRootId(null);
      return true;
    }
    if (replyContext) {
      setReplyContext(null);
      return true;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/home');
    }
    return true;
  }, [navigation, replyContext, router, threadRootId]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') {
        return undefined;
      }
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => handleNavigateBack());
      return () => subscription.remove();
    }, [handleNavigateBack])
  );

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

  const syncParticipants = useCallback((participants: ChatParticipant[] = []) => {
    const lookup: Record<string, ChatParticipant> = {};
    participants.forEach((participant) => {
      if (!participant || !participant.id) {
        return;
      }
      const key = participant.id?.toString?.() ?? String(participant.id);
      lookup[key] = {
        id: key,
        username: participant.username || `User ${key}`,
        profile_picture: participant.profile_picture || null,
        status: participant.status || null,
      };
    });
    participantLookupRef.current = lookup;
  }, []);

  const applyChatUpdate = useCallback(
    (nextChat: any) => {
      if (!nextChat) {
        return;
      }

      const normalizedParticipants: ChatParticipant[] = Array.isArray(nextChat.participants)
        ? (nextChat.participants as any[]).map((participant) => ({
            id: participant.id?.toString?.() ?? String(participant.id),
            username: participant.username || participant.email || 'Friend',
            profile_picture: participant.profile_picture || null,
            status: participant.status || null,
          }))
        : [];

      if (normalizedParticipants.length) {
        UserCacheService.addUsers(
          normalizedParticipants.map((participant) => ({
            ...participant,
            id: participant.id,
          })) as any[]
        );
      }

      const participantsPayload =
        normalizedParticipants.length > 0
          ? normalizedParticipants
          : (nextChat.participants as ChatParticipant[]) || [];
      syncParticipants(participantsPayload);

      const updatedUserIds: string[] = Array.isArray(nextChat.userIds)
        ? nextChat.userIds.map((pid: any) => pid?.toString?.() ?? String(pid))
        : participantIdsRef.current;

      participantIdsRef.current = updatedUserIds;

      setChatDetails((prev) => ({
        id: nextChat.id?.toString?.() ?? prev?.id ?? chatId ?? '',
        isGroup: Boolean(nextChat.isGroup ?? nextChat.is_group ?? prev?.isGroup),
        ownerId:
          nextChat.ownerId?.toString?.() ??
          nextChat.owner_id?.toString?.() ??
          prev?.ownerId ??
          null,
        name: nextChat.name ?? nextChat.displayName ?? prev?.name ?? null,
        avatarUrl: nextChat.avatarUrl ?? nextChat.avatar_url ?? prev?.avatarUrl ?? null,
        participants: participantsPayload.length ? participantsPayload : prev?.participants ?? [],
      }));
    },
    [chatId, syncParticipants]
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

  const resolveSenderProfile = useCallback(
    (senderId: string | null | undefined) => {
      if (!senderId) {
        return { name: 'Member', avatar: null };
      }
      const normalized = senderId.toString();
      if (currentUserId && normalized === currentUserId) {
        return { name: 'You', avatar: user?.profile_picture || null };
      }
      const participant = participantLookupRef.current[normalized];
      return {
        name: participant?.username || 'Member',
        avatar: participant?.profile_picture || null,
      };
    },
    [currentUserId, user?.profile_picture]
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

        const isDeleted = Boolean(raw.isDeleted ?? raw.is_deleted);
        const deletedByName = raw.deletedByName ?? raw.deleted_by_name ?? raw.deletedBy ?? null;
        const deletedAt = normalizeTimestampValue(raw.deletedAt ?? raw.deleted_at);
        const editedAt = normalizeTimestampValue(raw.editedAt ?? raw.edited_at);
        const attachments = Array.isArray(raw.attachments)
          ? raw.attachments.map((item: any) => mapServerAttachment(item))
          : [];

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
          if (isDeleted) {
            content = buildDeletedLabel(deletedByName || resolveSenderProfile(String(senderId)).name);
          } else {
            missingEnvelope = true;
            continue;
          }
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
        const replyTo = isDeleted
          ? undefined
          : serverReply || resolveReplyMetadata(decodedPayload.replyTo);

        const senderProfile = resolveSenderProfile(String(senderId));
        results.push({
          id: String(idValue),
          senderId: String(senderId),
          receiverId: String(receiverId),
          senderName: senderProfile.name,
          senderAvatar: senderProfile.avatar,
          content: decodedPayload.text,
          timestamp: String(local),
          utcTimestamp: utc,
          timezone,
          deliveredAt: deliveredAt ?? undefined,
          seenAt: seenAt ?? undefined,
          status,
          replyTo,
          attachments,
          isDeleted,
          deletedByName: deletedByName || senderProfile.name,
          deletedAt: deletedAt ?? undefined,
          deletedLabel: isDeleted ? buildDeletedLabel(deletedByName || senderProfile.name) : null,
          isEdited: Boolean(editedAt),
          editedAt: editedAt ?? undefined,
          isPlaceholder: Boolean(isDeleted),
        });
      }

      if (missingEnvelope) {
        missingEnvelopeRef.current = true;
      }
      return results;
    },
    [chatId, currentUserId, resolveReplyMetadata, resolveSenderProfile]
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
          senderName: friendlyName,
          senderAvatar: null,
          content: `👋 ${friendlyName} hasn't sent any messages yet, but this space is ready when they do.`,
          timestamp: new Date(now - 60_000).toISOString(),
          isPlaceholder: true,
        },
        {
          id: 'placeholder-2',
          senderId: String(currentUserId ?? 'me'),
          receiverId: 'friend',
          senderName: 'You',
          senderAvatar: user?.profile_picture || null,
          content: 'Start the conversation with a quick hello!',
          timestamp: new Date(now - 30_000).toISOString(),
          isPlaceholder: true,
        },
      ] as Message[];
    },
    [currentUserId, user?.profile_picture]
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

  const ensureFriendRoster = useCallback(async () => {
    setIsFriendRosterLoading(true);
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        setFriendRoster([]);
        return;
      }
      const response = await ApiService.get('/user/friends', token);
      if (response.success && Array.isArray(response.data?.friends)) {
        const roster = (response.data.friends as any[]).map((friend) => ({
          id: friend.id?.toString?.() ?? String(friend.id),
          username: friend.username || friend.email || 'Friend',
          profile_picture: friend.profile_picture || null,
          status: friend.status || null,
        }));
        setFriendRoster(roster);
        UserCacheService.addUsers(roster as any[]);
      }
    } catch (error) {
      console.error('Failed to load friend roster:', error);
    } finally {
      setIsFriendRosterLoading(false);
    }
  }, []);

  const handleOpenMemberPicker = useCallback(
    async (mode: 'create' | 'add') => {
      if (mode === 'create' && !otherUserIdRef.current) {
        NotificationService.show('info', 'Please wait until the chat has loaded');
        return;
      }
      setMemberPickerMode(mode);
      setMemberPickerError(null);
      if (!friendRoster.length) {
        await ensureFriendRoster();
      }

      if (mode === 'create') {
        const locked = otherUserIdRef.current ? [otherUserIdRef.current] : [];
        setLockedMemberIds(locked);
        setExcludedMemberIds([currentUserId || '', ...locked].filter(Boolean));
      } else {
        const excluded = chatDetails?.participants?.map((participant) => participant.id) || [];
        setLockedMemberIds([]);
        setExcludedMemberIds([...excluded, currentUserId || ''].filter(Boolean));
      }
      setMemberPickerVisible(true);
    },
    [chatDetails?.participants, currentUserId, ensureFriendRoster, friendRoster.length]
  );

  const handleMemberPickerClose = useCallback(() => {
    setMemberPickerVisible(false);
    setMemberPickerError(null);
    setMemberPickerBusy(false);
  }, []);

  const handleMemberPickerConfirm = useCallback(
    async (selectedIds: string[]) => {
      if (!chatId) {
        return;
      }

      if (memberPickerMode === 'create') {
        const combined = new Set<string>(lockedMemberIds);
        selectedIds.forEach((id) => combined.add(id));
        const totalParticipants = combined.size + 1;
        if (totalParticipants < MIN_GROUP_MEMBERS) {
          setMemberPickerError(`Select at least ${MIN_GROUP_MEMBERS - 1} friends in total`);
          return;
        }
        handleMemberPickerClose();
        router.push({
          pathname: '/group/create',
          params: {
            members: JSON.stringify(Array.from(combined)),
            sourceChatId: chatId,
          },
        } as any);
        return;
      }

      if (!selectedIds.length) {
        setMemberPickerError('Select at least one friend to add');
        return;
      }

      setMemberPickerBusy(true);
      const response = await ChatService.addMembers(chatId, selectedIds);
      setMemberPickerBusy(false);
      if (!response.success) {
        setMemberPickerError(response.error || 'Failed to add members');
        return;
      }
      if (response.data?.chat) {
        applyChatUpdate(response.data.chat);
      }
      NotificationService.show('success', 'Members added to group');
      DeviceEventEmitter.emit('chats:refresh');
      handleMemberPickerClose();
    },
    [applyChatUpdate, chatId, handleMemberPickerClose, lockedMemberIds, memberPickerMode]
  );

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
      const normalizedParticipants: ChatParticipant[] = Array.isArray(chatData.participants)
        ? (chatData.participants as any[]).map((participant) => ({
            id: participant.id?.toString?.() ?? String(participant.id),
            username: participant.username || participant.email || 'Friend',
            profile_picture: participant.profile_picture || null,
            status: participant.status || null,
          }))
        : [];

      if (normalizedParticipants.length) {
        UserCacheService.addUsers(normalizedParticipants as any[]);
      }
      syncParticipants(normalizedParticipants);

      const parsedUserIds: string[] = Array.isArray(chatData.userIds)
        ? chatData.userIds.map((pid: any) => pid?.toString?.() ?? String(pid))
        : (() => {
            try {
              const parsed = JSON.parse(chatData.users ?? '[]');
              if (Array.isArray(parsed)) {
                return parsed.map((pid: any) => pid?.toString?.() ?? String(pid));
              }
            } catch (err) {
              console.warn('chat:parseUsers', 'Failed to parse chat user list', err);
            }
            return [];
          })();

      participantIdsRef.current = parsedUserIds;

      const isGroupChat = Boolean(chatData.isGroup ?? chatData.is_group);
      const ownerIdValue =
        chatData.ownerId?.toString?.() ?? chatData.owner_id?.toString?.() ?? null;
      const avatarUrl = chatData.avatarUrl ?? chatData.avatar_url ?? null;

      let otherParticipantId: string | null = null;
      let displayName = 'Friend';

      if (isGroupChat) {
        displayName = chatData.name || chatData.displayName || 'Group chat';
      } else {
        if (!normalizedParticipants.length && parsedUserIds.length) {
          const fallbackId =
            parsedUserIds.find((pid) => pid !== currentUserId) ?? parsedUserIds[0];
          if (fallbackId) {
            const userResponse = await ApiService.getUserById(fallbackId, token);
            if (userResponse.success && userResponse.data) {
              normalizedParticipants.push({
                id: fallbackId,
                username: userResponse.data.username || userResponse.data.email || 'Friend',
                profile_picture: userResponse.data.profile_picture || null,
                status: userResponse.data.status || null,
              });
              syncParticipants(normalizedParticipants);
            }
          }
        }

        const counterpart = normalizedParticipants.find(
          (participant) => participant.id !== currentUserId
        );
        otherParticipantId = counterpart?.id ?? null;
        displayName = counterpart?.username || displayName;
      }

      otherUserIdRef.current = otherParticipantId || null;
      receiverNameRef.current = displayName;
      setReceiverUsername(displayName);
      setTypingUserLabel(displayName);

      const chatPayload = {
        ...chatData,
        participants: normalizedParticipants,
        userIds: parsedUserIds,
        avatarUrl,
        ownerId: ownerIdValue,
      };
      applyChatUpdate(chatPayload);

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
    syncParticipants,
    applyChatUpdate,
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
      let nextValue = value;
      if (value.length > MESSAGE_CHAR_LIMIT) {
        nextValue = value.slice(0, MESSAGE_CHAR_LIMIT);
        if (!composerLimitWarningRef.current) {
          NotificationService.show('warning', `Messages are limited to ${MESSAGE_CHAR_LIMIT} characters`);
          composerLimitWarningRef.current = true;
        }
      } else if (composerLimitWarningRef.current) {
        composerLimitWarningRef.current = false;
      }

      setNewMessage(nextValue);
      if (!chatId) {
        return;
      }

      if (nextValue.length > 0 && !typingStateRef.current.isTyping) {
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

  const handleAttachmentPicker = useCallback(async () => {
    if (!chatId || attachmentPickerBusy) {
      return;
    }
    try {
      setAttachmentPickerBusy(true);
      const pickerResult = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: '*/*',
      });
      if (pickerResult.canceled) {
        return;
      }
      const document: any =
        (pickerResult.assets && pickerResult.assets[0]) ||
        ((pickerResult as any)?.uri ? (pickerResult as any) : null);
      if (!document?.uri) {
        NotificationService.show('error', 'Unable to read the selected file');
        return;
      }

      const uploadResponse = await ChatService.uploadAttachment(
        chatId,
        {
          uri: document.uri,
          name: document.name || `upload-${Date.now()}`,
          type: document.mimeType || document.type || 'application/octet-stream',
        },
        authTokenRef.current || undefined
      );

      if (!uploadResponse.success || !uploadResponse.data?.attachment) {
        NotificationService.show('error', uploadResponse.error || 'Failed to upload file');
        return;
      }

      const mapped = mapServerAttachment(uploadResponse.data.attachment);
      setPendingAttachments((prev) => [...prev, mapped]);
    } catch (error) {
      console.error('Attachment picker failed:', error);
      NotificationService.show('error', 'Unable to add this file');
    } finally {
      setAttachmentPickerBusy(false);
    }
  }, [attachmentPickerBusy, chatId]);

  const handleRemoveAttachment = useCallback(
    async (attachmentId: string) => {
      setPendingAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
      try {
        await ChatService.deleteAttachment(attachmentId, authTokenRef.current || undefined);
      } catch (error) {
        console.error('Failed to remove attachment', error);
      }
    },
    []
  );

  const startEditMessage = useCallback(
    (message: Message) => {
      if (message.isPlaceholder || message.isDeleted) {
        return;
      }
      setEditingMessage(message);
      setNewMessage(message.content);
      requestAnimationFrame(() => composerRef.current?.focus());
    },
    []
  );

  const handleSubmitEdit = useCallback(async () => {
    if (!editingMessage || !currentUserId || !chatId) {
      return;
    }

    const trimmed = newMessage.trim();
    if (!trimmed.length) {
      NotificationService.show('warning', 'Message cannot be empty');
      return;
    }
    if (trimmed.length > MESSAGE_CHAR_LIMIT) {
      NotificationService.show('error', `Messages are limited to ${MESSAGE_CHAR_LIMIT} characters`);
      return;
    }

    setIsSendingMessage(true);
    ensureTypingStopped();

    try {
      const token = authTokenRef.current ?? (await StorageService.getAuthToken());
      if (!token) {
        throw new Error('Missing auth token for edit');
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
        message: encodeMessagePayload(trimmed, resolveReplyMetadata(editingMessage.replyTo)),
        recipientUserIds: recipientIds,
        token,
        currentUserId,
      });

      wsService.send({
        type: 'message_edit',
        chatId,
        messageId: editingMessage.id,
        envelopes: encryptedPayload.envelopes,
        senderDeviceId: encryptedPayload.senderDeviceId,
        messageType: 'e2ee',
      });

      setEditingMessage(null);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to edit message', error);
      NotificationService.show('error', 'Unable to edit this message. Please try again.');
    } finally {
      setIsSendingMessage(false);
    }
  }, [
    chatId,
    currentUserId,
    editingMessage,
    ensureTypingStopped,
    newMessage,
    resolveReplyMetadata,
    wsService,
  ]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setNewMessage('');
  }, []);

  const deleteMessageById = useCallback(
    async (message: Message) => {
      if (!chatId) {
        return;
      }
      try {
        const token = authTokenRef.current ?? (await StorageService.getAuthToken());
        if (!token) {
          throw new Error('Missing auth token');
        }
        authTokenRef.current = token;
        const response = await ApiService.delete(`/chat/${chatId}/messages/${message.id}`, token);
        if (!response.success) {
          NotificationService.show('error', response.error || 'Unable to delete message');
          return;
        }
        const deletedLabel = buildDeletedLabel(user?.username || 'You');
        setMessagesAnimated((prev) =>
          prev.map((msg) => {
            if (msg.id !== message.id) {
              return msg;
            }
            return {
              ...msg,
              content: deletedLabel,
              isPlaceholder: true,
              isDeleted: true,
              deletedByName: user?.username || 'You',
              deletedLabel,
              deletedAt: new Date().toISOString(),
              attachments: (msg.attachments || []).map((attachment) => ({
                ...attachment,
                status: 'expired' as const,
                previewUrl: undefined,
                downloadUrl: undefined,
              })),
            };
          })
        );
      } catch (error) {
        console.error('Failed to delete message', error);
        NotificationService.show('error', 'Unable to delete message right now');
      }
    },
    [chatId, setMessagesAnimated, user?.username]
  );

  const confirmDeleteMessage = useCallback(
    (message: Message) => {
      Alert.alert('Delete message?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMessageById(message) },
      ]);
    },
    [deleteMessageById]
  );

  const handleOpenLink = useCallback((url?: string | null) => {
    if (!url) {
      NotificationService.show('error', 'Link is not available');
      return;
    }
    Linking.openURL(url).catch((error) => {
      console.error('Failed to open link', error);
      NotificationService.show('error', 'Unable to open link');
    });
  }, []);

  const handleAttachmentTap = useCallback(
    (attachment: MessageAttachment) => {
      if (!attachment || attachment.status === 'expired') {
        NotificationService.show('info', 'File or image expired');
        return;
      }
      setPreviewAttachment(attachment);
    },
    []
  );

  const handleDownloadAttachment = useCallback(
    (attachment?: MessageAttachment | null) => {
      if (!attachment) {
        return;
      }
      handleOpenLink(attachment.downloadUrl || attachment.previewUrl);
    },
    [handleOpenLink]
  );

  const handleShareAttachment = useCallback(
    async (attachment?: MessageAttachment | null) => {
      if (!attachment?.downloadUrl) {
        NotificationService.show('error', 'Download is not available for this file');
        return;
      }
      try {
        await Share.share({
          url: attachment.downloadUrl,
          title: attachment.name,
          message: attachment.downloadUrl,
        });
      } catch (error) {
        console.error('Failed to share attachment', error);
        NotificationService.show('error', 'Unable to share this file');
      }
    },
    []
  );

  const handleBubbleLongPress = useCallback(
    (message: Message) => {
      if (message.isPlaceholder) {
        if (message.replyTo) {
          setReplyContext(buildReplyPayloadFromMessage(message));
        }
        return;
      }

      const canEdit = message.senderId === currentUserId && !message.isDeleted;
      const canDelete = message.senderId === currentUserId && !message.isDeleted;

      const actions: Array<{ label: string; onPress: () => void; destructive?: boolean }> = [
        {
          label: 'Reply',
          onPress: () => setReplyContext(buildReplyPayloadFromMessage(message)),
        },
      ];

      if (canEdit) {
        actions.push({
          label: 'Edit',
          onPress: () => startEditMessage(message),
        });
      }

      if (canDelete) {
        actions.push({
          label: 'Delete',
          destructive: true,
          onPress: () => confirmDeleteMessage(message),
        });
      }

      actions.push({ label: 'Cancel', onPress: () => {} });

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: actions.map((action) => action.label),
            cancelButtonIndex: actions.length - 1,
            destructiveButtonIndex: actions.findIndex((action) => action.destructive),
          },
          (index) => {
            const action = actions[index];
            if (action && action.onPress) {
              action.onPress();
            }
          }
        );
      } else {
        const alertButtons = actions
          .filter((action) => action.label !== 'Cancel')
          .map((action) => ({
            text: action.label,
            onPress: action.onPress,
            style: (action.destructive ? 'destructive' : 'default') as 'destructive' | 'default',
          }));

        alertButtons.push({
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel' as 'cancel',
        });

        Alert.alert('Message options', undefined, alertButtons);
      }
    },
    [buildReplyPayloadFromMessage, confirmDeleteMessage, currentUserId, startEditMessage]
  );

  const handleSendMessage = useCallback(async () => {
    if (!currentUserId || !chatId) {
      return;
    }

    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage && pendingAttachments.length === 0) {
      return;
    }

    if (editingMessage) {
      await handleSubmitEdit();
      return;
    }

    if (newMessage.length > MESSAGE_CHAR_LIMIT) {
      NotificationService.show('error', `Messages are limited to ${MESSAGE_CHAR_LIMIT} characters`);
      return;
    }

    const pendingReply = replyContext;
    const normalizedReply = replyContext ? resolveReplyMetadata(replyContext) : undefined;
    const encodedPayload = encodeMessagePayload(trimmedMessage, normalizedReply);
    const temporaryId = `temp-${Date.now()}`;
    const attachmentsSnapshot = pendingAttachments;
    const attachmentIds = attachmentsSnapshot.map((attachment) => attachment.id);
    const optimisticMessage: Message = {
      id: temporaryId,
      senderId: currentUserId,
      receiverId: String(otherUserIdRef.current ?? ''),
      senderName: user?.username || 'You',
      senderAvatar: user?.profile_picture || null,
      content: trimmedMessage,
      timestamp: new Date().toISOString(),
      status: 'sending',
      replyTo: normalizedReply,
      attachments: attachmentsSnapshot,
    };

    setMessagesAnimated((prev) => {
      const withoutPlaceholders = prev.filter((msg) => !msg.isPlaceholder || msg.isDeleted);
      return [...withoutPlaceholders, optimisticMessage];
    });
    InteractionManager.runAfterInteractions(() => {
      scrollToBottom();
    });
    setNewMessage('');
    setReplyContext(null);
    if (attachmentsSnapshot.length) {
      setPendingAttachments([]);
    }
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
        attachments: attachmentIds,
      });
    } catch (error) {
      console.error(`Error sending encrypted message to chat ${chatId}:`, error);
      NotificationService.show('error', 'Failed to send message. Please try again.');
      setMessagesAnimated((prev) => prev.filter((msg) => msg.id !== temporaryId));
      setNewMessage(trimmedMessage);
      if (pendingReply) {
        setReplyContext(pendingReply);
      }
      if (attachmentIds.length) {
        setPendingAttachments(attachmentsSnapshot);
      }
    } finally {
      setIsSendingMessage(false);
    }
  }, [
    chatId,
    currentUserId,
    editingMessage,
    ensureTypingStopped,
    handleSubmitEdit,
    newMessage,
    pendingAttachments,
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
            const senderProfile = resolveSenderProfile(payload.senderId ? String(payload.senderId) : '');
            const attachments = mapServerAttachments(payload.attachments);
            const newEntry: Message = {
              id: String(payload.messageId ?? payload.id ?? Date.now()),
              senderId: String(payload.senderId ?? ''),
              receiverId: String(payload.receiverId ?? otherUserIdRef.current ?? ''),
              senderName: senderProfile.name,
              senderAvatar: senderProfile.avatar,
              content: decodedPayload.text,
              timestamp: local,
              utcTimestamp: utc,
              timezone,
              replyTo,
              attachments,
              isEdited: Boolean(payload.editedAt),
              editedAt: payload.editedAt ?? undefined,
            };

            setMessagesAnimated((prev) => {
              const withoutPlaceholders = prev.filter((msg) => !msg.isPlaceholder || msg.isDeleted);
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
          const senderProfile = resolveSenderProfile(payload.senderId ? String(payload.senderId) : '');
          const attachments = mapServerAttachments(payload.attachments);
          const newEntry: Message = {
            id: String(payload.messageId ?? payload.id ?? Date.now()),
            senderId: String(payload.senderId ?? ''),
            receiverId: String(payload.receiverId ?? otherUserIdRef.current ?? ''),
            senderName: senderProfile.name,
            senderAvatar: senderProfile.avatar,
            content: decodedPayload.text,
            timestamp: local,
            utcTimestamp: utc,
            timezone,
            replyTo,
            attachments,
            isEdited: Boolean(payload.editedAt),
            editedAt: payload.editedAt ?? undefined,
          };

          setMessagesAnimated((prev) => {
            const withoutPlaceholders = prev.filter((msg) => !msg.isPlaceholder || msg.isDeleted);
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
          const deletedLabel = buildDeletedLabel(payload.deletedByName);
          setMessagesAnimated((prev) =>
            prev.map((msg) => {
              if (msg.id !== deletedId) {
                return msg;
              }
              return {
                ...msg,
                content: deletedLabel,
                isPlaceholder: true,
                isDeleted: true,
                deletedLabel,
                deletedByName: payload.deletedByName || msg.senderName || 'Member',
                deletedAt: payload.deletedAt || new Date().toISOString(),
                attachments: (msg.attachments || []).map((attachment) => ({
                  ...attachment,
                  status: 'expired' as const,
                  previewUrl: undefined,
                  downloadUrl: undefined,
                })),
              };
            })
          );
          return;
        }
        case 'message_edited': {
          const editedId = String(payload.messageId ?? payload.id ?? '');
          if (!editedId) {
            return;
          }
          const attachments = mapServerAttachments(payload.attachments);
          const editedAt = payload.editedAt || payload.timestamp || new Date().toISOString();
          if (Array.isArray(payload.envelopes) && payload.envelopes.length) {
            try {
              const token = authTokenRef.current ?? (await StorageService.getAuthToken());
              authTokenRef.current = token || null;
              const decrypted = await CryptoService.decryptMessage({
                chatId: targetChatId,
                envelopes: payload.envelopes,
                senderId: payload.senderId ?? payload.userId ?? null,
                currentUserId,
                token: token || undefined,
              });
              if (!decrypted) {
                console.warn(`Failed to decrypt edited message ${editedId}`);
                return;
              }
              const decodedPayload = decodeMessagePayload(decrypted);
              const serverReply = resolveReplyMetadata(payload.reply);
              const replyTo = serverReply || resolveReplyMetadata(decodedPayload.replyTo);
              setMessagesAnimated((prev) =>
                prev.map((msg) => {
                  if (msg.id !== editedId) {
                    return msg;
                  }
                  return {
                    ...msg,
                    content: decodedPayload.text,
                    replyTo,
                    isEdited: true,
                    editedAt,
                    attachments,
                    isPlaceholder: Boolean(msg.isDeleted),
                  };
                })
              );
            } catch (error) {
              console.error('Failed to decrypt edited message payload:', error);
            }
          } else if (typeof payload.content === 'string') {
            const decodedPayload = decodeMessagePayload(payload.content);
            const serverReply = resolveReplyMetadata(payload.reply);
            const replyTo = serverReply || resolveReplyMetadata(decodedPayload.replyTo);
            setMessagesAnimated((prev) =>
              prev.map((msg) => {
                if (msg.id !== editedId) {
                  return msg;
                }
                return {
                  ...msg,
                  content: decodedPayload.text,
                  replyTo,
                  isEdited: true,
                  editedAt,
                  attachments,
                  isPlaceholder: Boolean(msg.isDeleted),
                };
              })
            );
          }
          return;
        }
        case 'chat_updated':
        case 'chat_members_added':
        case 'chat_members_removed': {
          if (payload.chat) {
            applyChatUpdate(payload.chat);
          }
          return;
        }
        case 'chat_deleted':
        case 'chat_removed': {
          NotificationService.show('warning', 'This conversation is no longer available');
          router.replace('/home');
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
      resolveSenderProfile,
      applyChatUpdate,
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
        <MessageBubble
          key={messageItem.id}
          message={messageItem}
          isMine={isMine}
          isFirstInGroup={isFirstInGroup}
          isLastInGroup={isLastInGroup}
          showStatus={shouldShowStatus}
          showTimestamp={shouldShowTimestamp}
          onReplyPress={(reply) => setThreadRootId(reply.messageId)}
          onReplySwipe={() => {
            if (messageItem.isPlaceholder) return;
            setReplyContext(buildReplyPayloadFromMessage(messageItem));
          }}
          isHighlighted={highlightedMessageId === messageItem.id}
          replyCount={replyCount}
          onOpenThread={(messageId) => setThreadRootId(messageId)}
          showSenderMetadata={Boolean(chatDetails?.isGroup)}
          onBubblePress={() =>
            setTimestampVisibleFor((prev) => (prev === messageItem.id ? null : messageItem.id))
          }
          onBubbleLongPress={() => handleBubbleLongPress(messageItem)}
          onAttachmentPress={handleAttachmentTap}
          onLinkPress={handleOpenLink}
        />
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
      chatDetails?.isGroup,
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

  const isComposerEmpty = newMessage.trim().length === 0;
  const hasPendingAttachments = pendingAttachments.length > 0;
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
  const sendButtonDisabled =
    ((isComposerEmpty && !hasPendingAttachments) || isSendingMessage || attachmentPickerBusy);

  const isGroupChat = Boolean(chatDetails?.isGroup);
  const isGroupOwner = isGroupChat && chatDetails?.ownerId === currentUserId;
  const shouldShowAddButton = isGroupChat ? isGroupOwner : Boolean(otherUserIdRef.current);
  const addButtonMode: 'create' | 'add' = isGroupChat ? 'add' : 'create';
  const receiverPresenceLabel = useMemo(() => {
    if (!chatDetails || chatDetails.isGroup) {
      return null;
    }
    const counterpart = chatDetails.participants?.find(
      (participant) => participant.id !== currentUserId
    );
    if (!counterpart?.status) {
      return null;
    }
    const normalized = String(counterpart.status).toLowerCase();
    if (normalized === 'online') {
      return 'Online';
    }
    if (normalized === 'away') {
      return 'Away';
    }
    return 'Offline';
  }, [chatDetails, currentUserId]);

  if (!chatId) {
    return (
      <SafeAreaView style={styles.fallbackContainer}>
        <Text style={styles.fallbackText}>Unable to open this chat.</Text>
      </SafeAreaView>
    );
  }

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
        <Pressable onPress={handleNavigateBack} style={styles.headerButton} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {receiverUsername}
          </Text>
          {!isGroupChat && receiverPresenceLabel ? (
            <Text style={styles.presenceLabel}>{receiverPresenceLabel}</Text>
          ) : null}
        </View>
        {shouldShowAddButton ? (
          <Pressable
            onPress={() => handleOpenMemberPicker(addButtonMode)}
            style={styles.headerActionButton}
            accessibilityRole="button"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFFFFF" />
            <Ionicons name="add" size={12} color="#FFFFFF" style={styles.headerActionAdd} />
          </Pressable>
        ) : (
          <View style={styles.headerButtonPlaceholder} />
        )}
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
        {pendingAttachments.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.attachmentPreviewContent}
            style={styles.attachmentPreviewRow}
          >
            {pendingAttachments.map((attachment) => (
              <View key={`pending-${attachment.id}`} style={styles.attachmentChip}>
                <Ionicons
                  name={attachment.isImage ? 'image-outline' : 'document-text-outline'}
                  size={16}
                  color="#ffffff"
                />
                <View style={styles.attachmentChipBody}>
                  <Text style={styles.attachmentChipName} numberOfLines={1}>
                    {attachment.name}
                  </Text>
                  <Text style={styles.attachmentChipMeta}>{formatBytes(attachment.fileSize)}</Text>
                </View>
                <Pressable
                  onPress={() => handleRemoveAttachment(attachment.id)}
                  style={styles.attachmentChipRemove}
                  hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                >
                  <Ionicons name="close" size={12} color="#ffffff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
        {editingMessage ? (
          <View style={styles.editingBanner}>
            <Ionicons name="create-outline" size={14} color="#ffffff" style={styles.editingBannerIcon} />
            <Text style={styles.editingBannerText}>Editing message</Text>
            <Pressable onPress={handleCancelEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={14} color="#ffffff" />
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.inputContainer, { paddingBottom: composerBottomPadding }]}>
          <Pressable
            onPress={handleAttachmentPicker}
            style={[
              styles.attachButton,
              (attachmentPickerBusy || Boolean(editingMessage)) && styles.attachButtonDisabled,
            ]}
            disabled={attachmentPickerBusy || Boolean(editingMessage)}
            accessibilityRole="button"
          >
            {attachmentPickerBusy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="attach" size={18} color="#ffffff" />
            )}
          </Pressable>
          <View style={styles.composerColumn}>
            <TextInput
              ref={composerRef}
              style={styles.textInput}
              value={newMessage}
              onChangeText={handleComposerChange}
              maxLength={MESSAGE_CHAR_LIMIT}
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
      <GroupMemberPicker
        visible={memberPickerVisible}
        title={memberPickerMode === 'create' ? 'Create a group chat' : 'Add members'}
        friends={friendRoster}
        lockedIds={lockedMemberIds}
        excludedIds={excludedMemberIds}
        minimumTotal={memberPickerMode === 'create' ? MIN_GROUP_MEMBERS : 2}
        maxTotal={MAX_GROUP_MEMBERS}
        mode={memberPickerMode}
        isLoading={isFriendRosterLoading}
        isSubmitting={memberPickerBusy}
        errorMessage={memberPickerError}
        onClose={handleMemberPickerClose}
        onConfirm={handleMemberPickerConfirm}
      />
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
      <Modal
        visible={Boolean(previewAttachment)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewAttachment(null)}
      >
        <View style={styles.attachmentModalOverlay}>
          <View style={styles.attachmentModalCard}>
            <View style={styles.attachmentModalHeader}>
              <Text style={styles.attachmentModalTitle} numberOfLines={1}>
                {previewAttachment?.name || 'Attachment'}
              </Text>
              <Pressable onPress={() => setPreviewAttachment(null)}>
                <Ionicons name="close" size={18} color="#ffffff" />
              </Pressable>
            </View>
            {previewAttachment?.isImage && previewAttachment.previewUrl ? (
              <Image
                source={{ uri: previewAttachment.previewUrl }}
                style={styles.attachmentModalImage}
                contentFit="contain"
              />
            ) : (
              <View style={styles.attachmentModalFile}>
                <Ionicons name="document-text-outline" size={28} color="#ffffff" />
                <Text style={styles.attachmentModalFileName} numberOfLines={1}>
                  {previewAttachment?.name}
                </Text>
                <Text style={styles.attachmentModalFileMeta}>
                  {formatBytes(previewAttachment?.fileSize || 0)}
                </Text>
              </View>
            )}
            <View style={styles.attachmentModalActions}>
              <Pressable
                style={styles.attachmentModalButton}
                onPress={() => handleDownloadAttachment(previewAttachment)}
              >
                <Ionicons name="download-outline" size={18} color="#03040A" />
                <Text style={styles.attachmentModalButtonText}>Download</Text>
              </Pressable>
              <Pressable
                style={styles.attachmentModalButton}
                onPress={() => handleShareAttachment(previewAttachment)}
              >
                <Ionicons name="share-outline" size={18} color="#03040A" />
                <Text style={styles.attachmentModalButtonText}>Share</Text>
              </Pressable>
            </View>
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
  headerTitleWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  headerActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionAdd: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  presenceLabel: {
    marginTop: 2,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
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
  messageContent: {
    flexShrink: 1,
    maxWidth: '90%',
  },
  messageContentMine: {
    alignItems: 'flex-end',
  },
  messageContentTheirs: {
    alignItems: 'flex-start',
  },
  senderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderMetaAvatar: {
    marginRight: 8,
  },
  senderMetaName: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: '600',
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
    marginHorizontal: 12,
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
  attachmentGroup: {
    rowGap: 8,
  },
  attachmentCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 8,
  },
  attachmentImageCard: {
    width: 220,
    height: 160,
  },
  attachmentFileCard: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
  },
  attachmentFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  attachmentFileIcon: {
    marginRight: 8,
  },
  attachmentFileBody: {
    flex: 1,
  },
  attachmentFileName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  attachmentFileMeta: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  attachmentExpiredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  attachmentExpiredText: {
    color: '#ffffff',
    fontSize: 12,
    textAlign: 'center',
  },
  linkText: {
    color: '#5ECDF8',
    textDecorationLine: 'underline',
  },
  embedPreview: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  embedImage: {
    width: 220,
    height: 140,
  },
  embedLabel: {
    paddingVertical: 6,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
  },
  editedLabel: {
    marginTop: 4,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    alignSelf: 'flex-end',
  },
  attachmentPreviewRow: {
    maxHeight: 72,
  },
  attachmentPreviewContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: 'center',
    columnGap: 8,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    columnGap: 8,
  },
  attachmentChipBody: {
    maxWidth: 180,
  },
  attachmentChipName: {
    color: '#ffffff',
    fontSize: 13,
  },
  attachmentChipMeta: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
  },
  attachmentChipRemove: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    columnGap: 8,
  },
  editingBannerIcon: {
    marginRight: 2,
  },
  editingBannerText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    flex: 1,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachButtonDisabled: {
    opacity: 0.4,
  },
  attachmentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  attachmentModalCard: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#101425',
    padding: 16,
  },
  attachmentModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  attachmentModalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  attachmentModalImage: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  attachmentModalFile: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  attachmentModalFileName: {
    color: '#ffffff',
    fontSize: 15,
  },
  attachmentModalFileMeta: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
  },
  attachmentModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  attachmentModalButton: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  attachmentModalButtonText: {
    color: '#03040A',
    fontWeight: '600',
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
