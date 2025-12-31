/**
 * Multi-Device Sync Service
 * Handles re-encryption of messages when new devices are added
 */

import { keysApi, chatApi } from '../api';
import { wsClient } from '../websocket/client';
import { WSMessage, WSRequestReencryptEvent } from '../websocket/types';
import { getIdentityKeyPair } from './identityKeyManager';
import { encodeBase64 } from './primitives';
import {
  RecipientDevice,
  reencryptMessageForDevice,
  decryptMessageForDevice,
  MessageEnvelope,
} from './messageEncryption';
import { Message } from '../../types/chat';

/**
 * Handle incoming request_reencrypt WebSocket event
 * This is called when another user adds a new device and needs us to re-encrypt messages for them
 */
export const handleReencryptRequest = async (event: WSRequestReencryptEvent): Promise<void> => {
  console.log('Received re-encrypt request:', event);

  const { targetUserId, targetDeviceId, chatId, reason } = event;

  try {
    // Get our identity key pair
    const keyPair = await getIdentityKeyPair();
    if (!keyPair) {
      console.error('Cannot re-encrypt: no identity key pair available');
      return;
    }

    // Get target user's new device public key
    const targetDevices = await keysApi.getUserDevices(targetUserId.toString());
    const newDevice = targetDevices.find(d => 
      !d.revoked && (targetDeviceId ? d.deviceId === targetDeviceId : true)
    );

    if (!newDevice) {
      console.error('Cannot find target device for re-encryption');
      return;
    }

    const recipientDevice: RecipientDevice = {
      userId: targetUserId.toString(),
      deviceId: newDevice.deviceId,
      publicKey: newDevice.identityKey, // Backend returns 'identityKey' for the public key
      keyVersion: newDevice.keyVersion,
    };

    // Get messages from this chat that we sent
    const messagesResponse = await chatApi.getMessages(chatId, { limit: 100 });
    const myMessages = messagesResponse.messages.filter(m => 
      m.isEncrypted && m.envelopes && m.envelopes.length > 0
    );

    if (myMessages.length === 0) {
      console.log('No encrypted messages to re-encrypt');
      return;
    }

    // Get our device ID from secure storage
    const { secureStorage } = await import('../storage/secure');
    const myDeviceId = await secureStorage.getDeviceId();
    if (!myDeviceId) {
      console.error('No device ID available');
      return;
    }

    // Re-encrypt each message for the new device
    for (const message of myMessages) {
      try {
        // First, decrypt the message using our own envelope
        const myUserId = message.senderId.toString();
        const plaintext = await decryptMessageForDevice(
          message.envelopes!,
          myUserId,
          myDeviceId,
          keyPair
        );

        if (!plaintext) {
          console.warn(`Could not decrypt message ${message.id} for re-encryption`);
          continue;
        }

        // Re-encrypt for the new device
        const newEnvelope = await reencryptMessageForDevice(
          plaintext,
          recipientDevice,
          myDeviceId,
          keyPair
        );

        if (newEnvelope) {
          // Send the new envelope to the server
          await keysApi.addEnvelopes(message.id, [newEnvelope]);
          console.log(`Re-encrypted message ${message.id} for device ${recipientDevice.deviceId}`);
        }
      } catch (error) {
        console.error(`Failed to re-encrypt message ${message.id}:`, error);
      }
    }

    console.log(`Completed re-encryption for ${myMessages.length} messages`);
  } catch (error) {
    console.error('Re-encryption failed:', error);
  }
};

/**
 * Setup WebSocket listener for re-encrypt requests
 */
export const setupReencryptListener = (): (() => void) => {
  const unsubscribe = wsClient.on('request_reencrypt', (message: WSMessage) => {
    const event = message as WSRequestReencryptEvent;
    handleReencryptRequest(event).catch(console.error);
  });

  return unsubscribe;
};

/**
 * Request re-encryption from other chat participants after registering a new device
 * This is handled automatically by the backend when we call registerDeviceKey
 */
export const requestReencryptionFromPeers = async (deviceId: string): Promise<void> => {
  // The backend automatically sends request_reencrypt to other participants
  // when we register a new device key, so we don't need to do anything here
  console.log(`Device ${deviceId} registered, backend will notify peers for re-encryption`);
};
