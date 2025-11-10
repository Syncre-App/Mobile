import { ApiService } from './ApiService';
import { StorageService } from './StorageService';
import { DeviceService } from './DeviceService';
import { CryptoService } from './CryptoService';

interface ReencryptRequestPayload {
  chatId: string | number | undefined;
  targetUserId: string | number | undefined;
  targetDeviceId?: string | number | null;
}

class ReencryptionServiceClass {
  private inflight: Set<string> = new Set();
  private MESSAGE_LIMIT = 50;

  async handleRequest(payload: ReencryptRequestPayload) {
    const chatId = payload.chatId?.toString?.() ?? String(payload.chatId ?? '');
    const targetUserId = payload.targetUserId?.toString?.() ?? '';
    if (!chatId || !targetUserId) {
      return;
    }

    const token = await StorageService.getAuthToken();
    if (!token) {
      return;
    }

    const currentUser = await StorageService.getObject<any>('user_data');
    const currentUserId = currentUser?.id ? currentUser.id.toString() : null;
    if (!currentUserId || currentUserId === targetUserId) {
      return;
    }

    const key = `${chatId}:${targetUserId}:${payload.targetDeviceId ?? 'all'}`;
    if (this.inflight.has(key)) {
      return;
    }
    this.inflight.add(key);
    try {
      await this.processRequest({
        chatId,
        targetUserId,
        targetDeviceId: payload.targetDeviceId?.toString?.() ?? null,
        token,
        currentUserId,
      });
    } catch (error) {
      console.warn('[ReencryptionService] Failed to process re-encrypt request:', error);
    } finally {
      this.inflight.delete(key);
    }
  }

  private async processRequest({
    chatId,
    targetUserId,
    targetDeviceId,
    token,
    currentUserId,
  }: {
    chatId: string;
    targetUserId: string;
    targetDeviceId: string | null;
    token: string;
    currentUserId: string;
  }) {
    const deviceId = await DeviceService.getOrCreateDeviceId();
    const params = new URLSearchParams();
    params.set('limit', String(this.MESSAGE_LIMIT));
    if (deviceId) {
      params.set('deviceId', deviceId);
    }

    const response = await ApiService.get(`/chat/${chatId}/messages?${params.toString()}`, token);
    if (!response.success || !Array.isArray(response.data?.messages)) {
      console.warn('[ReencryptionService] Unable to fetch messages for re-encryption', response.error);
      return;
    }

    const messages: any[] = response.data.messages;
    for (const raw of messages) {
      const senderId = raw.senderId ?? raw.sender_id ?? raw.userId;
      if (!senderId || senderId.toString() !== currentUserId) {
        continue;
      }

      if (!raw.isEncrypted || !Array.isArray(raw.envelopes) || !raw.envelopes.length) {
        continue;
      }

      const plaintext = await CryptoService.decryptMessage(chatId, raw.envelopes);
      if (!plaintext) {
        continue;
      }

      try {
        const envelope = await CryptoService.buildEnvelopeForRecipient({
          chatId,
          message: plaintext,
          recipientUserId: targetUserId,
          recipientDeviceId,
          token,
          currentUserId,
        });

        await ApiService.post(
          '/keys/envelopes',
          {
            messageId: raw.id ?? raw.messageId,
            envelopes: [envelope],
          },
          token
        );
      } catch (error) {
        console.warn('[ReencryptionService] Failed to append envelope for message', raw.id, error);
      }
    }
  }
}

export const ReencryptionService = new ReencryptionServiceClass();
