import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '../../hooks/useAuth';
import { ShareIntentPayload, ShareIntentService } from '../../services/ShareIntentService';
import { StorageService } from '../../services/StorageService';
import { ApiService } from '../../services/ApiService';
import { NotificationService } from '../../services/NotificationService';
import { ChatService, type UploadableAsset } from '../../services/ChatService';
import { CryptoService } from '../../services/CryptoService';
import { WebSocketService } from '../../services/WebSocketService';

const MESSAGE_CHAR_LIMIT = 5000;
const MESSAGE_PAYLOAD_VERSION = 1;

type ShareableChat = Record<string, any>;

const encodeShareMessagePayload = (text: string): string => {
  const payload: Record<string, any> = {
    v: MESSAGE_PAYLOAD_VERSION,
    text,
  };
  try {
    return JSON.stringify(payload);
  } catch {
    return text;
  }
};

const formatBytes = (size?: number): string | undefined => {
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
    return undefined;
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** exponent;
  const fractionDigits = value >= 10 || exponent === 0 ? 0 : 1;
  return `${value.toFixed(fractionDigits)} ${units[exponent]}`;
};

const buildInitialMessage = (payload: ShareIntentPayload | null): string => {
  if (!payload) {
    return '';
  }
  if (payload.message && payload.message.trim().length) {
    return payload.message.trim();
  }
  const textualAttachments =
    payload.attachments?.filter((attachment) => attachment.kind !== 'file') ?? [];
  const text = textualAttachments
    .map((item) => (item.value || '').trim())
    .filter(Boolean)
    .join('\n');
  return text;
};

const extractParticipantIds = (chat: ShareableChat): string[] => {
  if (!chat) {
    return [];
  }

  if (Array.isArray(chat.participants) && chat.participants.length) {
    return chat.participants
      .map((participant: any) => {
        if (!participant) {
          return null;
        }
        if (participant.id !== undefined && participant.id !== null) {
          return participant.id.toString();
        }
        return null;
      })
      .filter(Boolean) as string[];
  }

  if (Array.isArray(chat.userIds) && chat.userIds.length) {
    return chat.userIds
      .map((userId: any) => {
        if (userId === undefined || userId === null) {
          return null;
        }
        return userId.toString();
      })
      .filter(Boolean) as string[];
  }

  if (typeof chat.users === 'string') {
    try {
      const parsed = JSON.parse(chat.users);
      if (Array.isArray(parsed)) {
        return parsed
          .map((userId: any) => {
            if (userId === undefined || userId === null) {
              return null;
            }
            return userId.toString();
          })
          .filter(Boolean) as string[];
      }
    } catch {
      // ignore parse errors
    }
  }

  return [];
};

const resolveChatTitle = (chat: ShareableChat, currentUserId?: string | null): string => {
  if (!chat) {
    return 'Ismeretlen chat';
  }
  if (chat.isGroup || chat.is_group || (Array.isArray(chat.participants) && chat.participants.length > 2)) {
    if (chat.name && chat.name.length) {
      return chat.name;
    }
    if (chat.displayName && chat.displayName.length) {
      return chat.displayName;
    }
    return 'Group chat';
  }

  const participants: any[] = Array.isArray(chat.participants) ? chat.participants : [];
  if (participants.length) {
    const counterpart = participants.find((participant) => {
      const identifier = participant?.id?.toString?.();
      return identifier && identifier !== currentUserId;
    });
    if (counterpart) {
      return (
        counterpart.username ||
        counterpart.displayName ||
        counterpart.email ||
        'Contact'
      );
    }
  }

  const participantIds = extractParticipantIds(chat).filter((id) => id !== currentUserId);
  if (participantIds.length && Array.isArray(participants) && participants.length) {
    const fallback = participants.find(
      (participant) => participant?.id?.toString?.() === participantIds[0]
    );
    if (fallback) {
      return fallback.username || fallback.email || fallback.displayName || 'Chat';
    }
  }

  return chat.name || chat.displayName || 'Direct chat';
};

const resolveChatSubtitle = (chat: ShareableChat, currentUserId?: string | null): string => {
  if (!chat) {
    return '';
  }
  if (chat.isGroup || chat.is_group) {
    const participants: any[] = Array.isArray(chat.participants) ? chat.participants : [];
    if (!participants.length) {
      return '';
    }
    const labels = participants
      .filter((participant) => participant?.id?.toString?.() !== currentUserId)
      .map((participant) => participant?.username || participant?.email || 'Tag');
    return labels.slice(0, 3).join(', ');
  }
  return chat.lastMessage?.content || '';
};

const normalizeChatId = (chat: ShareableChat): string => {
  if (!chat) {
    return '';
  }
  if (chat.id !== undefined && chat.id !== null) {
    return chat.id.toString();
  }
  if (chat.chatId !== undefined && chat.chatId !== null) {
    return chat.chatId.toString();
  }
  if (chat.chat_id !== undefined && chat.chat_id !== null) {
    return chat.chat_id.toString();
  }
  return '';
};

const ShareScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoading: authLoading } = useAuth();
  const wsServiceRef = useRef(WebSocketService.getInstance());
  const initialPayloadRef = useRef<ShareIntentPayload | null>(ShareIntentService.getPayload());

  const [payloadReady, setPayloadReady] = useState(Boolean(initialPayloadRef.current));
  const [payload, setPayload] = useState<ShareIntentPayload | null>(initialPayloadRef.current);
  const [message, setMessage] = useState<string>(buildInitialMessage(initialPayloadRef.current));
  const [chats, setChats] = useState<ShareableChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(
    initialPayloadRef.current?.extra?.chatId?.toString?.() ??
      initialPayloadRef.current?.extra?.chat_id?.toString?.() ??
      null
  );
  const [sending, setSending] = useState(false);

  useEffect(() => {
    ShareIntentService.init();
    const unsubscribe = ShareIntentService.subscribe((nextPayload) => {
      if (nextPayload) {
        setPayload(nextPayload);
        setMessage(buildInitialMessage(nextPayload));
        setSelectedChatId(
          nextPayload.extra?.chatId?.toString?.() ?? nextPayload.extra?.chat_id?.toString?.() ?? null
        );
        setPayloadReady(true);
      } else {
        setPayload(null);
      }
    });
    if (!initialPayloadRef.current) {
      setPayloadReady(true);
    }
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchChats = async () => {
      setChatsLoading(true);
      try {
        const token = await StorageService.getAuthToken();
        if (!token) {
          setChats([]);
          return;
        }
        const response = await ApiService.get('/chat', token);
        if (response.success && Array.isArray(response.data?.chats)) {
          setChats(response.data.chats);
        } else {
          console.warn('[ShareScreen] Failed to load chats', response.error);
        }
      } catch (error) {
        console.error('[ShareScreen] Failed to fetch chats', error);
      } finally {
        setChatsLoading(false);
      }
    };

    fetchChats();
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      NotificationService.show('warning', 'Sign in to share content');
      router.replace('/');
    }
  }, [authLoading, user, router]);

  const currentUserId = user?.id?.toString?.() ?? null;

  const eligibleChats = useMemo(
    () => chats.filter((chat) => Boolean(normalizeChatId(chat))),
    [chats]
  );

  const filteredChats = useMemo(() => {
    if (!search.trim().length) {
      return eligibleChats;
    }
    const needle = search.trim().toLowerCase();
    return eligibleChats.filter((chat) => {
      const title = resolveChatTitle(chat, currentUserId).toLowerCase();
      const subtitle = resolveChatSubtitle(chat, currentUserId).toLowerCase();
      return title.includes(needle) || subtitle.includes(needle);
    });
  }, [eligibleChats, currentUserId, search]);

  const selectedChat = useMemo(() => {
    if (!selectedChatId) {
      return null;
    }
    return eligibleChats.find((chat) => normalizeChatId(chat) === selectedChatId) ?? null;
  }, [eligibleChats, selectedChatId]);

  const textAttachments = payload?.attachments?.filter((attachment) => attachment.kind !== 'file') ?? [];
  const fileAttachments =
    payload?.attachments?.filter((attachment) => attachment.kind === 'file') ?? [];

  const onCancel = useCallback(() => {
    ShareIntentService.clearPayload();
    router.replace('/home');
  }, [router]);

  const handleSendShare = useCallback(async () => {
    if (!payload) {
      NotificationService.show('error', 'Nothing to share');
      return;
    }
    if (!selectedChat) {
      NotificationService.show('error', 'Choose a chat');
      return;
    }
    if (!currentUserId) {
      NotificationService.show('error', 'No active user account');
      return;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage && fileAttachments.length === 0) {
      NotificationService.show('error', 'You need a message or attachment to share');
      return;
    }

    const chatId = normalizeChatId(selectedChat);
    if (!chatId) {
      NotificationService.show('error', 'The selected chat is not available');
      return;
    }

    const participantIds = extractParticipantIds(selectedChat);
    const recipientIds = participantIds.filter((id) => id && id !== currentUserId);
    if (!recipientIds.length) {
      NotificationService.show('error', 'No recipients found for this chat');
      return;
    }

    try {
      setSending(true);
      const token = await StorageService.getAuthToken();
      if (!token) {
        throw new Error('No valid auth token');
      }

      const uploadedAttachmentIds: string[] = [];
      for (const attachment of fileAttachments) {
        if (!attachment.value) {
          continue;
        }
        if (
          !attachment.value.startsWith('file://') &&
          !attachment.value.startsWith('/') &&
          !attachment.value.startsWith('content://')
        ) {
          throw new Error(
            `Unknown file path: ${attachment.filename || attachment.id}`
          );
        }
        const asset: UploadableAsset = {
          uri: attachment.value,
          name: attachment.filename || `share-${attachment.id}`,
          type: attachment.mimeType || 'application/octet-stream',
          size: attachment.size,
        };
        const response = await ChatService.uploadAttachment(chatId, asset, token);
        if (!response.success || !response.data?.attachment?.id) {
          throw new Error(response.error || 'Failed to upload one of the attachments');
        }
        uploadedAttachmentIds.push(response.data.attachment.id.toString());
      }

      if (!trimmedMessage && uploadedAttachmentIds.length === 0) {
        throw new Error('No content to send');
      }

      const wsService = wsServiceRef.current;
      if (!wsService.connected) {
        await wsService.connect();
      }

      const encryptedPayload = await CryptoService.buildEncryptedPayload({
        chatId,
        message: encodeShareMessagePayload(trimmedMessage),
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
        attachments: uploadedAttachmentIds,
      });

      NotificationService.show('success', 'Content shared to the selected chat');
      ShareIntentService.clearPayload();
      router.replace(`/chat/${chatId}`);
    } catch (error: any) {
      console.error('[ShareScreen] Failed to send share intent', error);
      NotificationService.show(
        'error',
        error?.message || 'An unknown error occurred while sharing'
      );
    } finally {
      setSending(false);
    }
  }, [currentUserId, fileAttachments, message, payload, router, selectedChat]);

  const handleMessageChange = useCallback((value: string) => {
    if (value.length > MESSAGE_CHAR_LIMIT) {
      NotificationService.show(
        'warning',
        `Messages can be at most ${MESSAGE_CHAR_LIMIT} characters long`
      );
      setMessage(value.slice(0, MESSAGE_CHAR_LIMIT));
      return;
    }
    setMessage(value);
  }, []);

  const renderChatItem = ({ item }: { item: ShareableChat }) => {
    const chatId = normalizeChatId(item);
    const isSelected = chatId === selectedChatId;
    return (
      <TouchableOpacity
        style={[
          styles.chatItem,
          isSelected && styles.chatItemSelected,
        ]}
        onPress={() => setSelectedChatId(chatId)}
      >
        <View style={styles.chatItemHeader}>
          <Text style={styles.chatItemTitle}>{resolveChatTitle(item, currentUserId)}</Text>
          {isSelected && <Ionicons name="checkmark-circle" size={20} color="#4ade80" />}
        </View>
        <Text style={styles.chatItemSubtitle} numberOfLines={1}>
          {resolveChatSubtitle(item, currentUserId) || 'No history yet'}
        </Text>
      </TouchableOpacity>
    );
  };

  if (!payloadReady) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.loadingText}>Preparing share...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!payload) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <Ionicons name="share-outline" size={48} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No shared content</Text>
          <Text style={styles.emptySubtitle}>
            You can only use the share sheet when sharing from another app into Syncre.
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={onCancel}>
            <Text style={styles.emptyButtonText}>Back to home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={[styles.keyboardAvoiding, { paddingBottom: insets.bottom || 16 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#F3F4F6" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Share to Syncre</Text>
            <Text style={styles.headerSubtitle}>
              Choose which chat to send the shared content to.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shared content</Text>
            <ScrollView
              style={styles.previewContainer}
              contentContainerStyle={{ paddingVertical: 4 }}
            >
              {payload.title && (
                <View style={styles.previewItem}>
                  <Text style={styles.previewLabel}>Title</Text>
                  <Text style={styles.previewValue}>{payload.title}</Text>
                </View>
              )}
              {payload.origin && (
                <View style={styles.previewItem}>
                  <Text style={styles.previewLabel}>Source</Text>
                  <Text style={styles.previewValue}>{payload.origin}</Text>
                </View>
              )}
              {textAttachments.map((attachment) => (
                <View key={attachment.id} style={styles.previewCard}>
                  <Text style={styles.previewBadge}>
                    {attachment.kind === 'url' ? 'Link' : 'Text'}
                  </Text>
                  <Text style={styles.previewContent}>{attachment.value}</Text>
                </View>
              ))}
              {fileAttachments.map((attachment) => (
                <View key={attachment.id} style={styles.filePreview}>
                  <Ionicons
                    name="document-attach-outline"
                    size={20}
                    color="#F8FAFC"
                    style={{ marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {attachment.filename || 'Attached file'}
                    </Text>
                    <Text style={styles.fileMeta}>
                      {attachment.mimeType || 'unknown type'}
                      {attachment.size ? ` - ${formatBytes(attachment.size)}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
              {!textAttachments.length && !fileAttachments.length && (
                <Text style={styles.previewPlaceholder}>No details available for this share</Text>
              )}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Message</Text>
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={handleMessageChange}
              placeholder="Add a note (optional)"
              placeholderTextColor="#6B7280"
              multiline
              maxLength={MESSAGE_CHAR_LIMIT}
            />
            <Text style={styles.charCounter}>{`${message.length}/${MESSAGE_CHAR_LIMIT}`}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose a chat</Text>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search chats"
              placeholderTextColor="#6B7280"
            />
            <View style={styles.chatListContainer}>
              {chatsLoading ? (
                <View style={styles.chatLoading}>
                  <ActivityIndicator color="#F3F4F6" />
                  <Text style={styles.chatLoadingText}>Loading chat list...</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredChats}
                  keyExtractor={(item, index) => normalizeChatId(item) || `chat-${index}`}
                  renderItem={renderChatItem}
                  ListEmptyComponent={
                    <View style={styles.emptyChats}>
                      <Text style={styles.emptyChatsText}>
                        No chats match your search.
                      </Text>
                    </View>
                  }
                  keyboardShouldPersistTaps="handled"
                />
              )}
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={sending}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sendButtonWrapper}
              onPress={handleSendShare}
              disabled={sending || !selectedChat}
            >
              <LinearGradient
                colors={sending || !selectedChat ? ['#4B5563', '#4B5563'] : ['#5D5FEF', '#7C66F5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendButton}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>Send</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#03040A',
  },
  keyboardAvoiding: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 16,
    marginTop: 12,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  headerTitle: {
    color: '#F9FAFB',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  headerSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  previewContainer: {
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#0B1220',
    maxHeight: 180,
  },
  previewItem: {
    marginBottom: 8,
  },
  previewLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewValue: {
    color: '#F9FAFB',
    fontSize: 14,
  },
  previewCard: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  previewBadge: {
    color: '#A5B4FC',
    fontSize: 12,
    marginBottom: 4,
  },
  previewContent: {
    color: '#F3F4F6',
    fontSize: 14,
  },
  previewPlaceholder: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  fileName: {
    color: '#F9FAFB',
    fontSize: 14,
  },
  fileMeta: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  messageInput: {
    minHeight: 80,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    padding: 12,
    color: '#F9FAFB',
    fontSize: 15,
    backgroundColor: '#0B1220',
    textAlignVertical: 'top',
  },
  charCounter: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F9FAFB',
    backgroundColor: '#0B1220',
    fontSize: 15,
    marginBottom: 12,
  },
  chatListContainer: {
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    maxHeight: 260,
    backgroundColor: '#030712',
  },
  chatItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  chatItemSelected: {
    backgroundColor: 'rgba(125, 105, 246, 0.12)',
  },
  chatItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  chatItemTitle: {
    color: '#F3F4F6',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
  },
  chatItemSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  chatLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  chatLoadingText: {
    color: '#9CA3AF',
    marginLeft: 8,
  },
  emptyChats: {
    padding: 16,
  },
  emptyChatsText: {
    color: '#6B7280',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  cancelButtonText: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '500',
  },
  sendButtonWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  sendButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#E5E7EB',
    fontSize: 20,
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyButton: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1F2937',
  },
  emptyButtonText: {
    color: '#F3F4F6',
    fontSize: 14,
  },
});

export default ShareScreen;
