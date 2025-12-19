import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { AppBackground } from '../../components/AppBackground';
import { GlassPanel } from '../../components/GlassPanel';
import { Field } from '../../components/Field';
import { Avatar } from '../../components/Avatar';
import { PrimaryButton } from '../../components/PrimaryButton';
import { font, spacing, useTheme } from '../../theme/designSystem';
import { ShareIntentService, type ShareIntentPayload } from '../../services/ShareIntentService';
import { ApiService } from '../../services/ApiService';
import { StorageService } from '../../services/StorageService';
import { ChatService } from '../../services/ChatService';
import { CryptoService } from '../../services/CryptoService';
import { DeviceService } from '../../services/DeviceService';
import { NotificationService } from '../../services/NotificationService';
import { webSocketService } from '../../services/WebSocketService';

type Chat = {
  id: string;
  displayName?: string | null;
  participants?: any[];
  isGroup?: boolean;
  name?: string | null;
  avatarUrl?: string | null;
};

export default function ShareScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [payload, setPayload] = useState<ShareIntentPayload | null>(ShareIntentService.getPayload());
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = ShareIntentService.subscribe((next) => {
      setPayload(next);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const load = async () => {
      const token = await StorageService.getAuthToken();
      if (!token) return;
      const response = await ApiService.get('/chat', token);
      if (response.success && Array.isArray(response.data?.chats)) {
        setChats(response.data.chats);
      }
    };
    load();
  }, []);

  const handleSend = async () => {
    if (!selectedChatId) {
      NotificationService.show('error', 'Select a chat.');
      return;
    }
    const token = await StorageService.getAuthToken();
    if (!token) return;
    setIsSubmitting(true);
    try {
      const chatResponse = await ApiService.get(`/chat/${selectedChatId}`, token);
      const chat = chatResponse.data?.chat;
      const participants = chat?.participants || [];
      const currentUserId = (await StorageService.getObject<any>('user_data'))?.id?.toString?.();
      const recipientUserIds = participants
        .map((participant: any) => participant.id?.toString?.() ?? '')
        .filter((id: string) => id && id !== currentUserId);

      const attachmentIds: string[] = [];
      const inlineParts: string[] = [];
      if (payload?.attachments?.length) {
        for (const attachment of payload.attachments) {
          if (attachment.kind === 'file') {
            const response = await ChatService.uploadAttachment(selectedChatId, {
              uri: attachment.value,
              name: attachment.filename,
              type: attachment.mimeType,
              size: attachment.size,
            });
            if (response.success && response.data?.attachment?.id) {
              attachmentIds.push(response.data.attachment.id.toString());
            }
          } else if (attachment.kind === 'text' || attachment.kind === 'url') {
            inlineParts.push(attachment.value);
          }
        }
      }

      const mergedMessage = [payload?.message, inlineParts.join('\n'), message]
        .filter(Boolean)
        .join('\n')
        .trim();
      const encrypted = await CryptoService.buildEncryptedPayload({
        chatId: selectedChatId,
        message: mergedMessage || 'Shared content',
        recipientUserIds,
        token,
        currentUserId: currentUserId || '',
      });
      const senderDeviceId = await DeviceService.getOrCreateDeviceId();
      webSocketService.send({
        type: 'chat_message',
        chatId: selectedChatId,
        senderDeviceId,
        envelopes: encrypted.envelopes,
        preview: mergedMessage.slice(0, 120),
        attachments: attachmentIds,
      });

      NotificationService.show('success', 'Shared to chat.');
      ShareIntentService.clearPayload();
      router.replace(`/chat/${selectedChatId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppBackground />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navButton}>
          <Ionicons name="chevron-back" size={20} color={theme.palette.text} />
        </Pressable>
        <Text style={styles.title}>Share to chat</Text>
        <View style={styles.navButton} />
      </View>

      <GlassPanel style={styles.panel} glassEffectStyle="regular" isInteractive>
        <Field label="Message" value={message} onChangeText={setMessage} placeholder="Add a note..." />
        <Text style={styles.sectionTitle}>Choose chat</Text>
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => {
            const isSelected = selectedChatId === item.id.toString();
            const title = item.displayName || item.name || 'Chat';
            return (
              <Pressable
                onPress={() => setSelectedChatId(item.id.toString())}
                style={[styles.chatRow, isSelected && styles.chatRowSelected]}
              >
                <Avatar uri={item.avatarUrl} name={title} size={36} />
                <Text style={styles.chatTitle}>{title}</Text>
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={18} color={theme.palette.accent} />
                ) : null}
              </Pressable>
            );
          }}
          contentContainerStyle={styles.list}
        />
        <PrimaryButton title="Send" onPress={handleSend} loading={isSubmitting} />
      </GlassPanel>
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    header: {
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
    title: {
      flex: 1,
      color: theme.palette.text,
      fontSize: 18,
      ...font('semibold'),
    },
    panel: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      gap: spacing.md,
      flex: 1,
    },
    sectionTitle: {
      color: theme.palette.textSubtle,
      fontSize: 12,
      letterSpacing: 2,
      textTransform: 'uppercase',
      ...font('displayMedium'),
      marginTop: spacing.sm,
    },
    list: {
      gap: spacing.sm,
    },
    chatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: theme.radii.md,
    },
    chatRowSelected: {
      backgroundColor: theme.palette.surfaceSoft,
    },
    chatTitle: {
      flex: 1,
      color: theme.palette.text,
      fontSize: 14,
      ...font('medium'),
    },
  });
