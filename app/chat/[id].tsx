import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, BackHandler, DeviceEventEmitter, FlatList, Keyboard, KeyboardAvoidingView, LayoutAnimation, InteractionManager, Modal, PanResponder, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableWithoutFeedback, UIManager, View, NativeSyntheticEvent, NativeScrollEvent, Pressable, Linking, Share, GestureResponderEvent, Dimensions } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../../hooks/useAuth';
import { ApiService } from '../../services/ApiService';
import { NotificationService } from '../../services/NotificationService';
import { StorageService } from '../../services/StorageService';
import { CryptoService } from '../../services/CryptoService';
import { DeviceService } from '../../services/DeviceService';
import { WebSocketMessage, WebSocketService } from '../../services/WebSocketService';
import { UserCacheService } from '../../services/UserCacheService';
import { TimezoneService } from '../../services/TimezoneService';
import { ChatService, type UploadableAsset } from '../../services/ChatService';
import { GroupMemberPicker } from '../../components/GroupMemberPicker';
import { UserAvatar } from '../../components/UserAvatar';
import { AppBackground } from '../../components/AppBackground';

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
  isVideo: boolean;
  previewUrl?: string;
  downloadUrl?: string;
  publicViewUrl?: string;
  publicDownloadUrl?: string;
  localUri?: string;
  uploadPending?: boolean;
}

interface SeenReceipt {
  userId: string;
  username?: string | null;
  avatarUrl?: string | null;
  seenAt?: string | null;
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
  seenBy?: SeenReceipt[];
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
const API_ROOT = ApiService.baseUrl.replace(/\/v1\/?$/i, '');
const ATTACHMENT_STATUS_MAP: Record<string, 'pending' | 'active' | 'expired'> = {
  pending: 'pending',
  active: 'active',
  expired: 'expired',
};
const MAX_PENDING_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;

const buildAbsoluteUrl = (pathValue?: string | null): string | undefined => {
  if (!pathValue) {
    return undefined;
  }
  if (/^https?:\/\//i.test(pathValue)) {
    return pathValue;
  }
  const normalized = pathValue.startsWith('/') ? pathValue : `/${pathValue}`;
  return `${API_ROOT}${normalized}`;
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

const mapServerAttachment = (raw: any): MessageAttachment => {
  const mime = typeof raw.mimeType === 'string' ? raw.mimeType.toLowerCase() : '';
  const inferredImage = mime.startsWith('image/');
  const inferredVideo = mime.startsWith('video/');
  return {
    id: String(raw.id),
    name: raw.name || raw.fileName || 'Attachment',
    mimeType: raw.mimeType || 'application/octet-stream',
    fileSize: Number(raw.fileSize) || 0,
    status: ATTACHMENT_STATUS_MAP[String(raw.status)] ?? 'active',
    isImage: Boolean(raw.isImage ?? inferredImage),
    isVideo: Boolean(raw.isVideo ?? inferredVideo),
    previewUrl: buildAbsoluteUrl(raw.publicViewPath || raw.previewPath),
    downloadUrl: buildAbsoluteUrl(raw.downloadPath || raw.publicDownloadPath),
    publicViewUrl: buildAbsoluteUrl(raw.publicViewPath),
    publicDownloadUrl: buildAbsoluteUrl(raw.publicDownloadPath),
    uploadPending: false,
  };
};

const mapServerAttachments = (raw?: any): MessageAttachment[] => {
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.map((entry) => mapServerAttachment(entry));
  }
  return [];
};

const resolveAttachmentUri = (attachment: MessageAttachment): string | undefined =>
  attachment.publicViewUrl ||
  attachment.previewUrl ||
  attachment.publicDownloadUrl ||
  attachment.downloadUrl ||
  attachment.localUri;

const mapServerReceipts = (raw?: any): SeenReceipt[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => {
      const identifier = entry?.userId ?? entry?.viewerId ?? entry?.id;
      if (!identifier) {
        return null;
      }
      return {
        userId: String(identifier),
        username: entry?.username ?? entry?.viewerUsername ?? entry?.viewerName ?? null,
        avatarUrl: entry?.avatarUrl ?? entry?.viewerAvatar ?? entry?.avatar ?? null,
        seenAt: entry?.seenAt ?? entry?.timestamp ?? null,
      } as SeenReceipt;
    })
    .filter(Boolean) as SeenReceipt[];
};

const LINK_REGEX = /(https?:\/\/[^\s]+)/gi;
const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp|bmp|tiff|heic|heif)$/i.test(url.split('?')[0]);
const isVideoUrl = (url: string) => /\.(mp4|m4v|mov|avi|webm|mkv)$/i.test(url.split('?')[0]);

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

const findEmbeddableLink = (text: string): { type: 'image' | 'video'; url: string } | null => {
  if (!text) {
    return null;
  }
  const matches = text.match(LINK_REGEX);
  if (!matches) {
    return null;
  }
  const imageMatch = matches.find((url) => isImageUrl(url));
  if (imageMatch) {
    return { type: 'image', url: imageMatch };
  }
  const videoMatch = matches.find((url) => isVideoUrl(url));
  if (videoMatch) {
    return { type: 'video', url: videoMatch };
  }
  return null;
};

const clampFutureTimestamp = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  const now = Date.now();
  const maxFutureSkew = 5 * 60 * 1000; // 5 minutes
  if (parsed > now + maxFutureSkew) {
    return new Date(now).toISOString();
  }
  return value;
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

const resolveContentText = (
  decoded: { text: string },
  preview?: string | null,
  hasAttachments = false
): string => {
  if (decoded.text && decoded.text.trim().length) {
    return decoded.text;
  }
  if (!hasAttachments) {
    const trimmedPreview = typeof preview === 'string' ? preview.trim() : '';
    if (trimmedPreview.length) {
      return trimmedPreview;
    }
  }
  return decoded.text || '';
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
  const clampedLocal = clampFutureTimestamp(local) || local;
  const clampedUtc = clampFutureTimestamp(utc) || utc;
  return { local: clampedLocal, utc: clampedUtc, timezone };
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

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const hasIntlSupport = typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function';

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

  const includeYear = today.getFullYear() !== date.getFullYear();
  const fallback = `${MONTH_LABELS[date.getMonth()]} ${date.getDate()}${includeYear ? `, ${date.getFullYear()}` : ''}`;

  if (!hasIntlSupport) {
    return fallback;
  }

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };
  if (includeYear) {
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
  if (!hasIntlSupport) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const paddedHours = String(hours).padStart(2, '0');
    const paddedMinutes = String(minutes).padStart(2, '0');
    return `${paddedHours}:${paddedMinutes}`;
  }

  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return timeFormatter.format(date);
};

const sortMessagesChronologically = (list: Message[]): Message[] =>
  list
    .slice()
    .sort((a, b) => parseDate(a.timestamp).getTime() - parseDate(b.timestamp).getTime());

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
  onBubbleLongPress?: (event: GestureResponderEvent) => void;
  onAttachmentPress?: (attachment: MessageAttachment, attachments?: MessageAttachment[]) => void;
  onLinkPress?: (url: string) => void;
  isGroupChat: boolean;
  directRecipient?: ChatParticipant | null;
  seenOverride?: SeenReceipt[] | null;
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
  isGroupChat,
  directRecipient,
  seenOverride = null,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const swipePeakRef = useRef(0);
  const replyTriggeredRef = useRef(false);
  const textSegments = useMemo(() => splitTextByLinks(message.content || ''), [message.content]);
  const embeddableLink = useMemo(() => {
    if (message.isPlaceholder || message.attachments?.length) {
      return null;
    }
    return findEmbeddableLink(message.content || '');
  }, [message.attachments, message.content, message.isPlaceholder]);
  const [embedLoaded, setEmbedLoaded] = useState(false);
  const [embedFailed, setEmbedFailed] = useState(false);
useEffect(() => {
  setEmbedLoaded(false);
  setEmbedFailed(false);
}, [embeddableLink?.url]);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => {
          const horizontal = Math.abs(gesture.dx);
          const vertical = Math.abs(gesture.dy);
          if (horizontal < 4) {
            return false;
          }
          return horizontal * 0.8 > vertical;
        },
        onPanResponderGrant: () => {
          swipePeakRef.current = 0;
          replyTriggeredRef.current = false;
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
          if (
            magnitude >= SWIPE_REPLY_THRESHOLD &&
            !replyTriggeredRef.current &&
            onReplySwipe
          ) {
            replyTriggeredRef.current = true;
            onReplySwipe();
            Haptics.selectionAsync().catch(() => null);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          const magnitude =
            swipePeakRef.current ||
            (isMine ? Math.abs(Math.min(gesture.dx, 0)) : Math.abs(Math.max(gesture.dx, 0)));
          if (!replyTriggeredRef.current && magnitude > SWIPE_REPLY_THRESHOLD && onReplySwipe) {
            onReplySwipe();
          }
          swipePeakRef.current = 0;
          replyTriggeredRef.current = false;
          Animated.spring(swipeAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          swipePeakRef.current = 0;
          replyTriggeredRef.current = false;
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
    message.replyTo && styles.messageRowWithReply,
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
    message.replyTo && styles.messageBubbleWithReply,
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
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const hasAttachments = attachments.length > 0;
  const overrideSeenReceipts = Array.isArray(seenOverride) ? seenOverride : [];
  const activeSeenReceipts = overrideSeenReceipts;
  const shouldShowSeenAvatars = activeSeenReceipts.length > 0;
  const MAX_SEEN_AVATARS = 4;
  const displayedSeenReceipts = (() => {
    if (!shouldShowSeenAvatars) {
      return [];
    }
    if (isGroupChat) {
      return activeSeenReceipts.slice(-MAX_SEEN_AVATARS);
    }
    return activeSeenReceipts.slice(-1);
  })();
  const unseenReceiptCount =
    shouldShowSeenAvatars && isGroupChat
      ? Math.max(activeSeenReceipts.length - displayedSeenReceipts.length, 0)
      : 0;

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
          onLongPress={(event) => onBubbleLongPress?.(event)}
          style={[
            styles.messageContent,
            isMine ? styles.messageContentMine : styles.messageContentTheirs,
            message.replyTo && styles.messageContentWithReply,
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
                style={[
                  styles.replyChip,
                  isMine ? styles.replyChipMine : styles.replyChipTheirs,
                ]}
              >
                <View
                  style={[
                    styles.replyChipBar,
                    isMine ? styles.replyChipBarMine : styles.replyChipBarTheirs,
                  ]}
                />
                <View style={styles.replyChipBody}>
                  <Text style={styles.replyChipLabel} numberOfLines={1}>
                    {message.replyTo.senderLabel}
                  </Text>
                  {message.replyTo.preview ? (
                    <Text style={styles.replyChipText} numberOfLines={2}>
                      {message.replyTo.preview}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
            {(() => {
              if (!hasAttachments) return null;
              const previewableImageAttachments = attachments.filter(
                (attachment) =>
                  attachment.isImage &&
                  attachment.status !== 'expired' &&
                  (attachment.previewUrl || attachment.publicViewUrl || attachment.localUri)
              );
              const previewableVideoAttachments = attachments.filter(
                (attachment) =>
                  attachment.isVideo &&
                  attachment.status !== 'expired' &&
                  (attachment.previewUrl || attachment.publicViewUrl || attachment.localUri)
              );
              const combinedPreviewable = [...previewableImageAttachments, ...previewableVideoAttachments];
              const previewableIds = new Set(combinedPreviewable.map((attachment) => attachment.id));
              const fileAttachments = attachments.filter((attachment) => !previewableIds.has(attachment.id));
              const showPreview = combinedPreviewable.length > 0;
              const primaryItem = showPreview ? combinedPreviewable[0] : null;
              const remainingPreviewItems = showPreview ? combinedPreviewable.slice(1) : [];

              return (
                <>
                  {primaryItem ? (
                    <Pressable
                      key={`${message.id}-hero-image`}
                      style={styles.heroImageCard}
                      onPress={() => onAttachmentPress?.(primaryItem, combinedPreviewable)}
                    >
                      {primaryItem.isVideo ? (
                        resolveAttachmentUri(primaryItem) ? (
                          <Video
                            source={{ uri: resolveAttachmentUri(primaryItem)! }}
                            style={styles.heroVideo}
                            resizeMode={ResizeMode.COVER}
                            useNativeControls
                            shouldPlay={false}
                            isLooping={false}
                          />
                        ) : (
                          <View style={styles.heroVideoPlaceholder}>
                            <Ionicons name="play" size={24} color="#ffffff" />
                          </View>
                        )
                      ) : (
                        <Image
                          source={{
                            uri: primaryItem.previewUrl || primaryItem.publicViewUrl || primaryItem.localUri,
                          }}
                          style={styles.heroImage}
                          contentFit="cover"
                        />
                      )}
                      {remainingPreviewItems.length ? (
                        <View style={styles.attachmentMoreBadge}>
                          <Text style={styles.attachmentMoreBadgeText}>+{remainingPreviewItems.length} more</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  ) : null}

                  {fileAttachments.length ? (
                    <View
                      style={[
                        styles.attachmentGroup,
                        isMine ? styles.attachmentGroupMine : styles.attachmentGroupTheirs,
                      ]}
                    >
                      {fileAttachments.map((attachment) => {
                        const isExpired = attachment.status === 'expired';
                        const isPreviewable =
                          (attachment.isImage || attachment.isVideo) &&
                          (attachment.previewUrl || attachment.publicViewUrl || attachment.localUri);
                        return (
                          <Pressable
                            key={`${message.id}-file-${attachment.id}`}
                            style={[
                              styles.attachmentCard,
                              isPreviewable ? styles.attachmentImageCardCompact : styles.attachmentFileCard,
                            ]}
                            onPress={() => !isExpired && onAttachmentPress?.(attachment, [attachment])}
                            disabled={isExpired}
                          >
                            {isPreviewable ? (
                              attachment.isVideo ? (
                                <View style={styles.attachmentVideoThumb}>
                                  {resolveAttachmentUri(attachment) ? (
                                    <Video
                                      source={{ uri: resolveAttachmentUri(attachment)! }}
                                      style={StyleSheet.absoluteFillObject}
                                      resizeMode={ResizeMode.COVER}
                                      useNativeControls
                                      shouldPlay={false}
                                    />
                                  ) : null}
                                  <View style={styles.attachmentVideoOverlay}>
                                    <Ionicons name="play" size={18} color="#ffffff" />
                                  </View>
                                </View>
                              ) : (
                                <Image
                                  source={{
                                    uri: attachment.previewUrl || attachment.publicViewUrl || attachment.localUri,
                                  }}
                                  style={styles.attachmentImage}
                                  contentFit="cover"
                                />
                              )
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
                                <Text style={styles.attachmentExpiredText}>File or media expired</Text>
                              </View>
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </>
              );
            })()}
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
            {embeddableLink && !embedFailed ? (
              <Pressable
                style={styles.embedPreview}
                onPress={() => onLinkPress?.(embeddableLink.url)}
              >
                {embeddableLink.type === 'image' ? (
                  <Image
                    source={{ uri: embeddableLink.url }}
                    style={styles.embedImage}
                    contentFit="cover"
                    transition={300}
                    onLoad={() => setEmbedLoaded(true)}
                    onError={() => setEmbedFailed(true)}
                  />
                ) : (
                  <Video
                    source={{ uri: embeddableLink.url }}
                    style={styles.embedVideo}
                    resizeMode={ResizeMode.COVER}
                    useNativeControls
                    shouldPlay={false}
                    onLoadStart={() => setEmbedLoaded(false)}
                    onLoad={() => setEmbedLoaded(true)}
                    onError={() => setEmbedFailed(true)}
                  />
                )}
                {!embedLoaded ? (
                  <View style={styles.embedPlaceholder}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.embedPlaceholderText}>Previewing…</Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
            {message.isEdited && !message.isPlaceholder ? (
              <Text style={styles.editedLabel}>Edited</Text>
            ) : null}
          </View>
          {statusText && !(message.status === 'seen' && shouldShowSeenAvatars) ? (
            <Text style={styles.statusText}>{statusText}</Text>
          ) : null}
          {shouldShowSeenAvatars && displayedSeenReceipts.length ? (
            <View style={styles.seenReceiptRow}>
              {isGroupChat && unseenReceiptCount > 0 ? (
                <View style={styles.seenReceiptOverflow}>
                  <Text style={styles.seenReceiptOverflowText}>+{unseenReceiptCount}</Text>
                </View>
              ) : null}
              {displayedSeenReceipts.map((receipt) => (
                <UserAvatar
                  key={`${message.id}-seen-${receipt.userId}`}
                  uri={receipt.avatarUrl || undefined}
                  name={receipt.username || 'Member'}
                  size={18}
                  style={styles.seenReceiptAvatar}
                />
              ))}
            </View>
          ) : null}
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
  const listLayoutHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const composerLimitWarningRef = useRef(false);
  const initialScrollDoneRef = useRef(false);

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
  const pendingRefreshRef = useRef(false);
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
  const [previewContext, setPreviewContext] = useState<{ attachments: MessageAttachment[]; index: number } | null>(null);
const previewListRef = useRef<FlatList<MessageAttachment>>(null);
const [previewIndex, setPreviewIndex] = useState(0);
const handleClosePreview = useCallback(() => setPreviewContext(null), []);
const previewPanResponder = useMemo(
  () =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 10,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 80) {
          handleClosePreview();
        }
      },
    }),
  [handleClosePreview]
);
const [editingMessage, setEditingMessage] = useState<Message | null>(null);
const [messageActionContext, setMessageActionContext] = useState<{
    message: Message;
    actions: Array<{ label: string; onPress: () => void; destructive?: boolean }>;
    anchorY: number;
    anchorX: number;
    above?: boolean;
  } | null>(null);
const [contextTargetId, setContextTargetId] = useState<string | null>(null);
  const messageActionAnim = useRef(new Animated.Value(0)).current;
  const windowHeight = Dimensions.get('window').height;
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const attachmentSheetAnim = useRef(new Animated.Value(0)).current;
  const ACTION_CARD_WIDTH = 280;
  const ACTION_CARD_HEIGHT = 240;
  const SCREEN_WIDTH = Dimensions.get('window').width;
  const messageActionAnchor = useMemo(() => {
    if (!messageActionContext) {
      return { top: 0, left: SCREEN_WIDTH / 2 - ACTION_CARD_WIDTH / 2 };
    }
    const placeAbove = messageActionContext.above ?? messageActionContext.anchorY > windowHeight * 0.55;
    let rawTop = placeAbove
      ? messageActionContext.anchorY - ACTION_CARD_HEIGHT - 12
      : messageActionContext.anchorY + 12;
    rawTop = Math.max(rawTop, 52);
    const maxTop = windowHeight - ACTION_CARD_HEIGHT - 32;
    const top = Math.min(rawTop, maxTop);
    const rawLeft = messageActionContext.anchorX - ACTION_CARD_WIDTH / 2;
    const left = Math.max(12, Math.min(rawLeft, SCREEN_WIDTH - ACTION_CARD_WIDTH - 12));
    return { top, left };
  }, [ACTION_CARD_WIDTH, SCREEN_WIDTH, messageActionContext, windowHeight]);
  const messageActionArrowLeft = useMemo(() => {
    if (!messageActionContext) {
      return ACTION_CARD_WIDTH / 2 - 6;
    }
    const offset = messageActionContext.anchorX - messageActionAnchor.left - 6;
    return Math.max(14, Math.min(offset, ACTION_CARD_WIDTH - 26));
  }, [ACTION_CARD_WIDTH, messageActionAnchor.left, messageActionContext]);
  const messageActionArrowTop = useMemo(() => {
    if (!messageActionContext) {
      return -6;
    }
    const placeAbove = messageActionContext.above ?? messageActionContext.anchorY > windowHeight * 0.55;
    return placeAbove ? ACTION_CARD_HEIGHT - 6 : -6;
  }, [ACTION_CARD_HEIGHT, messageActionContext, windowHeight]);

  const dismissMessageActions = useCallback(
    (onFinished?: () => void) => {
      if (!messageActionContext) {
        onFinished?.();
        return;
      }
      Animated.timing(messageActionAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setMessageActionContext(null);
        setContextTargetId(null);
        onFinished?.();
      });
    },
    [messageActionAnim, messageActionContext]
  );

  useEffect(() => {
    if (messageActionContext) {
      messageActionAnim.setValue(0);
      Animated.spring(messageActionAnim, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }).start();
    }
  }, [messageActionAnim, messageActionContext]);

  useEffect(() => {
    if (attachmentSheetVisible) {
      attachmentSheetAnim.setValue(0);
      Animated.spring(attachmentSheetAnim, {
        toValue: 1,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }).start();
    }
  }, [attachmentSheetAnim, attachmentSheetVisible]);

  useEffect(() => {
    if (previewContext && previewContext.attachments.length) {
      const nextIndex = Math.min(
        Math.max(previewContext.index, 0),
        previewContext.attachments.length - 1
      );
      setPreviewIndex(nextIndex);
      requestAnimationFrame(() => {
        try {
          previewListRef.current?.scrollToIndex({ index: nextIndex, animated: false });
        } catch {
          // ignore scroll failures
        }
      });
    }
  }, [previewContext]);
  const currentPreviewAttachment = previewContext
    ? previewContext.attachments[Math.min(previewIndex, previewContext.attachments.length - 1)]
    : null;
  const closeAttachmentSheet = useCallback(() => {
    Animated.timing(attachmentSheetAnim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      setAttachmentSheetVisible(false);
    });
  }, [attachmentSheetAnim]);

  const handleMessageActionSelect = useCallback(
    (action: { label: string; onPress: () => void }) => {
      dismissMessageActions(() => {
        requestAnimationFrame(() => {
          action.onPress?.();
        });
      });
    },
    [dismissMessageActions]
  );
  const resolveActionIcon = useCallback((label: string): any => {
    const normalized = label.toLowerCase();
    if (normalized.includes('reply')) return 'return-down-back';
    if (normalized.includes('edit')) return 'create-outline';
    if (normalized.includes('delete')) return 'trash-outline';
    if (normalized.includes('copy')) return 'copy-outline';
    if (normalized.includes('link')) return 'link-outline';
    if (normalized.includes('forward')) return 'arrow-redo-outline';
    if (normalized.includes('thread')) return 'chatbubble-ellipses-outline';
    return 'ellipsis-horizontal';
  }, []);

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

  // Keep autoscroll snappy; only animate when explicitly requested (e.g., user taps the CTA)
  const scrollToBottom = useCallback((force = false, animated = false) => {
    if (!force && !isNearBottomRef.current) {
      return;
    }
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
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

  const seenPlacementMap = useMemo(() => {
    const placement = new Map<string, SeenReceipt[]>();
    const latestByUser = new Map<
      string,
      { index: number; receipt: SeenReceipt; messageId: string }
    >();
    messages.forEach((msg, index) => {
      (msg.seenBy || []).forEach((receipt) => {
        if (!receipt?.userId || receipt.userId === currentUserId) {
          return;
        }
        const existing = latestByUser.get(receipt.userId);
        if (!existing || index > existing.index) {
          latestByUser.set(receipt.userId, {
            index,
            receipt,
            messageId: msg.id,
          });
        }
      });
    });
    latestByUser.forEach(({ receipt, messageId }) => {
      const list = placement.get(messageId);
      if (list) {
        list.push(receipt);
      } else {
        placement.set(messageId, [receipt]);
      }
    });
    placement.forEach((list) => {
      list.sort((a, b) => {
        const at = a.seenAt ? Date.parse(a.seenAt) : 0;
        const bt = b.seenAt ? Date.parse(b.seenAt) : 0;
        return bt - at;
      });
    });
    return placement;
  }, [currentUserId, messages]);

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
        let decryptFailed = false;

        const receiverId =
          raw.receiverId ??
          raw.receiver_id ??
          otherUserId ??
          (participantIdsRef.current.find((pid) => pid !== String(senderId)) ?? '');

        const { local, utc, timezone } = resolveMessageTimestamps(raw, timezoneFallback);
        const preview = typeof raw.preview === 'string' ? raw.preview : undefined;
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
            content = '[Encrypted message could not be decrypted]';
            decryptFailed = true;
            missingEnvelope = true;
          }
        } else {
          content = raw.content ?? preview ?? '';
        }

        if (content == null) {
          if (isDeleted) {
            content = buildDeletedLabel(deletedByName || resolveSenderProfile(String(senderId)).name);
          } else {
            content = preview || '[Message unavailable]';
            missingEnvelope = true;
            decryptFailed = true;
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

        const decodedPayload = decodeMessagePayload(content ?? '');
        const contentText = resolveContentText(decodedPayload, preview, attachments.length > 0);
        const serverReply = resolveReplyMetadata((raw as any)?.reply);
        const replyTo = isDeleted
          ? undefined
          : serverReply || resolveReplyMetadata(decodedPayload.replyTo);

        const senderProfile = resolveSenderProfile(String(senderId));
        const seenBy = mapServerReceipts((raw as any)?.seenBy);
        results.push({
          id: String(idValue),
          senderId: String(senderId),
          receiverId: String(receiverId),
          senderName: senderProfile.name,
          senderAvatar: senderProfile.avatar,
          content: contentText,
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
          seenBy,
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
    (
      status: MessageStatus,
      messageId?: string,
      timestamp?: string | null,
      receipt?: SeenReceipt | null
    ) => {
      if (!currentUserId) {
        return;
      }

      setMessagesAnimated((prev) => {
        const next = prev.map((msg) => {
          if (msg.senderId !== currentUserId || msg.isPlaceholder) {
            return msg;
          }

          const applyReceipt = (target: Message): Message => {
            const deliveredAt = status === 'delivered' && timestamp ? timestamp : target.deliveredAt;
            const seenAtValue = status === 'seen' && timestamp ? timestamp : target.seenAt;

            if (status !== 'seen' || !receipt?.userId) {
              return {
                ...target,
                status,
                deliveredAt,
                seenAt: seenAtValue ?? target.seenAt,
              };
            }
            const existing = Array.isArray(target.seenBy) ? target.seenBy : [];
            const alreadyIndexed = existing.some((entry) => entry.userId === receipt.userId);
            const mergedReceipts = alreadyIndexed ? existing : [...existing, receipt];
            return {
              ...target,
              status,
              deliveredAt,
              seenAt: seenAtValue ?? target.seenAt,
              seenBy: mergedReceipts,
            };
          };

          if (messageId) {
            if (msg.id === String(messageId)) {
              return applyReceipt(msg);
            }
            return msg;
          }

          if (msg.status !== 'seen') {
            return applyReceipt(msg);
          }

          return msg;
        });

        return next;
      });
    },
    [currentUserId, setMessagesAnimated]
  );

  const applyAckToLatestMessage = useCallback(
    (incoming: { messageId?: string | number; createdAt?: string; preview?: string; attachments?: any[] }) => {
      if (!currentUserId || !incoming?.messageId) {
        return;
      }
      const messageId = String(incoming.messageId);
      const previewText = typeof incoming.preview === 'string' ? incoming.preview : '';
      const attachmentIds =
        Array.isArray(incoming.attachments) && incoming.attachments.length
          ? incoming.attachments
              .map((entry) => entry?.id ?? entry?.attachmentId ?? entry)
              .filter((id) => id != null)
              .map((id) => String(id))
          : [];
      const normalizePreview = (value: string) => value.trim().slice(0, 300);
      const incomingPreview = normalizePreview(previewText);

      setMessagesAnimated((prev) => {
        const candidates = prev
          .map((msg, index) => ({ msg, index }))
          .filter(
            ({ msg }) => msg.senderId === currentUserId && msg.status === 'sending' && !msg.isPlaceholder
          );

        if (!candidates.length) {
          return prev;
        }

        const matched = candidates.find(({ msg }) => {
          const localPreview = normalizePreview(msg.content || '');
          const previewMatches =
            !incomingPreview.length ||
            localPreview.startsWith(incomingPreview) ||
            incomingPreview.startsWith(localPreview);

          if (!previewMatches) {
            return false;
          }

          if (!attachmentIds.length) {
            return true;
          }

          const localAttachmentIds = (msg.attachments || [])
            .map((attachment) => attachment.id)
            .filter(Boolean)
            .map((id) => String(id));

          return attachmentIds.every((id) => localAttachmentIds.includes(id));
        });

        const targetIndex = matched?.index ?? candidates[0].index;
        const target = prev[targetIndex];
        if (!target) {
          return prev;
        }

        const next = [...prev];
        next[targetIndex] = {
          ...target,
          id: messageId,
          status: 'sent',
          timestamp: incoming.createdAt ?? target.timestamp,
        };
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
        const sorted = sortMessagesChronologically(cleaned);

        setMessagesAnimated((prev) => {
          const existingIds = new Set(sorted.map((msg) => msg.id));
          const localSending = prev.filter(
            (msg) => msg.status === 'sending' && !existingIds.has(msg.id)
          );
          return sortMessagesChronologically([...sorted, ...localSending]);
        });
        if (missingEnvelopeRef.current) {
          requestReencrypt('missing_history');
        }
        lastSeenMessageIdRef.current = null;
        setHasMore(response.data?.hasMore ?? false);
        nextCursorRef.current = response.data?.nextCursor || null;
        initialLoadCompleteRef.current = true;
        InteractionManager.runAfterInteractions(() => {
          scrollToBottom(true, false);
        });
      } catch (error) {
        console.error(`Error loading messages for chat ${chatIdentifier}:`, error);
        setMessagesAnimated((prev) => {
          if (prev.length) {
            return prev;
          }
          return generatePlaceholderMessages(displayName);
        });
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

  const scheduleRefreshMessages = useCallback(() => {
    if (pendingRefreshRef.current) {
      return;
    }
    pendingRefreshRef.current = true;
    setTimeout(() => {
      refreshMessages().finally(() => {
        pendingRefreshRef.current = false;
      });
    }, 250);
  }, [refreshMessages]);

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
        const cleaned = sortMessagesChronologically(transformed.filter(Boolean));

        setMessagesWithoutAnimation((prev) => {
          const existingIds = new Set(prev.map((msg) => msg.id));
          const filtered = cleaned.filter((msg) => !existingIds.has(msg.id));
          if (!filtered.length) {
            return prev;
          }
          const merged = [...filtered, ...prev];
          return sortMessagesChronologically(merged);
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

  const ensureWebSocketReady = useCallback(
    async (timeoutMs = 2000) => {
      const waitUntilReady = () =>
        new Promise<boolean>((resolve) => {
          const start = Date.now();
          const poll = () => {
            const open = wsService.connected && wsService.socket?.readyState === WebSocket.OPEN;
            if (open) {
              resolve(true);
              return;
            }
            if (Date.now() - start >= timeoutMs) {
              resolve(false);
              return;
            }
            setTimeout(poll, 100);
          };
          poll();
        });

      try {
        if (!wsService.connected || wsService.socket?.readyState !== WebSocket.OPEN) {
          await wsService.connect();
        }
        return await waitUntilReady();
      } catch (error) {
        console.error('Failed to ensure WebSocket ready for chat:', error);
        return false;
      }
    },
    [wsService]
  );

  const uploadSingleAttachment = useCallback(
    async (file: UploadableAsset) => {
      if (!chatId) {
        NotificationService.show('error', 'This conversation is not available');
        return;
      }

      const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const isImage = Boolean(file.type && file.type.toLowerCase().startsWith('image/'));
      const isVideo = Boolean(file.type && file.type.toLowerCase().startsWith('video/'));
      const placeholder: MessageAttachment = {
        id: tempId,
        name: file.name || 'Attachment',
        mimeType: file.type || 'application/octet-stream',
        fileSize: Number(file.size) || 0,
        status: 'pending',
        isImage,
        isVideo,
        previewUrl: isImage ? file.uri : undefined,
        downloadUrl: undefined,
        publicViewUrl: undefined,
        publicDownloadUrl: undefined,
        localUri: file.uri,
        uploadPending: true,
      };

      setPendingAttachments((prev) => [...prev, placeholder]);

      try {
        const response = await ChatService.uploadAttachment(chatId, file);
        if (!response.success || !response.data?.attachment) {
          NotificationService.show('error', response.error || 'Failed to upload attachment');
          setPendingAttachments((prev) => prev.filter((attachment) => attachment.id !== tempId));
          return;
        }
        const mapped = mapServerAttachment(response.data.attachment);
        setPendingAttachments((prev) =>
          prev.map((attachment) =>
            attachment.id === tempId
              ? {
                  ...mapped,
                  uploadPending: false,
                }
              : attachment
          )
        );
      } catch (error) {
        console.error('Attachment upload failed:', error);
        NotificationService.show('error', 'Unable to upload attachment');
        setPendingAttachments((prev) => prev.filter((attachment) => attachment.id !== tempId));
      }
    },
    [chatId]
  );

  const ensureAttachmentCapacity = useCallback(
    (files: UploadableAsset[]) => {
      const sanitized = files.filter((file) => file && file.uri);
      if (!sanitized.length) {
        return false;
      }

      const availableSlots = MAX_PENDING_ATTACHMENTS - pendingAttachments.length;
      if (sanitized.length > availableSlots) {
        NotificationService.show(
          'warning',
          `You can attach up to ${MAX_PENDING_ATTACHMENTS} items per message`
        );
        return false;
      }

      const currentBytes = pendingAttachments.reduce(
        (total, attachment) => total + (attachment.fileSize || 0),
        0
      );
      const newBytes = sanitized.reduce((total, file) => total + (file.size || 0), 0);
      if (currentBytes + newBytes > MAX_ATTACHMENT_BYTES) {
        NotificationService.show('warning', 'Attachments are limited to 100MB per message');
        return false;
      }

      return true;
    },
    [pendingAttachments]
  );

  const handleUploadBatch = useCallback(
    async (files: UploadableAsset[]) => {
      const sanitized = files.filter((file) => file && file.uri);
      if (!sanitized.length) {
        return;
      }
      if (!ensureAttachmentCapacity(sanitized)) {
        return;
      }
      if (attachmentPickerBusy) {
        NotificationService.show('info', 'Please wait for the current upload to complete');
        return;
      }

      setAttachmentPickerBusy(true);
      try {
        for (const file of sanitized) {
          // eslint-disable-next-line no-await-in-loop
          await uploadSingleAttachment(file);
        }
      } finally {
        setAttachmentPickerBusy(false);
      }
    },
    [attachmentPickerBusy, ensureAttachmentCapacity, uploadSingleAttachment]
  );

  const handlePickDocument = useCallback(async () => {
    closeAttachmentSheet();
    try {
      const pickerResult = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: '*/*',
      });
      const raw: any = pickerResult;
      let documents: any[] = [];

      if (Array.isArray(raw.assets) && raw.assets.length) {
        documents = raw.assets;
      } else if (Array.isArray(raw.results) && raw.results.length) {
        documents = raw.results;
      } else if (raw && typeof raw.uri === 'string' && raw.uri.length) {
        documents = [raw];
      } else {
        return;
      }

      const files: UploadableAsset[] = documents
        .filter((doc: any) => doc?.uri)
        .map((doc: any) => ({
          uri: doc.uri,
          name: doc.name || `upload-${Date.now()}`,
          type: doc.mimeType || doc.type || 'application/octet-stream',
          size: doc.size,
        }));

      await handleUploadBatch(files);
    } catch (error) {
      console.error('Document picker failed:', error);
      NotificationService.show('error', 'Unable to add this file');
    }
  }, [handleUploadBatch]);

  const handlePickPhoto = useCallback(async () => {
    closeAttachmentSheet();
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        NotificationService.show('warning', 'Media access is required to send photos or videos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.9,
        allowsMultipleSelection: true,
      });
      if (result.canceled) {
        return;
      }

      const files: UploadableAsset[] = (result.assets || [])
        .filter((asset) => asset?.uri)
        .map((asset) => {
          const isVideo = asset.type === 'video' || asset.mimeType?.startsWith?.('video/');
          return {
            uri: asset.uri,
            name:
              asset.fileName ||
              (isVideo ? `video-${Date.now()}.mp4` : `photo-${Date.now()}.jpg`),
            type: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
            size: asset.fileSize,
          };
        });

      await handleUploadBatch(files);
    } catch (error) {
      console.error('Media picker failed:', error);
      NotificationService.show('error', 'Unable to add this media');
    }
  }, [handleUploadBatch]);

  const handleAttachmentTrigger = useCallback(() => {
    if (!chatId) {
      NotificationService.show('error', 'This conversation is not available');
      return;
    }
    if (attachmentPickerBusy) {
      NotificationService.show('info', 'Please wait for the current upload to complete');
      return;
    }
    if (pendingAttachments.length >= MAX_PENDING_ATTACHMENTS) {
      NotificationService.show('warning', `You can attach up to ${MAX_PENDING_ATTACHMENTS} items per message`);
      return;
    }
    setAttachmentSheetVisible(true);
  }, [attachmentPickerBusy, chatId, pendingAttachments.length]);

  const handleRemoveAttachment = useCallback(
    async (attachmentId: string) => {
      setPendingAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
      if (!/^\d+$/.test(attachmentId)) {
        return;
      }
      try {
        await ChatService.deleteAttachment(attachmentId);
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
    (attachment: MessageAttachment, siblings?: MessageAttachment[]) => {
      if (!attachment || attachment.status === 'expired') {
        NotificationService.show('info', 'File or media expired');
        return;
      }
      const gallery = (siblings || []).filter(
        (item) =>
          (item.isImage || item.isVideo) &&
          item.status !== 'expired' &&
          ((item.previewUrl || item.publicViewUrl) ?? item.localUri)
      );
      if (
        (attachment.isImage || attachment.isVideo) &&
        (attachment.previewUrl || attachment.publicViewUrl || attachment.localUri)
      ) {
        const source = gallery.length ? gallery : [attachment];
        const index = source.findIndex((item) => item.id === attachment.id);
        setPreviewContext({
          attachments: source,
          index: index >= 0 ? index : 0,
        });
      } else {
        setPreviewContext({
          attachments: [attachment],
          index: 0,
        });
      }
    },
    []
  );

  const handleDownloadAttachment = useCallback(
    (attachment?: MessageAttachment | null) => {
      if (!attachment) {
        return;
      }
      const target =
        attachment.publicDownloadUrl ||
        attachment.downloadUrl ||
        attachment.publicViewUrl ||
        attachment.previewUrl ||
        attachment.localUri;
      if (!target) {
        NotificationService.show('error', 'Download is not available for this file');
        return;
      }
      handleOpenLink(target);
    },
    [handleOpenLink]
  );

  const handleShareAttachment = useCallback(
    async (attachment?: MessageAttachment | null) => {
      if (!attachment) {
        NotificationService.show('error', 'Share link is not available for this file');
        return;
      }
      const target =
        attachment.publicDownloadUrl ||
        attachment.downloadUrl ||
        attachment.publicViewUrl ||
        attachment.previewUrl ||
        attachment.localUri;
      if (!target) {
        NotificationService.show('error', 'Share link is not available for this file');
        return;
      }
      try {
        const payload =
          Platform.OS === 'ios'
            ? { url: target, title: attachment.name }
            : { url: target, title: attachment.name, message: target };
        await Share.share(payload);
      } catch (error) {
        console.error('Failed to share attachment', error);
        NotificationService.show('error', 'Unable to share this file');
      }
    },
    []
  );

  const handleCopyMessage = useCallback(async (message: Message) => {
    const text = message.content || '';
    if (!text) {
      NotificationService.show('info', 'Nothing to copy');
      return;
    }
    try {
      await Clipboard.setStringAsync(text);
      NotificationService.show('success', 'Copied');
    } catch (error) {
      console.error('Failed to copy text', error);
      NotificationService.show('error', 'Unable to copy');
    }
  }, []);

  const handleCopyAttachmentLink = useCallback(async (attachment?: MessageAttachment | null) => {
    if (!attachment) {
      NotificationService.show('info', 'No attachment to copy');
      return;
    }
    const target =
      attachment.publicDownloadUrl ||
      attachment.downloadUrl ||
      attachment.publicViewUrl ||
      attachment.previewUrl ||
      attachment.localUri;
    if (!target) {
      NotificationService.show('error', 'Link not available for this file');
      return;
    }
    try {
      await Clipboard.setStringAsync(target);
      NotificationService.show('success', 'Link copied');
    } catch (error) {
      console.error('Failed to copy attachment link', error);
      NotificationService.show('error', 'Unable to copy link');
    }
  }, []);

  const handleBubbleLongPress = useCallback(
    (message: Message, event?: GestureResponderEvent) => {
      if (message.isPlaceholder) {
        if (message.replyTo) {
          setReplyContext(buildReplyPayloadFromMessage(message));
        }
        return;
      }

      const canEdit = message.senderId === currentUserId && !message.isDeleted;
      const canDelete = message.senderId === currentUserId && !message.isDeleted;
      const primaryAttachment = (message.attachments || [])[0];

      const replyAction = () => setReplyContext(buildReplyPayloadFromMessage(message));
      const actions: Array<{ label: string; onPress: () => void; destructive?: boolean }> = [
        {
          label: 'Reply',
          onPress: replyAction,
        },
      ];

      if (message.content) {
        actions.push({
          label: 'Copy',
          onPress: () => handleCopyMessage(message),
        });
      }

      if (primaryAttachment) {
        actions.push({
          label: 'Copy link',
          onPress: () => handleCopyAttachmentLink(primaryAttachment),
        });
        actions.push({
          label: 'Share',
          onPress: () => handleShareAttachment(primaryAttachment),
        });
      }

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

      if (!canEdit && !canDelete) {
        actions.push({ label: 'Cancel', onPress: () => {} });
      } else {
        actions.push({ label: 'Cancel', onPress: () => {} });
      }
      const anchorY = event?.nativeEvent?.pageY ?? windowHeight / 2;
      const anchorX = event?.nativeEvent?.pageX ?? SCREEN_WIDTH / 2;
      const above = anchorY > windowHeight * 0.55;
      setContextTargetId(message.id);
      setMessageActionContext({ message, actions, anchorY, anchorX, above });
    },
    [
      buildReplyPayloadFromMessage,
      confirmDeleteMessage,
      currentUserId,
      handleCopyAttachmentLink,
      handleCopyMessage,
      handleShareAttachment,
      startEditMessage,
      windowHeight,
      SCREEN_WIDTH,
    ]
  );

  const handleSendMessage = useCallback(async () => {
    if (!currentUserId || !chatId) {
      return;
    }

    const isSocketReady = await ensureWebSocketReady();
    if (!isSocketReady) {
      NotificationService.show('error', 'Nem sikerült csatlakozni a chat szerverhez. Próbáld újra.');
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
  const attachmentsSnapshot = pendingAttachments.filter((attachment) => !attachment.uploadPending);
    const attachmentIds = attachmentsSnapshot
      .map((attachment) => attachment.id)
      .filter((id) => /^\d+$/.test(id));
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
      seenBy: [],
    };

    setMessagesAnimated((prev) => {
      const withoutPlaceholders = prev.filter((msg) => !msg.isPlaceholder || msg.isDeleted);
      return [...withoutPlaceholders, optimisticMessage];
    });
    InteractionManager.runAfterInteractions(() => {
      scrollToBottom(true, false);
    });
    setNewMessage('');
    setReplyContext(null);
    if (attachmentsSnapshot.length) {
      setPendingAttachments((prev) => prev.filter((attachment) => attachment.uploadPending));
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

      const previewText = trimmedMessage.slice(0, 300);
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
        preview: previewText,
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
    ensureWebSocketReady,
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
          const viewerReceipt =
            status === 'seen' && payload.viewerId
              ? {
                  userId: String(payload.viewerId),
                  username: payload.viewerUsername || payload.viewerName || null,
                  avatarUrl: payload.viewerAvatar || null,
                  seenAt: statusTimestamp,
                }
              : undefined;
          updateOutgoingStatus(
            status,
            payload.messageId ? String(payload.messageId) : undefined,
            statusTimestamp,
            viewerReceipt
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
            preview: payload.preview,
            attachments: payload.attachments,
          });

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
              console.warn('Decryption failed for sent message envelope.');
              const { local, utc, timezone } = resolveMessageTimestamps(
                payload,
                payload.timezone || TimezoneService.getTimezone()
              );
              const senderProfile = resolveSenderProfile(payload.senderId ? String(payload.senderId) : '');
              const fallbackContent =
                typeof payload.preview === 'string' && payload.preview.trim().length
                  ? payload.preview
                  : '[Encrypted message could not be decrypted]';
              const newEntry: Message = {
                id: String(payload.messageId ?? payload.id ?? Date.now()),
                senderId: String(payload.senderId ?? ''),
                receiverId: String(payload.receiverId ?? otherUserIdRef.current ?? ''),
                senderName: senderProfile.name,
                senderAvatar: senderProfile.avatar,
                content: fallbackContent,
                timestamp: local,
                utcTimestamp: utc,
                timezone,
                replyTo: undefined,
                attachments: [],
                isEdited: Boolean(payload.editedAt),
                editedAt: payload.editedAt ?? undefined,
                status: 'sent',
                isPlaceholder: false,
              };
              setMessagesAnimated((prev) => {
                const cleaned = prev.filter((msg) => !msg.isDeleted);
                if (cleaned.some((msg) => msg.id === newEntry.id)) {
                  return cleaned;
                }
                const updated = cleaned.filter(
                  (msg) => !(msg.senderId === currentUserId && msg.status === 'sending')
                );
                return sortMessagesChronologically([...updated, newEntry]);
              });
              requestReencrypt('live_decrypt_failed');
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
            const contentText = resolveContentText(decodedPayload, payload.preview, attachments.length > 0);
            const newEntry: Message = {
              id: String(payload.messageId ?? payload.id ?? Date.now()),
              senderId: String(payload.senderId ?? ''),
              receiverId: String(payload.receiverId ?? otherUserIdRef.current ?? ''),
              senderName: senderProfile.name,
              senderAvatar: senderProfile.avatar,
              content: contentText,
              timestamp: local,
              utcTimestamp: utc,
              timezone,
              replyTo,
              attachments,
              isEdited: Boolean(payload.editedAt),
              editedAt: payload.editedAt ?? undefined,
              status: 'sent',
            };

            setMessagesAnimated((prev) => {
              const withoutPlaceholders = prev.filter((msg) => !msg.isPlaceholder || msg.isDeleted);
              if (withoutPlaceholders.some((msg) => msg.id === newEntry.id)) {
                return withoutPlaceholders;
              }
              const cleaned = withoutPlaceholders.filter(
                (msg) => !(msg.senderId === currentUserId && msg.status === 'sending')
              );
              return sortMessagesChronologically([...cleaned, newEntry]);
            });
          } catch (error) {
            console.error('Failed to decrypt sent message envelope:', error);
            requestReencrypt('live_decrypt_failed');
          }
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
              const { local, utc, timezone } = resolveMessageTimestamps(
                payload,
                payload.timezone || TimezoneService.getTimezone()
              );
              const senderProfile = resolveSenderProfile(payload.senderId ? String(payload.senderId) : '');
              const fallbackContent =
                typeof payload.preview === 'string' && payload.preview.trim().length
                  ? payload.preview
                  : '[Encrypted message could not be decrypted]';
              const fallbackEntry: Message = {
                id: String(payload.messageId ?? payload.id ?? Date.now()),
                senderId: String(payload.senderId ?? ''),
                receiverId: String(payload.receiverId ?? otherUserIdRef.current ?? ''),
                senderName: senderProfile.name,
                senderAvatar: senderProfile.avatar,
                content: fallbackContent,
                timestamp: local,
                utcTimestamp: utc,
                timezone,
                replyTo: undefined,
                attachments: [],
                isEdited: Boolean(payload.editedAt),
                editedAt: payload.editedAt ?? undefined,
                isPlaceholder: false,
              };
              setMessagesAnimated((prev) => {
                const cleaned = prev.filter((msg) => !msg.isDeleted);
                if (cleaned.some((msg) => msg.id === fallbackEntry.id)) {
                  return cleaned;
                }
                return sortMessagesChronologically([...cleaned, fallbackEntry]);
              });
              requestReencrypt('live_decrypt_failed');
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
            const contentText = resolveContentText(decodedPayload, payload.preview, attachments.length > 0);
            const newEntry: Message = {
              id: String(payload.messageId ?? payload.id ?? Date.now()),
              senderId: String(payload.senderId ?? ''),
              receiverId: String(payload.receiverId ?? otherUserIdRef.current ?? ''),
              senderName: senderProfile.name,
              senderAvatar: senderProfile.avatar,
              content: contentText,
              timestamp: local,
              utcTimestamp: utc,
              timezone,
              replyTo,
              attachments,
              isEdited: Boolean(payload.editedAt),
              editedAt: payload.editedAt ?? undefined,
              seenBy: [],
            };

            setMessagesAnimated((prev) => {
              const withoutPlaceholders = prev.filter((msg) => !msg.isPlaceholder || msg.isDeleted);
              const exists = withoutPlaceholders.some((msg) => msg.id === newEntry.id);
              if (exists) {
                return withoutPlaceholders;
              }
              return sortMessagesChronologically([...withoutPlaceholders, newEntry]);
            });
            scrollToBottom();
            scheduleRefreshMessages();
          } catch (error) {
            console.error('Failed to decrypt incoming message envelope:', error);
            refreshMessages();
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
          const contentText = resolveContentText(decodedPayload, payload.preview, attachments.length > 0);
          const newEntry: Message = {
            id: String(payload.messageId ?? payload.id ?? Date.now()),
            senderId: String(payload.senderId ?? ''),
            receiverId: String(payload.receiverId ?? otherUserIdRef.current ?? ''),
            senderName: senderProfile.name,
            senderAvatar: senderProfile.avatar,
            content: contentText,
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
            return sortMessagesChronologically([...withoutPlaceholders, newEntry]);
          });
          scrollToBottom();
          scheduleRefreshMessages();
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
      requestReencrypt,
      scheduleRefreshMessages,
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

  const handleListLayout = useCallback((event: any) => {
    listLayoutHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  const handleContentSizeChange = useCallback(
    (_: number, height: number) => {
      contentHeightRef.current = height;
      if (initialLoadCompleteRef.current && !initialScrollDoneRef.current) {
        initialScrollDoneRef.current = true;
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        });
        return;
      }
      if (!initialLoadCompleteRef.current || isNearBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom(true));
      }
    },
    [scrollToBottom]
  );

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
    initialScrollDoneRef.current = false;
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

  const directRecipient = useMemo(() => {
    if (chatDetails?.isGroup) {
      return null;
    }
    const participants = chatDetails?.participants || [];
    return (
      participants.find((participant) => participant.id !== currentUserId) || null
    );
  }, [chatDetails?.isGroup, chatDetails?.participants, currentUserId]);

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
          isHighlighted={highlightedMessageId === messageItem.id || contextTargetId === messageItem.id}
          replyCount={replyCount}
          onOpenThread={(messageId) => setThreadRootId(messageId)}
          showSenderMetadata={Boolean(chatDetails?.isGroup)}
          onBubblePress={() =>
            setTimestampVisibleFor((prev) => (prev === messageItem.id ? null : messageItem.id))
          }
          onBubbleLongPress={(event) => handleBubbleLongPress(messageItem, event)}
          onAttachmentPress={handleAttachmentTap}
          onLinkPress={handleOpenLink}
          isGroupChat={Boolean(chatDetails?.isGroup)}
          directRecipient={directRecipient}
          seenOverride={seenPlacementMap.get(messageItem.id) ?? null}
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
      Boolean(chatDetails?.isGroup),
      directRecipient,
      handleAttachmentTap,
      handleOpenLink,
      seenPlacementMap,
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
  const hasUploadingAttachments = pendingAttachments.some((attachment) => attachment.uploadPending);
  const keyboardOffset = useMemo(() => {
    if (Platform.OS !== 'ios') {
      return 0;
    }
    if (isKeyboardVisible) {
      return 0;
    }
    return Math.max(insets.bottom - 6, 0);
  }, [insets.bottom, isKeyboardVisible]);

  const composerBottomPadding = useMemo(() => {
    if (Platform.OS === 'ios') {
      return isKeyboardVisible ? 6 : Math.max(insets.bottom - 6, 4);
    }
    if (isKeyboardVisible) {
      return 2;
    }
    return Math.max(insets.bottom, 12);
  }, [insets.bottom, isKeyboardVisible]);
  const sendButtonDisabled =
    ((isComposerEmpty && !hasPendingAttachments) ||
      isSendingMessage ||
      attachmentPickerBusy ||
      hasUploadingAttachments);

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
      <AppBackground />
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
                      keyboardShouldPersistTaps="always"
                      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                      onLayout={handleListLayout}
                      onContentSizeChange={handleContentSizeChange}
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
                        onPress={() => scrollToBottom(true, true)}


                        accessibilityRole="button"


                      >


                        <Ionicons name="arrow-down" size={24} color="#FFFFFF" />


                      </Pressable>


                    )}


                  </Animated.View>


                )}


        
        {replyContext && (
          <View
            style={[
              styles.replyPreview,
              replyContext.senderId === currentUserId
                ? styles.replyPreviewMine
                : styles.replyPreviewTheirs,
            ]}
          >
            <View
              style={[
                styles.replyPreviewGlyph,
                replyContext.senderId === currentUserId
                  ? styles.replyPreviewGlyphMine
                  : styles.replyPreviewGlyphTheirs,
              ]}
            >
              <Ionicons
                name="return-down-back-outline"
                size={18}
                color={replyContext.senderId === currentUserId ? '#0B1120' : '#FFFFFF'}
              />
            </View>
            <View style={styles.replyPreviewBody}>
              <Text style={styles.replyPreviewLabel}>{replyContext.senderLabel}</Text>
              {replyContext.preview ? (
                <Text style={styles.replyPreviewText} numberOfLines={2}>
                  {replyContext.preview}
                </Text>
              ) : null}
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
                  name={
                    attachment.isVideo
                      ? 'videocam-outline'
                      : attachment.isImage
                        ? 'image-outline'
                        : 'document-text-outline'
                  }
                  size={16}
                  color="#ffffff"
                />
                <View style={styles.attachmentChipBody}>
                  <Text style={styles.attachmentChipName} numberOfLines={1}>
                    {attachment.name}
                  </Text>
                  {attachment.uploadPending ? (
                    <View style={styles.attachmentChipProgress}>
                      <ActivityIndicator size="small" color="#ffffff" />
                      <Text style={styles.attachmentChipMeta}>Uploading…</Text>
                    </View>
                  ) : (
                    <Text style={styles.attachmentChipMeta}>{formatBytes(attachment.fileSize)}</Text>
                  )}
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
            onPress={handleAttachmentTrigger}
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
            <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={styles.threadModalBody}>
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
        </View>
      </Modal>
      <Modal
        visible={Boolean(previewContext)}
        transparent
        animationType="fade"
        onRequestClose={handleClosePreview}
      >
        <View style={styles.attachmentModalOverlay} {...previewPanResponder.panHandlers}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View
            style={[
              styles.attachmentModalTopBar,
              {
                paddingTop:
                  Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 6,
              },
            ]}
          >
            <Pressable onPress={handleClosePreview} style={styles.attachmentModalIconButton}>
              <Ionicons name="chevron-down" size={22} color="#ffffff" />
            </Pressable>
            <View style={styles.attachmentModalTitleWrap}>
              <Text style={styles.attachmentModalTitle} numberOfLines={1}>
                {currentPreviewAttachment?.name || 'Attachment'}
              </Text>
              {currentPreviewAttachment?.fileSize ? (
                <Text style={styles.attachmentModalFileMeta}>
                  {formatBytes(currentPreviewAttachment.fileSize)}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={handleClosePreview} style={styles.attachmentModalIconButton}>
              <Ionicons name="close" size={18} color="#ffffff" />
            </Pressable>
          </View>
          <FlatList
            style={styles.attachmentModalCarousel}
            contentContainerStyle={styles.attachmentModalCarouselContent}
            ref={previewListRef}
            data={previewContext?.attachments || []}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.attachmentPreviewSlide}>
                {item.isImage && (item.previewUrl || item.publicViewUrl || item.localUri) ? (
                  <ScrollView
                    style={StyleSheet.absoluteFillObject}
                    contentContainerStyle={styles.attachmentZoomContainer}
                    minimumZoomScale={1}
                    maximumZoomScale={3}
                    centerContent
                  >
                    <Image
                      source={{ uri: item.previewUrl || item.publicViewUrl || item.localUri }}
                      style={styles.attachmentZoomImage}
                      contentFit="contain"
                    />
                  </ScrollView>
                ) : item.isVideo && resolveAttachmentUri(item) ? (
                  <Video
                    source={{ uri: resolveAttachmentUri(item)! }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode={ResizeMode.CONTAIN}
                    useNativeControls
                    shouldPlay={false}
                  />
                ) : (
                  <View style={styles.attachmentModalFile}>
                    <Ionicons name="document-text-outline" size={28} color="#ffffff" />
                    <Text style={styles.attachmentModalFileName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.attachmentModalFileMeta}>
                      {formatBytes(item.fileSize || 0)}
                    </Text>
                  </View>
                )}
              </View>
            )}
            onMomentumScrollEnd={({ nativeEvent }) => {
              if (!previewContext) return;
              const width = nativeEvent.layoutMeasurement.width;
              if (!width) return;
              const index = Math.round(nativeEvent.contentOffset.x / width);
              setPreviewIndex(
                Math.min(Math.max(index, 0), (previewContext.attachments.length || 1) - 1)
              );
            }}
          />
          <BlurView
            intensity={50}
            tint="dark"
            style={[styles.attachmentModalFooter, { paddingBottom: Math.max(insets.bottom, 10) + 8 }]}
          >
            <View style={styles.attachmentModalFileMetaRow}>
              <Text style={styles.attachmentModalFileName} numberOfLines={1}>
                {currentPreviewAttachment?.name || 'Attachment'}
              </Text>
              {currentPreviewAttachment?.fileSize ? (
                <Text style={styles.attachmentModalFileMeta}>
                  {formatBytes(currentPreviewAttachment.fileSize)}
                </Text>
              ) : null}
            </View>
            <View style={styles.attachmentModalActions}>
              <Pressable
                style={styles.attachmentModalButton}
                onPress={() => handleDownloadAttachment(currentPreviewAttachment)}
              >
                <Ionicons name="download-outline" size={18} color="#03040A" />
                <Text style={styles.attachmentModalButtonText}>Download</Text>
              </Pressable>
              <Pressable
                style={styles.attachmentModalButton}
                onPress={() => handleShareAttachment(currentPreviewAttachment)}
              >
                <Ionicons name="share-outline" size={18} color="#03040A" />
                <Text style={styles.attachmentModalButtonText}>Share</Text>
              </Pressable>
            </View>
          </BlurView>
        </View>
      </Modal>
      {messageActionContext ? (
        <Animated.View
          style={[styles.messageActionOverlay, { opacity: messageActionAnim }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.messageActionBackdrop}
            onPress={() => dismissMessageActions()}
          />
          <Animated.View
            style={[
              styles.messageActionSheetContainer,
              {
                top: messageActionAnchor.top,
                left: messageActionAnchor.left,
                opacity: messageActionAnim,
                transform: [
                  {
                    translateY: messageActionAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                  {
                    scale: messageActionAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents="box-none"
          >
            <View style={[styles.messageActionArrow, { left: messageActionArrowLeft, top: messageActionArrowTop }]} />
            <View style={styles.messageActionBubble}>
              <Text style={styles.messageActionPreview} numberOfLines={2}>
                {messageActionContext.message.content || 'Attachment'}
              </Text>
              <View style={styles.messageActionChipColumn}>
                {messageActionContext.actions.map((action) => (
                  <Pressable
                    key={`${messageActionContext.message.id}-${action.label}`}
                    style={({ pressed }) => [
                      styles.messageActionRow,
                      action.destructive && styles.messageActionRowDestructive,
                      pressed && styles.messageActionRowPressed,
                    ]}
                    onPress={() => handleMessageActionSelect(action)}
                  >
                    <Ionicons
                      name={resolveActionIcon(action.label) as any}
                      size={16}
                      color={action.destructive ? '#ffb4b4' : '#e7ecff'}
                    />
                    <Text
                      style={[
                        styles.messageActionRowText,
                        action.destructive && styles.messageActionRowTextDestructive,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}
      {attachmentSheetVisible ? (
        <Animated.View
          style={[styles.messageActionOverlay, { opacity: attachmentSheetAnim }]}
          pointerEvents="box-none"
        >
          <Pressable style={styles.messageActionBackdrop} onPress={closeAttachmentSheet} />
          <Animated.View
            style={[
              styles.attachmentSheet,
              {
                transform: [
                  {
                    translateY: attachmentSheetAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [40, 0],
                    }),
                  },
                ],
                opacity: attachmentSheetAnim,
              },
            ]}
          >
            <Text style={styles.attachmentSheetTitle}>Add attachment</Text>
            <Pressable
              style={styles.attachmentSheetButton}
              onPress={handlePickPhoto}
            >
              <Ionicons name="images-outline" size={18} color="#ffffff" />
              <View style={styles.attachmentSheetLabelColumn}>
                <Text style={styles.attachmentSheetButtonLabel}>Photos & Videos</Text>
                <Text style={styles.attachmentSheetButtonHint}>Camera roll</Text>
              </View>
            </Pressable>
            <Pressable
              style={styles.attachmentSheetButton}
              onPress={handlePickDocument}
            >
              <Ionicons name="document-text-outline" size={18} color="#ffffff" />
              <View style={styles.attachmentSheetLabelColumn}>
                <Text style={styles.attachmentSheetButtonLabel}>Files</Text>
                <Text style={styles.attachmentSheetButtonHint}>Browse documents</Text>
              </View>
            </Pressable>
          </Animated.View>
        </Animated.View>
      ) : null}
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
    marginBottom: 4,
  },
  messageRowSpaced: {
    marginBottom: 12,
  },
  messageRowWithReply: {
    marginTop: 10,
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
  messageBubbleWithReply: {
    alignSelf: 'stretch',
    width: '100%',
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
  messageContentWithReply: {
    minWidth: '75%',
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
    backgroundColor: 'rgba(44, 130, 255, 0.16)',
  },
  replyChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    width: '100%',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  replyChipMine: {
    backgroundColor: 'rgba(44, 130, 255, 0.18)',
    borderColor: 'rgba(44, 130, 255, 0.45)',
  },
  replyChipTheirs: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  replyChipBar: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: '#2C82FF',
  },
  replyChipBarMine: {
    backgroundColor: '#ffffff',
    opacity: 0.9,
  },
  replyChipBarTheirs: {
    backgroundColor: '#2C82FF',
  },
  replyChipBody: {
    flex: 1,
  },
  replyChipLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  replyChipText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    lineHeight: 18,
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
  seenReceiptRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  seenReceiptAvatar: {
    borderWidth: 1,
    borderColor: 'rgba(3, 4, 10, 0.9)',
  },
  seenReceiptOverflow: {
    minWidth: 28,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seenReceiptOverflowText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '600',
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  replyPreviewMine: {
    backgroundColor: 'rgba(44, 130, 255, 0.22)',
    borderColor: 'rgba(44, 130, 255, 0.45)',
  },
  replyPreviewTheirs: {
    backgroundColor: 'rgba(8, 14, 26, 0.95)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  replyPreviewGlyph: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  replyPreviewGlyphMine: {
    backgroundColor: '#ffffff',
  },
  replyPreviewGlyphTheirs: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  replyPreviewBody: {
    flex: 1,
  },
  replyPreviewLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  replyPreviewText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    lineHeight: 18,
  },
  replyPreviewClose: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  threadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  threadModalCard: {
    borderRadius: 22,
    overflow: 'hidden',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  threadModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  threadModalBody: {
    padding: 16,
    backgroundColor: 'rgba(10, 14, 28, 0.72)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
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
  heroImageCard: {
    marginTop: 8,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  heroImage: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  heroVideo: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
  },
  heroVideoPlaceholder: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 8,
    width: '100%',
    marginTop: 6,
  },
  attachmentGroupMine: {
    justifyContent: 'flex-end',
  },
  attachmentGroupTheirs: {
    justifyContent: 'flex-start',
  },
  attachmentCard: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 8,
  },
  attachmentImageCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  attachmentImageCardLarge: {
    width: 240,
    height: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  attachmentImageCardCompact: {
    width: 150,
    height: 150,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  attachmentFileCard: {
    padding: 12,
    minWidth: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  attachmentVideoThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  attachmentVideoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
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
  attachmentMoreBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  attachmentMoreBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
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
  embedVideo: {
    width: 220,
    height: 140,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  embedPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  embedPlaceholderText: {
    color: '#ffffff',
    fontSize: 12,
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
  attachmentChipProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
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
    backgroundColor: 'rgba(3, 4, 10, 0.65)',
    justifyContent: 'space-between',
  },
  attachmentModalTopBar: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  attachmentModalIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentModalTitleWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  attachmentModalTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  attachmentModalCarousel: {
    flex: 1,
  },
  attachmentModalCarouselContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
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
  attachmentPreviewSlide: {
    width: Dimensions.get('window').width - 24,
    height: Dimensions.get('window').height * 0.65,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 12,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  attachmentZoomContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  attachmentZoomImage: {
    width: '100%',
    height: '100%',
  },
  attachmentModalFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: 'rgba(16, 20, 37, 0.35)',
    overflow: 'hidden',
  },
  attachmentModalFileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  messageActionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
  },
  messageActionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  messageActionSheetContainer: {
    position: 'absolute',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  messageActionPreview: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  messageActionBubble: {
    width: 280,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(14, 16, 25, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  messageActionArrow: {
    position: 'absolute',
    top: -6,
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: 'rgba(12, 14, 22, 0.82)',
    transform: [{ rotate: '45deg' }],
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: 'transparent',
  },
  messageActionChipColumn: {
    flexDirection: 'column',
    gap: 8,
  },
  messageActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  messageActionRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  messageActionRowDestructive: {
    backgroundColor: 'rgba(255, 82, 82, 0.12)',
  },
  messageActionRowText: {
    color: '#eef1ff',
    fontWeight: '600',
    fontSize: 13,
  },
  messageActionRowTextDestructive: {
    color: '#ffd6d6',
  },
  quickReactionRow: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  attachmentSheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    borderRadius: 20,
    backgroundColor: '#0B1023',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  attachmentSheetTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  attachmentSheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  attachmentSheetLabelColumn: {
    flex: 1,
  },
  attachmentSheetButtonLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  attachmentSheetButtonHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
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
