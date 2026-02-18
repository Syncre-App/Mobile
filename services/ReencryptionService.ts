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
      console.log('[ReencryptionService] Completed re-encryption push for chat', chatId);
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
    let beforeCursor: string | null = null;
    let processed = 0;
    let appended = 0;
    console.log('[ReencryptionService] Starting re-encrypt job', {
      chatId,
      targetUserId,
      targetDeviceId,
    });

    while (true) {
      const params = new URLSearchParams();
      params.set('limit', String(this.MESSAGE_LIMIT));
      if (deviceId) {
        params.set('deviceId', deviceId);
      }
      if (beforeCursor) {
        params.set('before', beforeCursor);
      }

      const response = await ApiService.get(`/chat/${chatId}/messages?${params.toString()}`, token);
      if (!response.success || !Array.isArray(response.data?.messages)) {
        console.warn('[ReencryptionService] Unable to fetch messages for re-encryption', response.error);
        break;
      }

      const messages: any[] = response.data.messages;
      if (!messages.length) {
        break;
      }

      const envelopesToPost: Array<{ messageId: string; envelopes: any[] }> = [];

      for (const raw of messages) {
        const senderId = raw.senderId ?? raw.sender_id ?? raw.userId;
        if (!senderId || senderId.toString() !== currentUserId) {
          continue;
        }

        if (!raw.isEncrypted || !Array.isArray(raw.envelopes) || !raw.envelopes.length) {
          continue;
        }

        const hasEnvelope =
          raw.envelopes?.some?.(
            (entry: any) =>
              entry.recipientId?.toString?.() === targetUserId &&
              (targetDeviceId ? entry.recipientDevice === targetDeviceId : true)
          ) ?? false;

        if (hasEnvelope) {
          continue;
        }

        // Try to decrypt with current identity key
        let plaintext = await CryptoService.decryptMessage({
          chatId,
          envelopes: raw.envelopes,
          senderId,
          currentUserId,
          token,
        });
        
        // If that fails, try backup envelope (for messages sent with old identity)
        if (!plaintext && raw.backupEnvelope) {
          console.log(`[ReencryptionService] Trying backup envelope for message ${raw.id}...`);
          plaintext = await CryptoService.decryptFromBackup(raw.backupEnvelope);
        }
        
        if (!plaintext) {
          console.warn(`[ReencryptionService] Could not decrypt message ${raw.id} for re-encryption`);
          continue;
        }

        try {
          const envelope = await CryptoService.buildEnvelopeForRecipient({
            chatId,
            message: plaintext,
            recipientUserId: targetUserId,
            recipientDeviceId: targetDeviceId,
            token,
            currentUserId,
          });

          envelopesToPost.push({
            messageId: String(raw.id ?? raw.messageId),
            envelopes: [envelope],
          });
          appended += 1;
        } catch (error) {
          console.warn('[ReencryptionService] Failed to build envelope for message', raw.id, error);
        }
      }

      if (envelopesToPost.length > 0) {
        try {
          const response = await ApiService.post(
            '/keys/envelopes/batch',
            { envelopes: envelopesToPost },
            token
          );
          if (response.success) {
            console.log('[ReencryptionService] Posted batch of envelopes', {
              count: envelopesToPost.length,
              chatId,
            });
          } else {
            console.warn('[ReencryptionService] Batch post returned failure:', response);
            // Fallback to sequential posting
            for (const item of envelopesToPost) {
              await ApiService.post('/keys/envelopes', item, token).catch(() => null);
            }
          }
        } catch (error) {
          console.warn('[ReencryptionService] Failed to post envelope batch, falling back to sequential...', error);
          // Fallback if batch endpoint doesn't exist yet
          for (const item of envelopesToPost) {
            await ApiService.post('/keys/envelopes', item, token).catch(() => null);
          }
        }
      }

      processed += messages.length;
      if (!response.data?.hasMore || !response.data?.nextCursor) {
        break;
      }
      beforeCursor = response.data.nextCursor;
    }

    console.log('[ReencryptionService] Finished re-encrypt job', {
      chatId,
      processed,
      appended,
    });
  }
}

export const ReencryptionService = new ReencryptionServiceClass();
