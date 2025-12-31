/**
 * Message Encryption Service
 * Handles encryption and decryption of chat messages for E2EE
 * Uses envelope-based encryption for multi-device support
 */

import {
  deriveSharedSecret,
  encryptMessage,
  decryptMessage,
  encodeBase64,
  decodeBase64,
} from './primitives';
import { getIdentityKeyPair, IdentityKeyPair } from './identityKeyManager';

export interface MessageEnvelope {
  recipientId: string;
  recipientDevice: string | null;
  payload: string; // Base64 encoded ciphertext
  nonce: string; // Base64 encoded nonce
  keyVersion: number;
  alg: string;
  senderIdentityKey: string; // Base64 encoded public key
  senderDeviceId: string;
  version: number;
}

export interface RecipientDevice {
  userId: string;
  deviceId: string;
  publicKey: string; // Base64 encoded
  keyVersion: number;
}

export interface EncryptedMessage {
  envelopes: MessageEnvelope[];
  preview?: string; // Optional unencrypted preview for notifications
}

/**
 * Encrypt a message for multiple recipients and their devices
 */
export const encryptMessageForRecipients = async (
  plaintext: string,
  recipients: RecipientDevice[],
  senderDeviceId: string,
  senderKeyPair?: IdentityKeyPair
): Promise<EncryptedMessage | null> => {
  // Get sender's key pair
  const keyPair = senderKeyPair || await getIdentityKeyPair();
  if (!keyPair) {
    console.error('Cannot encrypt: no identity key pair available');
    return null;
  }

  const senderPublicKeyBase64 = encodeBase64(keyPair.publicKey);
  const envelopes: MessageEnvelope[] = [];

  for (const recipient of recipients) {
    try {
      // Validate recipient public key
      if (!recipient.publicKey || typeof recipient.publicKey !== 'string') {
        console.error(`Invalid public key for recipient ${recipient.userId}:${recipient.deviceId}:`, recipient.publicKey);
        continue;
      }

      // Debug log the public key
      if (__DEV__) {
        console.log(`[MessageEncryption] Encrypting for ${recipient.userId}:${recipient.deviceId}, publicKey: ${recipient.publicKey.substring(0, 20)}...`);
      }

      // Derive shared secret with recipient's public key
      const recipientPublicKey = decodeBase64(recipient.publicKey);
      const sharedSecret = deriveSharedSecret(keyPair.privateKey, recipientPublicKey);

      // Encrypt the message
      const encrypted = await encryptMessage(plaintext, sharedSecret);

      const envelope: MessageEnvelope = {
        recipientId: recipient.userId,
        recipientDevice: recipient.deviceId,
        payload: encrypted.payload,
        nonce: encrypted.nonce,
        keyVersion: recipient.keyVersion,
        alg: 'xchacha20poly1305',
        senderIdentityKey: senderPublicKeyBase64,
        senderDeviceId,
        version: 1,
      };

      envelopes.push(envelope);
    } catch (error) {
      console.error(`Failed to encrypt for recipient ${recipient.userId}:${recipient.deviceId}:`, error);
    }
  }

  if (envelopes.length === 0) {
    console.error('Failed to create any envelopes');
    return null;
  }

  return {
    envelopes,
    preview: plaintext.slice(0, 100), // Short preview for notifications
  };
};

/**
 * Decrypt a message from an envelope
 */
export const decryptMessageFromEnvelope = async (
  envelope: MessageEnvelope,
  recipientKeyPair?: IdentityKeyPair
): Promise<string | null> => {
  // Get recipient's (our) key pair
  const keyPair = recipientKeyPair || await getIdentityKeyPair();
  if (!keyPair) {
    console.error('Cannot decrypt: no identity key pair available');
    return null;
  }

  try {
    // Get sender's public key from envelope
    const senderPublicKey = decodeBase64(envelope.senderIdentityKey);
    
    // Derive shared secret
    const sharedSecret = deriveSharedSecret(keyPair.privateKey, senderPublicKey);

    // Decrypt the message
    const plaintext = decryptMessage(envelope.payload, envelope.nonce, sharedSecret);
    
    return plaintext;
  } catch (error) {
    console.error('Failed to decrypt message:', error);
    return null;
  }
};

/**
 * Find the appropriate envelope for the current user/device
 */
export const findEnvelopeForDevice = (
  envelopes: MessageEnvelope[],
  userId: string,
  deviceId: string
): MessageEnvelope | null => {
  // First try to find exact match (user + device)
  let envelope = envelopes.find(
    e => e.recipientId === userId && e.recipientDevice === deviceId
  );

  // If no exact match, try to find one just for the user (any device)
  if (!envelope) {
    envelope = envelopes.find(
      e => e.recipientId === userId && (!e.recipientDevice || e.recipientDevice === null)
    );
  }

  // Last resort: just match user ID
  if (!envelope) {
    envelope = envelopes.find(e => e.recipientId === userId);
  }

  return envelope || null;
};

/**
 * Decrypt a message using the appropriate envelope
 */
export const decryptMessageForDevice = async (
  envelopes: MessageEnvelope[],
  userId: string,
  deviceId: string,
  recipientKeyPair?: IdentityKeyPair
): Promise<string | null> => {
  const envelope = findEnvelopeForDevice(envelopes, userId, deviceId);
  
  if (!envelope) {
    console.warn(`No envelope found for user ${userId} device ${deviceId}`);
    return null;
  }

  return decryptMessageFromEnvelope(envelope, recipientKeyPair);
};

/**
 * Re-encrypt a message for a new device
 * Used when a user adds a new device and needs to decrypt old messages
 */
export const reencryptMessageForDevice = async (
  plaintext: string,
  targetDevice: RecipientDevice,
  senderDeviceId: string,
  senderKeyPair?: IdentityKeyPair
): Promise<MessageEnvelope | null> => {
  const result = await encryptMessageForRecipients(
    plaintext,
    [targetDevice],
    senderDeviceId,
    senderKeyPair
  );

  return result?.envelopes[0] || null;
};
