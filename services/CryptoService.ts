import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import nacl from 'tweetnacl';
import { XChaCha20Poly1305 } from '@stablelib/xchacha20poly1305';
import { hkdf } from '@stablelib/hkdf';
import { SHA256 } from '@stablelib/sha256';
import { ApiService } from './ApiService';
import { DeviceService } from './DeviceService';
import { StorageService } from './StorageService';

// @ts-ignore
if (typeof globalThis.Buffer === 'undefined') {
  // @ts-ignore
  globalThis.Buffer = Buffer;
}

const IDENTITY_PRIVATE_KEY_KEY = 'e2ee_identity_private_v1';
const IDENTITY_PUBLIC_KEY_KEY = 'e2ee_identity_public_v1';
const IDENTITY_VERSION_KEY = 'e2ee_identity_version';
const KEY_REGISTRATION_FLAG_PREFIX = 'e2ee_registration:';
const KEY_INFO_CONTEXT = 'syncre-chat-v1';
const HKDF_KEY_LENGTH = 32;
const MESSAGE_PREVIEW_LENGTH = 120;

export interface DeviceKeyRecord {
  deviceId: string;
  identityKey: string;
  keyVersion: number;
  lastSeen?: string | null;
}

export interface EnvelopeEntry {
  recipientId: string;
  recipientDevice: string | null;
  payload: string;
  nonce: string;
  keyVersion: number;
  alg: string;
  senderIdentityKey: string | null;
  version: number;
}

export interface EncryptedPayload {
  envelopes: EnvelopeEntry[];
  preview: string | null;
  senderDeviceId: string;
}

interface IdentityKeyPair {
  publicKey: string;
  privateKey: string;
  keyVersion: number;
}

interface DecryptionResult {
  plaintext: string;
}

const toBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');
const fromBase64 = (value: string): Uint8Array => new Uint8Array(Buffer.from(value, 'base64'));
const utf8ToBytes = (value: string): Uint8Array => new Uint8Array(Buffer.from(value, 'utf8'));
const bytesToUtf8 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('utf8');

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  try {
    Crypto.getRandomValues(bytes);
    return bytes;
  } catch (error) {
    console.warn('[CryptoService] Falling back to Math.random entropy. Do not use in production builds.', error);
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }
};

const deriveSymmetricKey = (sharedSecret: Uint8Array, chatId: string, recipientDeviceId: string | null): Uint8Array => {
  const info = utf8ToBytes(`${KEY_INFO_CONTEXT}:${chatId}:${recipientDeviceId ?? 'default'}`);
  const salt = new Uint8Array(HKDF_KEY_LENGTH); // zero salt is acceptable for HKDF when info changes per message.
  return hkdf(SHA256, sharedSecret, salt, info, HKDF_KEY_LENGTH);
};

const registrationKey = (deviceId: string, version: number): string =>
  `${KEY_REGISTRATION_FLAG_PREFIX}${deviceId}:v${version}`;

async function readSecureItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error(`[CryptoService] Failed to read secure item '${key}':`, error);
    return null;
  }
}

async function writeSecureItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.error(`[CryptoService] Failed to persist secure item '${key}':`, error);
    throw error;
  }
}

async function ensureIdentityKeyPair(): Promise<IdentityKeyPair> {
  const existingPrivate = await readSecureItem(IDENTITY_PRIVATE_KEY_KEY);
  const existingPublic = await readSecureItem(IDENTITY_PUBLIC_KEY_KEY);
  const versionStr = (await readSecureItem(IDENTITY_VERSION_KEY)) || '1';
  const version = Number.parseInt(versionStr, 10) || 1;

  if (existingPrivate && existingPublic) {
    return {
      privateKey: existingPrivate,
      publicKey: existingPublic,
      keyVersion: version,
    };
  }

  const secretKey = randomBytes(32);
  const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
  const privateKey = toBase64(secretKey);
  const publicKey = toBase64(keyPair.publicKey);

  await writeSecureItem(IDENTITY_PRIVATE_KEY_KEY, privateKey);
  await writeSecureItem(IDENTITY_PUBLIC_KEY_KEY, publicKey);
  await writeSecureItem(IDENTITY_VERSION_KEY, String(version));

  return {
    privateKey,
    publicKey,
    keyVersion: version,
  };
}

async function ensureKeyRegistration(token: string): Promise<void> {
  const identity = await ensureIdentityKeyPair();
  const deviceId = await DeviceService.getOrCreateDeviceId();

  const registrationMarker = registrationKey(deviceId, identity.keyVersion);
  const alreadyRegistered = await StorageService.getItem(registrationMarker);
  if (alreadyRegistered === '1') {
    return;
  }

  const response = await ApiService.post(
    '/keys/register',
    {
      deviceId,
      identityKey: identity.publicKey,
      keyVersion: identity.keyVersion,
    },
    token
  );

  if (!response.success) {
    throw new Error(response.error || 'Failed to register device key');
  }

  await StorageService.setItem(registrationMarker, '1');
}

async function fetchRemoteDevices(targetUserId: string, token: string): Promise<DeviceKeyRecord[]> {
  const cacheKey = `e2ee_devices:${targetUserId}`;
  const cachedData = (await StorageService.getObject<DeviceKeyRecord[]>(cacheKey)) ?? null;

  const response = await ApiService.get(`/keys/${targetUserId}`, token);
  if (!response.success || !response.data) {
    if (cachedData) {
      return cachedData;
    }
    throw new Error(response.error || 'Failed to fetch device keys');
  }

  const devices = Array.isArray(response.data.devices) ? response.data.devices : [];
  await StorageService.setObject(cacheKey, devices);
  return devices;
}

async function getSenderIdentity(): Promise<{
  identity: IdentityKeyPair;
  privateKeyBytes: Uint8Array;
  publicKeyBytes: Uint8Array;
}> {
  const identity = await ensureIdentityKeyPair();
  const privateKeyBytes = fromBase64(identity.privateKey);
  const publicKeyBytes = fromBase64(identity.publicKey);
  return {
    identity,
    privateKeyBytes,
    publicKeyBytes,
  };
}

const buildPreview = (message: string): string | null => {
  if (!message) {
    return null;
  }
  if (message.length <= MESSAGE_PREVIEW_LENGTH) {
    return message;
  }
  return `${message.slice(0, MESSAGE_PREVIEW_LENGTH - 1)}…`;
};

async function encryptForDevice(options: {
  chatId: string;
  message: string;
  recipientUserId: string;
  device: DeviceKeyRecord;
  privateKeyBytes: Uint8Array;
  senderPublicKey: string;
}): Promise<EnvelopeEntry> {
  const { chatId, message, recipientUserId, device, privateKeyBytes, senderPublicKey } = options;
  const recipientKeyBytes = fromBase64(device.identityKey);
  const sharedSecret = nacl.box.before(recipientKeyBytes, privateKeyBytes);
  const symmetricKey = deriveSymmetricKey(sharedSecret, chatId, device.deviceId);
  const cipher = new XChaCha20Poly1305(symmetricKey);

  const nonce = randomBytes(24);
  const payload = cipher.seal(nonce, utf8ToBytes(message));

  return {
    recipientId: recipientUserId,
    recipientDevice: device.deviceId,
    payload: toBase64(payload),
    nonce: toBase64(nonce),
    keyVersion: device.keyVersion ?? 1,
    alg: 'xchacha20poly1305',
    senderIdentityKey: senderPublicKey,
    version: 1,
  };
}

async function decryptEnvelope(options: {
  chatId: string;
  envelope: EnvelopeEntry;
}): Promise<DecryptionResult | null> {
  const { chatId, envelope } = options;
  if (!envelope.senderIdentityKey) {
    console.warn('[CryptoService] Missing senderIdentityKey, cannot decrypt envelope');
    return null;
  }

  const senderKeyBytes = fromBase64(envelope.senderIdentityKey);
  const { privateKeyBytes } = await getSenderIdentity();

  const sharedSecret = nacl.box.before(senderKeyBytes, privateKeyBytes);
  const symmetricKey = deriveSymmetricKey(sharedSecret, chatId, envelope.recipientDevice || null);
  const cipher = new XChaCha20Poly1305(symmetricKey);

  try {
    const plaintextBytes = cipher.open(fromBase64(envelope.nonce), fromBase64(envelope.payload));
    if (!plaintextBytes) {
      return null;
    }
    return {
      plaintext: bytesToUtf8(plaintextBytes),
    };
  } catch (error) {
    console.error('[CryptoService] Failed to decrypt envelope:', error);
    return null;
  }
}

export const CryptoService = {
  async ensureIdentity(token: string): Promise<string> {
    await ensureKeyRegistration(token);
    const identity = await ensureIdentityKeyPair();
    return identity.publicKey;
  },

  async getIdentityInfo(): Promise<IdentityKeyPair> {
    return ensureIdentityKeyPair();
  },

  async resetIdentity(): Promise<void> {
    await SecureStore.deleteItemAsync(IDENTITY_PRIVATE_KEY_KEY);
    await SecureStore.deleteItemAsync(IDENTITY_PUBLIC_KEY_KEY);
    await SecureStore.deleteItemAsync(IDENTITY_VERSION_KEY);
  },

  async getDeviceKeys(userId: string, token: string): Promise<DeviceKeyRecord[]> {
    return fetchRemoteDevices(userId, token);
  },

  async buildEncryptedPayload(params: {
    chatId: string;
    message: string;
    recipientUserIds: string[];
    token: string;
    currentUserId: string;
  }): Promise<EncryptedPayload> {
    const { chatId, message, recipientUserIds, token, currentUserId } = params;
    if (!recipientUserIds.length) {
      throw new Error('No recipients provided for encrypted payload');
    }

    const { identity, privateKeyBytes, publicKeyBytes } = await getSenderIdentity();
    await ensureKeyRegistration(token);

    const senderDeviceId = await DeviceService.getOrCreateDeviceId();
    const allRecipients = new Map<string, DeviceKeyRecord[]>();

    for (const userId of recipientUserIds) {
      const devices = await fetchRemoteDevices(userId, token);
      if (!devices.length) {
        console.warn(`[CryptoService] No device keys for user ${userId}`);
      }
      allRecipients.set(userId, devices);
    }

    // Include the sender's own devices so other clients stay in sync.
    let senderDevices: DeviceKeyRecord[] = [];
    try {
      senderDevices = await fetchRemoteDevices(currentUserId, token);
    } catch (error) {
      console.warn('[CryptoService] Unable to fetch sender devices, using current device only', error);
    }

    const senderPublicKey = toBase64(publicKeyBytes);
    if (!senderDevices.length) {
      senderDevices = [
        {
          deviceId: senderDeviceId,
          identityKey: senderPublicKey,
          keyVersion: identity.keyVersion,
        },
      ];
    }
    allRecipients.set(currentUserId, senderDevices);

    const envelopes: EnvelopeEntry[] = [];

    for (const [userId, devices] of allRecipients) {
      for (const device of devices) {
        envelopes.push(
          await encryptForDevice({
            chatId,
            message,
            recipientUserId: userId,
            device,
            privateKeyBytes,
            senderPublicKey,
          })
        );
      }
    }

    return {
      envelopes,
      preview: buildPreview(message),
      senderDeviceId,
    };
  },

  async decryptMessage(chatId: string, envelopes: EnvelopeEntry[]): Promise<string | null> {
    for (const envelope of envelopes) {
      const result = await decryptEnvelope({ chatId, envelope });
      if (result?.plaintext) {
        return result.plaintext;
      }
    }
    return null;
  },
};
