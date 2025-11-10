import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import nacl from 'tweetnacl';
import { XChaCha20Poly1305 } from '@stablelib/xchacha20poly1305';
import { HKDF } from '@stablelib/hkdf';
import { SHA256 } from '@stablelib/sha256';
import { deriveKey as pbkdf2DeriveKey } from '@stablelib/pbkdf2';
import { ApiService } from './ApiService';
import { DeviceService } from './DeviceService';

// @ts-ignore
if (typeof globalThis.Buffer === 'undefined') {
  // @ts-ignore
  globalThis.Buffer = Buffer;
}

const IDENTITY_PRIVATE_KEY_KEY = 'e2ee_identity_private_v1';
const IDENTITY_PUBLIC_KEY_KEY = 'e2ee_identity_public_v1';
const IDENTITY_VERSION_KEY = 'e2ee_identity_version';
const KEY_INFO_CONTEXT = 'syncre-chat-v1';
const HKDF_KEY_LENGTH = 32;

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

const deriveSymmetricKey = (sharedSecret: Uint8Array, chatId: string): Uint8Array => {
  const info = utf8ToBytes(`${KEY_INFO_CONTEXT}:${chatId}`);
  const salt = new Uint8Array(HKDF_KEY_LENGTH);
  const hkdf = new HKDF(SHA256, sharedSecret, salt, info);
  const key = hkdf.expand(HKDF_KEY_LENGTH);
  hkdf.clean();
  return key;
};

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

async function getLocalIdentity(): Promise<IdentityKeyPair | null> {
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
  return null;
}

async function persistLocalIdentity(identity: IdentityKeyPair): Promise<void> {
  await writeSecureItem(IDENTITY_PRIVATE_KEY_KEY, identity.privateKey);
  await writeSecureItem(IDENTITY_PUBLIC_KEY_KEY, identity.publicKey);
  await writeSecureItem(IDENTITY_VERSION_KEY, String(identity.keyVersion));
}

async function ensureIdentityAvailable(): Promise<IdentityKeyPair> {
  const identity = await getLocalIdentity();
  if (!identity) {
    throw new Error('Identity key not initialized');
  }
  return identity;
}

async function derivePassphraseKey(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const passwordBytes = utf8ToBytes(password);
  return pbkdf2DeriveKey(SHA256, passwordBytes, salt, iterations, 32);
}

const recipientPublicKeyCache = new Map<string, { key: string; version: number }>();

async function encryptPrivateKey(secretKey: Uint8Array, passphraseKey: Uint8Array) {
  const cipher = new XChaCha20Poly1305(passphraseKey);
  const nonce = randomBytes(24);
  const encrypted = cipher.seal(nonce, secretKey);
  return {
    encryptedPrivateKey: toBase64(encrypted),
    nonce: toBase64(nonce),
  };
}

async function decryptPrivateKey(encryptedBase64: string, nonceBase64: string, passphraseKey: Uint8Array) {
  const cipher = new XChaCha20Poly1305(passphraseKey);
  const decrypted = cipher.open(fromBase64(nonceBase64), fromBase64(encryptedBase64));
  if (!decrypted) {
    throw new Error('Failed to decrypt identity key');
  }
  return decrypted;
}

async function getRecipientPublicKey(userId: string, token: string): Promise<string> {
  const cached = recipientPublicKeyCache.get(userId);
  if (cached) {
    return cached.key;
  }

  const identityResponse = await ApiService.get(`/keys/identity/public/${userId}`, token);
  if (identityResponse.success && identityResponse.data?.publicKey) {
    const entry = {
      key: identityResponse.data.publicKey,
      version: identityResponse.data.version || 1,
    };
    recipientPublicKeyCache.set(userId, entry);
    return entry.key;
  }

  if (identityResponse.statusCode && identityResponse.statusCode !== 404) {
    console.warn('[CryptoService] identity lookup failed, falling back to device registry:', identityResponse.error);
  }

  const legacyResponse = await ApiService.get(`/keys/${userId}`, token);
  if (!legacyResponse.success || !Array.isArray(legacyResponse.data?.devices) || !legacyResponse.data.devices.length) {
    throw new Error(legacyResponse.error || 'Missing recipient identity key');
  }

  const fallbackKey = legacyResponse.data.devices[0]?.identityKey;
  if (!fallbackKey) {
    throw new Error('Missing recipient identity key');
  }

  const entry = { key: fallbackKey, version: 1 };
  recipientPublicKeyCache.set(userId, entry);
  return entry.key;
}

interface BootstrapParams {
  password: string;
  token: string;
}

async function getSenderIdentity(): Promise<{
  identity: IdentityKeyPair;
  privateKeyBytes: Uint8Array;
}> {
  const identity = await ensureIdentityAvailable();
  const privateKeyBytes = fromBase64(identity.privateKey);
  return {
    identity,
    privateKeyBytes,
  };
}

async function registerDeviceIdentity(identity: IdentityKeyPair, token: string): Promise<void> {
  try {
    const deviceId = await DeviceService.getOrCreateDeviceId();
    await ApiService.post(
      '/keys/register',
      {
        deviceId,
        identityKey: identity.publicKey,
        keyVersion: identity.keyVersion || 1,
      },
      token
    );
  } catch (error) {
    console.warn('[CryptoService] Failed to register device identity:', error);
  }
}

async function uploadIdentityBundle({
  identity,
  password,
  token,
}: {
  identity: IdentityKeyPair;
  password: string;
  token: string;
}): Promise<void> {
  const saltBytes = randomBytes(16);
  const iterations = 200000;
  const passphraseKey = await derivePassphraseKey(password, saltBytes, iterations);
  const secretKeyBytes = fromBase64(identity.privateKey);
  const { encryptedPrivateKey, nonce } = await encryptPrivateKey(secretKeyBytes, passphraseKey);

  await ApiService.post(
    '/keys/identity',
    {
      publicKey: identity.publicKey,
      encryptedPrivateKey,
      nonce,
      salt: toBase64(saltBytes),
      iterations,
      version: identity.keyVersion || 1,
    },
    token
  );
  await registerDeviceIdentity(identity, token);
}

async function bootstrapIdentity({ password, token }: BootstrapParams): Promise<void> {
  const localIdentity = await getLocalIdentity();
  if (localIdentity) {
    await uploadIdentityBundle({ identity: localIdentity, password, token });
    return;
  }

  try {
    await ApiService.post('/keys/identity/unlock', { password }, token);
  } catch (error) {
    // best effort; continue to fetch identity info
  }

  const existing = await ApiService.get('/keys/identity', token);
  if (existing.success && existing.data) {
    const saltBase64 = existing.data.salt;
    const nonceBase64 = existing.data.nonce;
    if (!saltBase64 || !nonceBase64) {
      throw new Error('Incomplete identity key payload');
    }
    const saltBytes = fromBase64(saltBase64);
    const iterations = existing.data.iterations || 150000;
    const passphraseKey = await derivePassphraseKey(password, saltBytes, iterations);
    const privateKeyBytes = await decryptPrivateKey(existing.data.encryptedPrivateKey, nonceBase64, passphraseKey);
    const privateKey = toBase64(privateKeyBytes);
    const identity: IdentityKeyPair = {
      privateKey,
      publicKey: existing.data.publicKey,
      keyVersion: existing.data.version || 1,
    };
    await persistLocalIdentity(identity);
    await uploadIdentityBundle({ identity, password, token });
    return;
  }

  if (existing.statusCode && existing.statusCode !== 404) {
    throw new Error(existing.error || 'Failed to fetch identity key');
  }

  // No identity exists anywhere; create a fresh pair, encrypt, and upload.
  const secretKey = randomBytes(32);
  const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
  const freshIdentity: IdentityKeyPair = {
    privateKey: toBase64(secretKey),
    publicKey: toBase64(keyPair.publicKey),
    keyVersion: 1,
  };

  await persistLocalIdentity(freshIdentity);
  await uploadIdentityBundle({ identity: freshIdentity, password, token });
}

async function encryptForRecipient({
  chatId,
  message,
  recipientUserId,
  recipientPublicKey,
  privateKeyBytes,
  senderPublicKey,
  recipientDeviceId,
}: {
  chatId: string;
  message: string;
  recipientUserId: string;
  recipientPublicKey: string;
  privateKeyBytes: Uint8Array;
  senderPublicKey: string;
  recipientDeviceId?: string | null;
}): Promise<EnvelopeEntry> {
  const recipientKeyBytes = fromBase64(recipientPublicKey);
  const sharedSecret = nacl.box.before(recipientKeyBytes, privateKeyBytes);
  const symmetricKey = deriveSymmetricKey(sharedSecret, chatId);
  const cipher = new XChaCha20Poly1305(symmetricKey);

  const nonce = randomBytes(24);
  const payload = cipher.seal(nonce, utf8ToBytes(message));

  return {
    recipientId: recipientUserId,
    recipientDevice: recipientDeviceId || null,
    payload: toBase64(payload),
    nonce: toBase64(nonce),
    keyVersion: 1,
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
  const identity = await ensureIdentityAvailable();
  const privateKeyBytes = fromBase64(identity.privateKey);

  const sharedSecret = nacl.box.before(senderKeyBytes, privateKeyBytes);
  const symmetricKey = deriveSymmetricKey(sharedSecret, chatId);
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
  bootstrapIdentity,

  async ensureIdentity(): Promise<string> {
    const identity = await ensureIdentityAvailable();
    return identity.publicKey;
  },

  async getIdentityInfo(): Promise<IdentityKeyPair> {
    return ensureIdentityAvailable();
  },

  async resetIdentity(): Promise<void> {
    await SecureStore.deleteItemAsync(IDENTITY_PRIVATE_KEY_KEY);
    await SecureStore.deleteItemAsync(IDENTITY_PUBLIC_KEY_KEY);
    await SecureStore.deleteItemAsync(IDENTITY_VERSION_KEY);
    recipientPublicKeyCache.clear();
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

    const { identity, privateKeyBytes } = await getSenderIdentity();
    const senderDeviceId = await DeviceService.getOrCreateDeviceId();
    const uniqueRecipients = new Set(recipientUserIds.map((id) => id.toString()));
    uniqueRecipients.add(currentUserId);

    const envelopes: EnvelopeEntry[] = [];
    for (const userId of uniqueRecipients) {
      const publicKey =
        userId === currentUserId ? identity.publicKey : await getRecipientPublicKey(userId, token);
      envelopes.push(
        await encryptForRecipient({
          chatId,
          message,
          recipientUserId: userId,
          recipientPublicKey: publicKey,
          privateKeyBytes,
          senderPublicKey: identity.publicKey,
          recipientDeviceId: null,
        })
      );
    }

    return {
      envelopes,
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

  async buildEnvelopeForRecipient(params: {
    chatId: string;
    message: string;
    recipientUserId: string;
    recipientDeviceId?: string | null;
    token: string;
    currentUserId: string;
  }): Promise<EnvelopeEntry> {
    const { chatId, message, recipientUserId, recipientDeviceId = null, token, currentUserId } = params;
    const { identity, privateKeyBytes } = await getSenderIdentity();
    const recipientKey =
      recipientUserId === currentUserId ? identity.publicKey : await getRecipientPublicKey(recipientUserId, token);
    return encryptForRecipient({
      chatId,
      message,
      recipientUserId,
      recipientPublicKey: recipientKey,
      privateKeyBytes,
      senderPublicKey: identity.publicKey,
      recipientDeviceId,
    });
  },

  async fetchRecipientPublicKey(userId: string, token: string): Promise<string> {
    return getRecipientPublicKey(userId, token);
  },
};
