import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Screen } from '../../../components/Screen';
import { AppBackground } from '../../../components/AppBackground';
import { GlassPanel } from '../../../components/GlassPanel';
import { Avatar } from '../../../components/Avatar';
import { font, spacing, useTheme } from '../../../theme/designSystem';
import { ApiService } from '../../../services/ApiService';
import { StorageService } from '../../../services/StorageService';
import { CryptoService } from '../../../services/CryptoService';
import { ChatService } from '../../../services/ChatService';
import { DeviceService } from '../../../services/DeviceService';
import { NotificationService } from '../../../services/NotificationService';
import { webSocketService } from '../../../services/WebSocketService';
import { useAuth } from '../../../hooks/useAuth';

type SeenReceipt = {
  userId: string;
  username?: string | null;
  avatarUrl?: string | null;
  seenAt?: string | null;
};

type ChatMessage = {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string | null;
  senderAvatar?: string | null;
  content: string;
  createdAt: string;
  isMine: boolean;
  isDeleted?: boolean;
  attachments?: any[];
  status?: 'sent' | 'delivered' | 'seen';
  seenBy?: SeenReceipt[];
};

export default function ChatScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const chatId = params.id?.toString?.() ?? '';
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { user } = useAuth();
  const [chatTitle, setChatTitle] = useState('Chat');
  const [participants, setParticipants] = useState<any[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingAttachmentIds, setPendingAttachmentIds] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<{ id: string; name: string }[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [typingEnabled, setTypingEnabled] = useState(true);
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(true);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentUserId = user?.id?.toString?.() ?? '';

  const computeSeenPlacements = useCallback(() => {
    const placements = new Map<string, SeenReceipt[]>();
    const latestByUser = new Map<string, { messageId: string; seenAt: number; receipt: SeenReceipt }>();

    messages.forEach((message) => {
      (message.seenBy || []).forEach((receipt) => {
        if (!receipt.userId || receipt.userId === currentUserId) return;
        const seenAt = receipt.seenAt ? Date.parse(receipt.seenAt) : 0;
        const existing = latestByUser.get(receipt.userId);
        if (!existing || seenAt >= existing.seenAt) {
          latestByUser.set(receipt.userId, { messageId: message.id, seenAt, receipt });
        }
      });
    });

    latestByUser.forEach(({ messageId, receipt }) => {
      const list = placements.get(messageId) || [];
      list.push(receipt);
      placements.set(messageId, list);
    });

    return placements;
  }, [messages, currentUserId]);

  const seenPlacements = useMemo(() => computeSeenPlacements(), [computeSeenPlacements]);

  const resolveDisplayName = (chatData: any) => {
    if (chatData?.isGroup) {
      return chatData.name || chatData.displayName || 'Group chat';
    }
    const other = (chatData?.participants || []).find((p: any) => p.id?.toString?.() !== currentUserId);
    return other?.username || other?.email || 'Chat';
  };

  const loadChat = useCallback(async () => {
    const token = await StorageService.getAuthToken();
    if (!token || !chatId) return;

    const response = await ApiService.get(`/chat/${chatId}`, token);
    if (response.success && response.data?.chat) {
      const chatData = response.data.chat;
      setChatTitle(resolveDisplayName(chatData));
      setParticipants(Array.isArray(chatData.participants) ? chatData.participants : []);
    }
  }, [chatId, currentUserId]);

  const decodeMessage = useCallback(
    async (raw: any): Promise<ChatMessage> => {
      let content = raw.content || '';
      if (raw.isEncrypted && raw.envelopes?.length) {
        const decrypted = await CryptoService.decryptMessage({
          chatId,
          envelopes: raw.envelopes,
          senderId: raw.senderId,
          currentUserId,
          token: await StorageService.getAuthToken(),
        });
        if (decrypted) {
          content = decrypted;
        } else {
          content = 'Encrypted message';
        }
      }
      if (raw.isDeleted) {
        content = 'Message deleted';
      }

      return {
        id: raw.id?.toString?.() ?? `${Date.now()}`,
        chatId: raw.chatId?.toString?.() ?? chatId,
        senderId: raw.senderId?.toString?.() ?? 'unknown',
        senderName: raw.senderName || raw.senderUsername || null,
        senderAvatar: raw.senderAvatar || null,
        content,
        createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
        isMine: raw.senderId?.toString?.() === currentUserId,
        isDeleted: raw.isDeleted || raw.is_deleted,
        attachments: raw.attachments || [],
        status: raw.status,
        seenBy: raw.seenBy || [],
      };
    },
    [chatId, currentUserId]
  );

  const loadMessages = useCallback(
    async (before?: string | null) => {
      const token = await StorageService.getAuthToken();
      if (!token || !chatId) return;
      const deviceId = await DeviceService.getOrCreateDeviceId();
      const params = new URLSearchParams({
        deviceId,
        limit: '30',
      });
      if (before) {
        params.set('before', before);
      }
      const response = await ApiService.get(`/chat/${chatId}/messages?${params.toString()}`, token);
      if (response.success && Array.isArray(response.data?.messages)) {
        const decoded = await Promise.all(response.data.messages.map(decodeMessage));
        setMessages((prev) => {
          const merged = before ? [...decoded, ...prev] : decoded;
          const unique = new Map<string, ChatMessage>();
          merged.forEach((msg) => unique.set(msg.id, msg));
          return Array.from(unique.values()).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
        });
        setHasMore(Boolean(response.data?.hasMore));
        setCursor(response.data?.nextCursor || null);
      }
    },
    [chatId, decodeMessage]
  );

  const markChatSeen = useCallback(async (messageId?: string) => {
    if (!readReceiptsEnabled) return;
    const token = await StorageService.getAuthToken();
    if (!token || !chatId) return;
    await ApiService.post(`/chat/${chatId}/seen`, {}, token);
    const target = messageId
      ? { id: messageId }
      : [...messages].reverse().find((msg) => !msg.isMine);
    if (target?.id) {
      webSocketService.send({
        type: 'message_seen',
        chatId,
        messageId: target.id,
      });
    }
  }, [chatId, messages, readReceiptsEnabled]);

  const handleIncoming = useCallback(
    async (payload: any) => {
      if (!payload || payload.chatId?.toString?.() !== chatId) return;
      if (payload.type === 'message_status') {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== payload.messageId?.toString?.()) return msg;
            if (payload.status === 'seen' && payload.viewerId) {
              const existing = msg.seenBy || [];
              const already = existing.some((entry) => entry.userId === payload.viewerId);
              const nextSeen = already
                ? existing
                : [
                    ...existing,
                    {
                      userId: payload.viewerId,
                      username: payload.viewerUsername,
                      avatarUrl: payload.viewerAvatar,
                      seenAt: payload.seenAt || payload.timestamp,
                    },
                  ];
              return { ...msg, status: 'seen', seenBy: nextSeen };
            }
            if (payload.status === 'delivered') {
              return { ...msg, status: 'delivered' };
            }
            return msg;
          })
        );
        return;
      }

      if (payload.type === 'message_envelope' || payload.type === 'message_envelope_sent') {
        const decoded = await decodeMessage(payload);
        setMessages((prev) => {
          const exists = prev.some((msg) => msg.id === decoded.id);
          if (exists) return prev;
          return [...prev, decoded].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
        });
        if (!decoded.isMine) {
          markChatSeen(decoded.id);
        }
      }
    },
    [chatId, decodeMessage]
  );

  const handleSend = useCallback(async () => {
    if (!input.trim() && !pendingAttachmentIds.length) {
      return;
    }
    const token = await StorageService.getAuthToken();
    if (!token || !currentUserId) {
      NotificationService.show('error', 'Not authenticated.');
      return;
    }
    if (!participants.length) {
      NotificationService.show('error', 'No chat participants.');
      return;
    }

    const recipientUserIds = participants
      .map((participant: any) => participant.id?.toString?.() ?? '')
      .filter((id: string) => id && id !== currentUserId);

    const encryptedPayload = await CryptoService.buildEncryptedPayload({
      chatId,
      message: input.trim(),
      recipientUserIds,
      token,
      currentUserId,
    });
    const senderDeviceId = await DeviceService.getOrCreateDeviceId();
    webSocketService.send({
      type: 'chat_message',
      chatId,
      senderDeviceId,
      envelopes: encryptedPayload.envelopes,
      preview: input.trim().slice(0, 120),
      attachments: pendingAttachmentIds,
    });
    setInput('');
    setPendingAttachmentIds([]);
  }, [input, pendingAttachmentIds, participants, chatId, currentUserId]);

  const handleAttachmentPick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true });
    if (result.canceled) return;
    const token = await StorageService.getAuthToken();
    if (!token) return;
    const newIds: string[] = [];
    for (const asset of result.assets) {
      const response = await ChatService.uploadAttachment(chatId, {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType,
        size: asset.size,
      });
      if (response.success && response.data?.attachment?.id) {
        newIds.push(response.data.attachment.id.toString());
      }
    }
    if (newIds.length) {
      setPendingAttachmentIds((prev) => [...prev, ...newIds]);
    }
  };

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      setLoading(true);
      setTypingEnabled(await StorageService.getTypingIndicator());
      setReadReceiptsEnabled(await StorageService.getReadReceipts());
      await loadChat();
      await loadMessages();
      const deviceId = await DeviceService.getOrCreateDeviceId();
      webSocketService.joinChat(chatId, deviceId);
      webSocketService.connect().catch(() => {});
      setLoading(false);
      if (mounted) {
        markChatSeen();
      }
    };
    bootstrap();

    const unsubscribe = webSocketService.addMessageListener(handleIncoming);
    const unsubscribeTyping = webSocketService.onTyping(chatId, ({ userId, username }) => {
      if (!userId || !username) return;
      setTypingUsers((prev) => (prev.some((entry) => entry.id === userId) ? prev : [...prev, { id: userId, name: username }]));
    });
    const unsubscribeStop = webSocketService.onStopTyping(chatId, ({ userId }) => {
      if (!userId) return;
      setTypingUsers((prev) => prev.filter((entry) => entry.id !== userId));
    });

    return () => {
      mounted = false;
      webSocketService.leaveChat(chatId);
      unsubscribe();
      unsubscribeTyping();
      unsubscribeStop();
    };
  }, [chatId, loadChat, loadMessages, handleIncoming, markChatSeen]);

  const onInputChange = (text: string) => {
    setInput(text);
    if (!typingEnabled) {
      return;
    }
    webSocketService.sendTyping(chatId);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      webSocketService.sendStopTyping(chatId);
    }, 1600) as unknown as NodeJS.Timeout;
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const receipts = seenPlacements.get(item.id) || [];
    return (
      <View style={[styles.messageRow, item.isMine ? styles.messageRowMine : styles.messageRowTheirs]}>
        {!item.isMine ? <Avatar uri={item.senderAvatar} name={item.senderName} size={28} /> : null}
        <View style={[styles.bubble, item.isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          {!item.isMine ? <Text style={styles.sender}>{item.senderName || 'Member'}</Text> : null}
          <Text style={[styles.messageText, item.isMine ? styles.messageTextMine : styles.messageTextTheirs]}>
            {item.content}
          </Text>
          {item.attachments?.length ? (
            <Text style={styles.attachmentLabel}>
              {item.attachments.length} attachment{item.attachments.length === 1 ? '' : 's'}
            </Text>
          ) : null}
        </View>
        {item.isMine && receipts.length ? (
          <View style={styles.receipts}>
            {receipts.slice(0, 3).map((receipt) => (
              <Avatar
                key={`${item.id}-${receipt.userId}`}
                uri={receipt.avatarUrl}
                name={receipt.username}
                size={20}
              />
            ))}
            {receipts.length > 3 ? <Text style={styles.receiptOverflow}>+{receipts.length - 3}</Text> : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Screen>
      <AppBackground />
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.navButton}>
          <Ionicons name="chevron-back" size={20} color={theme.palette.text} />
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>
          {chatTitle}
        </Text>
        <View style={styles.navButton} />
      </View>

      <GlassPanel style={styles.listPanel} glassEffectStyle="regular" isInteractive padding={0}>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onEndReached={() => {
            if (hasMore && cursor) {
              loadMessages(cursor);
            }
          }}
          onEndReachedThreshold={0.2}
          ListEmptyComponent={
            loading ? (
              <View style={styles.loading}>
                <Text style={styles.loadingText}>Loading chat...</Text>
              </View>
            ) : (
              <View style={styles.loading}>
                <Text style={styles.loadingText}>No messages yet.</Text>
              </View>
            )
          }
        />
      </GlassPanel>

      {typingUsers.length ? (
        <Text style={styles.typing}>{typingUsers.map((entry) => entry.name).join(', ')} typing...</Text>
      ) : null}
      {pendingAttachmentIds.length ? (
        <Text style={styles.attachmentsNotice}>
          {pendingAttachmentIds.length} attachment{pendingAttachmentIds.length === 1 ? '' : 's'} ready to send
        </Text>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <GlassPanel style={styles.composer} glassEffectStyle="regular" isInteractive padding={12}>
          <Pressable onPress={handleAttachmentPick} style={styles.composeButton}>
            <Ionicons name="add" size={20} color={theme.palette.text} />
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor={theme.palette.textSubtle}
            value={input}
            onChangeText={onInputChange}
            multiline
          />
          <Pressable onPress={handleSend} style={styles.composeButton}>
            <Ionicons name="send" size={18} color={theme.palette.accent} />
          </Pressable>
        </GlassPanel>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    nav: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    navButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceSoft,
    },
    navTitle: {
      flex: 1,
      color: theme.palette.text,
      fontSize: 17,
      ...font('semibold'),
    },
    listPanel: {
      flex: 1,
      marginHorizontal: spacing.lg,
      padding: 0,
    },
    listContent: {
      padding: spacing.md,
      gap: spacing.md,
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    messageRowMine: {
      justifyContent: 'flex-end',
    },
    messageRowTheirs: {
      justifyContent: 'flex-start',
    },
    bubble: {
      maxWidth: '76%',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: theme.radii.lg,
    },
    bubbleMine: {
      backgroundColor: theme.palette.bubbleOutgoing,
      borderTopRightRadius: 6,
      marginLeft: spacing.xl,
    },
    bubbleTheirs: {
      backgroundColor: theme.palette.bubbleIncoming,
      borderColor: theme.palette.bubbleIncomingBorder,
      borderWidth: 1,
      borderTopLeftRadius: 6,
    },
    sender: {
      color: theme.palette.textSubtle,
      fontSize: 11,
      marginBottom: 4,
      ...font('medium'),
    },
    messageText: {
      fontSize: 15,
      ...font('regular'),
    },
    messageTextMine: {
      color: theme.palette.text,
    },
    messageTextTheirs: {
      color: theme.palette.text,
    },
    attachmentLabel: {
      color: theme.palette.textSubtle,
      fontSize: 11,
      marginTop: 6,
      ...font('medium'),
    },
    receipts: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: spacing.xs,
    },
    receiptOverflow: {
      color: theme.palette.textMuted,
      fontSize: 10,
      ...font('medium'),
    },
    typing: {
      color: theme.palette.textMuted,
      fontSize: 12,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
    },
    attachmentsNotice: {
      color: theme.palette.textSubtle,
      fontSize: 11,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
    },
    composer: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    composeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceSoft,
    },
    input: {
      flex: 1,
      color: theme.palette.text,
      fontSize: 15,
      ...font('regular'),
      maxHeight: 120,
    },
    loading: {
      padding: spacing.lg,
      alignItems: 'center',
    },
    loadingText: {
      color: theme.palette.textMuted,
    },
  });
