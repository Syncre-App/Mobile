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
import { StorageService } from './StorageService';

// @ts-ignore
if (typeof globalThis.Buffer === 'undefined') {
  // @ts-ignore
  globalThis.Buffer = Buffer;
}

// SecureStore keys
const IDENTITY_PRIVATE_KEY_KEY = 'e2ee_identity_private_v2';
const IDENTITY_PUBLIC_KEY_KEY = 'e2ee_identity_public_v2';
const IDENTITY_VERSION_KEY = 'e2ee_identity_version_v2';
const BACKUP_KEY_STORAGE = 'e2ee_backup_key_v1';
const BACKUP_SALT_STORAGE = 'e2ee_backup_salt_v1';

// Crypto constants
const KEY_INFO_CONTEXT = 'syncre-chat-v1';
const BACKUP_KEY_INFO = 'syncre-backup-v1';
const DEVICE_REGISTRATION_KEY = 'syncre_identity_registration_v2';
const HKDF_KEY_LENGTH = 32;
const IDENTITY_PBKDF_ITERATIONS = 100000;

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

export interface IdentityKeyPair {
  publicKey: string;
  privateKey: string;
  keyVersion: number;
}

interface DecryptionResult {
  plaintext: string;
}

export interface EncryptedLocationPayload {
  ciphertext: string;
  nonce: string;
  version: number;
}

export interface EncryptedIdentityKey {
  publicKey: string;
  encryptedPrivateKey: string;
  nonce: string;
  salt: string;
  iterations: number;
  version: number;
}

export interface BackupEnvelope {
  userId: string;
  payload: string;
  nonce: string;
  keyVersion: number;
}

export interface EncryptedPayloadWithBackup extends EncryptedPayload {
  backupEnvelopes?: BackupEnvelope[];
}

// ═══════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════

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
    console.warn('[CryptoService] Falling back to Math.random entropy', error);
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }
};

// ═══════════════════════════════════════════════════════════════
// Key Derivation
// ═══════════════════════════════════════════════════════════════

const deriveSymmetricKey = (sharedSecret: Uint8Array, chatId: string): Uint8Array => {
  const info = utf8ToBytes(`${KEY_INFO_CONTEXT}:${chatId}`);
  const salt = new Uint8Array(HKDF_KEY_LENGTH);
  const hkdf = new HKDF(SHA256, sharedSecret, salt, info);
  const key = hkdf.expand(HKDF_KEY_LENGTH);
  hkdf.clean();
  return key;
};

async function derivePasswordKey(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const passwordBytes = utf8ToBytes(password);
  return pbkdf2DeriveKey(SHA256, passwordBytes, salt, iterations, 32);
}

// ═══════════════════════════════════════════════════════════════
// SecureStore Operations
// ═══════════════════════════════════════════════════════════════

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

async function deleteSecureItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.error(`[CryptoService] Failed to delete secure item '${key}':`, error);
  }
}

// ═══════════════════════════════════════════════════════════════
// Local Identity Storage
// ═══════════════════════════════════════════════════════════════

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
  console.log('[CryptoService] Local identity persisted');
}

async function clearLocalIdentityStorage(): Promise<void> {
  await deleteSecureItem(IDENTITY_PRIVATE_KEY_KEY);
  await deleteSecureItem(IDENTITY_PUBLIC_KEY_KEY);
  await deleteSecureItem(IDENTITY_VERSION_KEY);
  await StorageService.removeItem(DEVICE_REGISTRATION_KEY);
  console.log('[CryptoService] Local identity storage cleared');
}

async function ensureIdentityAvailable(): Promise<IdentityKeyPair> {
  const identity = await getLocalIdentity();
  if (!identity) {
    throw new Error('Identity key not initialized. Please log in again.');
  }
  return identity;
}

// ═══════════════════════════════════════════════════════════════
// Identity Key Encryption/Decryption (Password-based)
// ═══════════════════════════════════════════════════════════════

/**
 * Encrypt a private key with a password
 */
async function encryptPrivateKeyWithPassword(
  privateKey: Uint8Array,
  password: string
): Promise<{ encryptedPrivateKey: string; nonce: string; salt: string; iterations: number }> {
  const salt = randomBytes(16);
  const iterations = IDENTITY_PBKDF_ITERATIONS;
  const derivedKey = await derivePasswordKey(password, salt, iterations);
  
  const cipher = new XChaCha20Poly1305(derivedKey);
  const nonce = randomBytes(24);
  const encrypted = cipher.seal(nonce, privateKey);

  return {
    encryptedPrivateKey: toBase64(encrypted),
    nonce: toBase64(nonce),
    salt: toBase64(salt),
    iterations,
  };
}

/**
 * Decrypt a private key with a password
 */
async function decryptPrivateKeyWithPassword(
  encryptedPrivateKey: string,
  nonce: string,
  salt: string,
  iterations: number,
  password: string
): Promise<Uint8Array> {
  const derivedKey = await derivePasswordKey(password, fromBase64(salt), iterations);
  const cipher = new XChaCha20Poly1305(derivedKey);
  
  const decrypted = cipher.open(fromBase64(nonce), fromBase64(encryptedPrivateKey));
  if (!decrypted) {
    throw new Error('Failed to decrypt identity key. Wrong password?');
  }
  return decrypted;
}

/**
 * Generate a new X25519 keypair
 */
function generateNewKeyPair(): { privateKey: Uint8Array; publicKey: Uint8Array } {
  const secretKey = randomBytes(32);
  const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
  return {
    privateKey: secretKey,
    publicKey: keyPair.publicKey,
  };
}

// ═══════════════════════════════════════════════════════════════
// Device Registration
// ═══════════════════════════════════════════════════════════════

async function registerDeviceIdentity(
  identity: IdentityKeyPair,
  token: string,
  options?: { force?: boolean }
): Promise<void> {
  try {
    const deviceId = await DeviceService.getOrCreateDeviceId();
    const fingerprint = `${deviceId}:${identity.publicKey}:${identity.keyVersion || 1}`;
    
    if (!options?.force) {
      const existing = await StorageService.getItem(DEVICE_REGISTRATION_KEY);
      if (existing === fingerprint) {
        return;
      }
    }

    await ApiService.post(
      '/keys/register',
      {
        deviceId,
        identityKey: identity.publicKey,
        keyVersion: identity.keyVersion || 1,
      },
      token
    );
    await StorageService.setItem(DEVICE_REGISTRATION_KEY, fingerprint);
    console.log('[CryptoService] Device identity registered');
  } catch (error) {
    console.warn('[CryptoService] Failed to register device identity:', error);
  }
}

// ═══════════════════════════════════════════════════════════════
// Server Identity Operations
// ═══════════════════════════════════════════════════════════════

/**
 * Upload encrypted identity key to server
 */
async function uploadIdentityToServer(
  identity: IdentityKeyPair,
  password: string,
  token: string
): Promise<void> {
  const privateKeyBytes = fromBase64(identity.privateKey);
  const encrypted = await encryptPrivateKeyWithPassword(privateKeyBytes, password);

  await ApiService.post(
    '/keys/identity',
    {
      publicKey: identity.publicKey,
      encryptedPrivateKey: encrypted.encryptedPrivateKey,
      nonce: encrypted.nonce,
      salt: encrypted.salt,
      iterations: encrypted.iterations,
      version: identity.keyVersion || 1,
    },
    token
  );
  
  await registerDeviceIdentity(identity, token, { force: true });
  console.log('[CryptoService] Identity uploaded to server');
}

// ═══════════════════════════════════════════════════════════════
// Recipient Public Key Cache
// ═══════════════════════════════════════════════════════════════

const RECIPIENT_KEY_TTL_MS = 10 * 60 * 1000;
const recipientPublicKeyCache = new Map<string, { key: string; version: number; fetchedAt: number }>();

async function getRecipientPublicKey(
  userId: string,
  token: string,
  forceRefresh: boolean = false
): Promise<string> {
  const cached = recipientPublicKeyCache.get(userId);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < RECIPIENT_KEY_TTL_MS) {
    return cached.key;
  }

  const identityResponse = await ApiService.get(`/keys/identity/public/${userId}`, token);
  if (identityResponse.success && identityResponse.data?.publicKey) {
    const entry = {
      key: identityResponse.data.publicKey,
      version: identityResponse.data.version || 1,
      fetchedAt: Date.now(),
    };
    recipientPublicKeyCache.set(userId, entry);
    return entry.key;
  }

  // Fallback to device registry
  const legacyResponse = await ApiService.get(`/keys/${userId}`, token);
  if (legacyResponse.success && Array.isArray(legacyResponse.data?.devices) && legacyResponse.data.devices.length) {
    const fallbackKey = legacyResponse.data.devices[0]?.identityKey;
    if (fallbackKey) {
      const entry = { key: fallbackKey, version: 1, fetchedAt: Date.now() };
      recipientPublicKeyCache.set(userId, entry);
      return entry.key;
    }
  }

  throw new Error('Recipient has not set up end-to-end encryption yet');
}

// ═══════════════════════════════════════════════════════════════
// Message Encryption/Decryption
// ═══════════════════════════════════════════════════════════════

async function getSenderIdentity(): Promise<{ identity: IdentityKeyPair; privateKeyBytes: Uint8Array }> {
  const identity = await ensureIdentityAvailable();
  const privateKeyBytes = fromBase64(identity.privateKey);
  return { identity, privateKeyBytes };
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
  senderId?: string | number | null;
  currentUserId?: string | number | null;
  token?: string | null;
}): Promise<DecryptionResult | null> {
  const { chatId, envelope, senderId, currentUserId, token } = options;
  const identity = await ensureIdentityAvailable();
  const privateKeyBytes = fromBase64(identity.privateKey);

  let senderKeyBase64 = envelope.senderIdentityKey || null;
  const senderIdStr = senderId?.toString?.();
  const currentUserIdStr = currentUserId?.toString?.();

  if (!senderKeyBase64) {
    if (senderIdStr && currentUserIdStr && senderIdStr === currentUserIdStr) {
      senderKeyBase64 = identity.publicKey;
    } else if (senderIdStr && token) {
      try {
        senderKeyBase64 = await getRecipientPublicKey(senderIdStr, token);
      } catch (error) {
        console.warn('[CryptoService] Failed to resolve sender identity key', error);
        return null;
      }
    }
  }

  if (!senderKeyBase64) {
    console.warn('[CryptoService] Missing sender identity key');
    return null;
  }

  const senderKeyBytes = fromBase64(senderKeyBase64);
  const sharedSecret = nacl.box.before(senderKeyBytes, privateKeyBytes);
  const symmetricKey = deriveSymmetricKey(sharedSecret, chatId);
  const cipher = new XChaCha20Poly1305(symmetricKey);

  try {
    const plaintextBytes = cipher.open(fromBase64(envelope.nonce), fromBase64(envelope.payload));
    if (!plaintextBytes) {
      return null;
    }
    return { plaintext: bytesToUtf8(plaintextBytes) };
  } catch (error) {
    console.error('[CryptoService] Failed to decrypt envelope:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// Personal Key Derivation (for location, etc.)
// ═══════════════════════════════════════════════════════════════

const derivePersonalKey = async (purpose: string): Promise<Uint8Array> => {
  const { privateKeyBytes } = await getSenderIdentity();
  const info = utf8ToBytes(`${KEY_INFO_CONTEXT}:${purpose}`);
  const salt = new Uint8Array(HKDF_KEY_LENGTH);
  const hkdf = new HKDF(SHA256, privateKeyBytes, salt, info);
  const key = hkdf.expand(HKDF_KEY_LENGTH);
  hkdf.clean();
  return key;
};

async function encryptWithPersonalKey(payload: any, purpose: string): Promise<EncryptedLocationPayload> {
  const key = await derivePersonalKey(purpose);
  const cipher = new XChaCha20Poly1305(key);
  const nonce = randomBytes(24);
  const encoded = utf8ToBytes(JSON.stringify(payload));
  const sealed = cipher.seal(nonce, encoded);

  return {
    ciphertext: toBase64(sealed),
    nonce: toBase64(nonce),
    version: 1,
  };
}

// ═══════════════════════════════════════════════════════════════
// Exported CryptoService
// ═══════════════════════════════════════════════════════════════

export const CryptoService = {
  /**
   * Initialize identity from login response.
   * If server has encrypted identity, decrypt it with password.
   * If no identity exists, create a new one and upload it.
   */
  async initializeFromLogin(params: {
    password: string;
    token: string;
    identityKey: EncryptedIdentityKey | null;
  }): Promise<void> {
    const { password, token, identityKey } = params;

    // Check if we already have local identity
    const localIdentity = await getLocalIdentity();
    if (localIdentity) {
      // Register device if needed
      await registerDeviceIdentity(localIdentity, token);
      console.log('[CryptoService] Using existing local identity');
      return;
    }

    // If server has identity, decrypt it
    if (identityKey && identityKey.encryptedPrivateKey) {
      console.log('[CryptoService] Decrypting identity from server...');
      const privateKeyBytes = await decryptPrivateKeyWithPassword(
        identityKey.encryptedPrivateKey,
        identityKey.nonce,
        identityKey.salt,
        identityKey.iterations || IDENTITY_PBKDF_ITERATIONS,
        password
      );

      const identity: IdentityKeyPair = {
        privateKey: toBase64(privateKeyBytes),
        publicKey: identityKey.publicKey,
        keyVersion: identityKey.version || 1,
      };

      await persistLocalIdentity(identity);
      await registerDeviceIdentity(identity, token, { force: true });
      console.log('[CryptoService] Identity decrypted and stored locally');
      return;
    }

    // No identity exists - create new one
    console.log('[CryptoService] Creating new identity...');
    const keyPair = generateNewKeyPair();
    const newIdentity: IdentityKeyPair = {
      privateKey: toBase64(keyPair.privateKey),
      publicKey: toBase64(keyPair.publicKey),
      keyVersion: 1,
    };

    await persistLocalIdentity(newIdentity);
    await uploadIdentityToServer(newIdentity, password, token);
    console.log('[CryptoService] New identity created and uploaded');
  },

  /**
   * Re-encrypt identity key with new password (for password change)
   */
  async reencryptIdentityForPasswordChange(params: {
    oldPassword: string;
    newPassword: string;
    token: string;
  }): Promise<EncryptedIdentityKey> {
    const { newPassword } = params;
    
    // Get local identity (should always exist at this point)
    const identity = await ensureIdentityAvailable();
    const privateKeyBytes = fromBase64(identity.privateKey);
    
    // Encrypt with new password
    const encrypted = await encryptPrivateKeyWithPassword(privateKeyBytes, newPassword);
    
    return {
      publicKey: identity.publicKey,
      encryptedPrivateKey: encrypted.encryptedPrivateKey,
      nonce: encrypted.nonce,
      salt: encrypted.salt,
      iterations: encrypted.iterations,
      version: identity.keyVersion,
    };
  },

  /**
   * Check if local identity exists
   */
  async hasLocalIdentity(): Promise<boolean> {
    const identity = await getLocalIdentity();
    return identity !== null;
  },

  /**
   * Get public key (throws if not initialized)
   */
  async ensureIdentity(): Promise<string> {
    const identity = await ensureIdentityAvailable();
    return identity.publicKey;
  },

  /**
   * Get full identity info
   */
  async getIdentityInfo(): Promise<IdentityKeyPair> {
    return ensureIdentityAvailable();
  },

  /**
   * Get stored identity (may be null)
   */
  async getStoredIdentity(): Promise<IdentityKeyPair | null> {
    return getLocalIdentity();
  },

  /**
   * Reset identity completely (server + local)
   */
  async resetIdentity(): Promise<void> {
    try {
      const token = await StorageService.getAuthToken();
      if (token) {
        const response = await ApiService.delete('/keys/identity', token);
        if (response.success) {
          console.log('[CryptoService] Server-side identity deleted');
        }
      }
    } catch (err) {
      console.warn('[CryptoService] Error deleting server-side identity:', err);
    }

    await clearLocalIdentityStorage();
    recipientPublicKeyCache.clear();
  },

  /**
   * Clear only local identity data (for logout)
   */
  async clearLocalIdentity(): Promise<void> {
    await clearLocalIdentityStorage();
    recipientPublicKeyCache.clear();
  },

  /**
   * Rotate device identity
   */
  async rotateDeviceIdentity(): Promise<void> {
    const token = await StorageService.getAuthToken();
    if (!token) {
      throw new Error('Missing auth token for device rotation');
    }
    const deviceId = await DeviceService.getDeviceId();
    if (!deviceId) {
      throw new Error('Missing device identifier for rotation');
    }

    await ApiService.post('/keys/rotate', { deviceId }, token);
    await this.resetIdentity();
    await DeviceService.clearDeviceId();
    await DeviceService.getOrCreateDeviceId();
  },

  /**
   * Build encrypted payload for multiple recipients
   */
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

    return { envelopes, senderDeviceId };
  },

  /**
   * Decrypt a message from envelopes
   */
  async decryptMessage(params: {
    chatId: string;
    envelopes: EnvelopeEntry[];
    senderId?: string | number | null;
    currentUserId?: string | number | null;
    token?: string | null;
  }): Promise<string | null> {
    const { chatId, envelopes, senderId, currentUserId, token } = params;
    for (const envelope of envelopes) {
      const result = await decryptEnvelope({ chatId, envelope, senderId, currentUserId, token });
      if (result?.plaintext) {
        return result.plaintext;
      }
    }
    return null;
  },

  /**
   * Build envelope for a single recipient
   */
  async buildEnvelopeForRecipient(params: {
    chatId: string;
    message: string;
    recipientUserId: string;
    recipientDeviceId?: string | null;
    token: string;
    currentUserId: string;
    forceRefresh?: boolean;
  }): Promise<EnvelopeEntry> {
    const {
      chatId,
      message,
      recipientUserId,
      recipientDeviceId = null,
      token,
      currentUserId,
      forceRefresh = false,
    } = params;
    const { identity, privateKeyBytes } = await getSenderIdentity();
    const recipientKey =
      recipientUserId === currentUserId
        ? identity.publicKey
        : await getRecipientPublicKey(recipientUserId, token, forceRefresh);
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

  /**
   * Fetch recipient's public key
   */
  async fetchRecipientPublicKey(userId: string, token: string): Promise<string> {
    return getRecipientPublicKey(userId, token);
  },

  /**
   * Encrypt location payload with personal key
   */
  async encryptLocationPayload(payload: {
    latitude: number | null;
    longitude: number | null;
    timezone: string | null;
    recordedAt?: string;
  }): Promise<EncryptedLocationPayload> {
    const normalizedPayload = {
      latitude: payload.latitude,
      longitude: payload.longitude,
      timezone: payload.timezone,
      recordedAt: payload.recordedAt || new Date().toISOString(),
    };
    return encryptWithPersonalKey(normalizedPayload, 'location-v1');
  },

  // Legacy method - kept for backward compatibility during migration
  // TODO: Remove after all users have migrated
  async bootstrapIdentity(params: { pin: string; token: string }): Promise<void> {
    console.warn('[CryptoService] bootstrapIdentity is deprecated. Use initializeFromLogin instead.');
    // This will fail for new users but might work for existing ones
    const response = await ApiService.get('/keys/identity', params.token);
    if (response.success && response.data) {
      await this.initializeFromLogin({
        password: params.pin,
        token: params.token,
        identityKey: response.data as EncryptedIdentityKey,
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // BACKUP KEY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Initialize backup key from password
   * This should be called during login after identity is set up
   */
  async initializeBackupKey(params: { password: string; token: string }): Promise<boolean> {
    const { password, token } = params;

    try {
      // 1. Try to get existing backup salt from server
      const saltResponse = await ApiService.get('/keys/backup/salt', token);
      let salt: Uint8Array;

      if (saltResponse.success && saltResponse.data?.salt) {
        // Use existing salt
        salt = fromBase64(saltResponse.data.salt);
        console.log('[CryptoService] Using existing backup salt from server');
      } else {
        // Generate new salt (first device)
        salt = randomBytes(32);
        const saveResponse = await ApiService.post(
          '/keys/backup/salt',
          { salt: toBase64(salt), version: 1 },
          token
        );
        if (!saveResponse.success) {
          console.error('[CryptoService] Failed to save backup salt:', saveResponse.error);
          return false;
        }
        console.log('[CryptoService] Created and saved new backup salt');
      }

      // 2. Derive backup key from password using PBKDF2 + HKDF
      const passwordBytes = utf8ToBytes(password);
      const passwordKey = pbkdf2DeriveKey(SHA256, passwordBytes, salt, IDENTITY_PBKDF_ITERATIONS, 32);

      const info = utf8ToBytes(BACKUP_KEY_INFO);
      const hkdf = new HKDF(SHA256, passwordKey, new Uint8Array(32), info);
      const backupKey = hkdf.expand(HKDF_KEY_LENGTH);
      hkdf.clean();

      // 3. Store in SecureStore
      await SecureStore.setItemAsync(BACKUP_KEY_STORAGE, toBase64(backupKey));
      await SecureStore.setItemAsync(BACKUP_SALT_STORAGE, toBase64(salt));

      console.log('[CryptoService] Backup key initialized successfully');
      return true;
    } catch (error) {
      console.error('[CryptoService] Failed to initialize backup key:', error);
      return false;
    }
  },

  /**
   * Get the stored backup key
   */
  async getBackupKey(): Promise<Uint8Array | null> {
    try {
      const keyBase64 = await SecureStore.getItemAsync(BACKUP_KEY_STORAGE);
      if (!keyBase64) {
        return null;
      }
      return fromBase64(keyBase64);
    } catch (error) {
      console.error('[CryptoService] Failed to get backup key:', error);
      return null;
    }
  },

  /**
   * Check if backup key is available
   */
  async hasBackupKey(): Promise<boolean> {
    try {
      const keyBase64 = await SecureStore.getItemAsync(BACKUP_KEY_STORAGE);
      return Boolean(keyBase64);
    } catch {
      return false;
    }
  },

  /**
   * Encrypt message with backup key for self-decryption on any device
   */
  async encryptForBackup(message: string): Promise<BackupEnvelope | null> {
    try {
      const backupKey = await this.getBackupKey();
      if (!backupKey) {
        console.warn('[CryptoService] No backup key available');
        return null;
      }

      const cipher = new XChaCha20Poly1305(backupKey);
      const nonce = randomBytes(24);
      const messageBytes = utf8ToBytes(message);
      const encrypted = cipher.seal(nonce, messageBytes);

      // Get current user ID
      const userData = await StorageService.getObject<{ id: string | number }>('user_data');
      const userId = userData?.id?.toString() || '';

      return {
        userId,
        payload: toBase64(encrypted),
        nonce: toBase64(nonce),
        keyVersion: 1,
      };
    } catch (error) {
      console.error('[CryptoService] Failed to encrypt for backup:', error);
      return null;
    }
  },

  /**
   * Decrypt message from backup envelope
   */
  async decryptFromBackup(backupEnvelope: {
    payload: string;
    nonce: string;
  }): Promise<string | null> {
    try {
      const backupKey = await this.getBackupKey();
      if (!backupKey) {
        console.warn('[CryptoService] No backup key available for decryption');
        return null;
      }

      const cipher = new XChaCha20Poly1305(backupKey);
      const nonce = fromBase64(backupEnvelope.nonce);
      const ciphertext = fromBase64(backupEnvelope.payload);

      const plaintext = cipher.open(nonce, ciphertext);
      if (!plaintext) {
        console.error('[CryptoService] Failed to decrypt backup envelope');
        return null;
      }

      return bytesToUtf8(plaintext);
    } catch (error) {
      console.error('[CryptoService] Failed to decrypt from backup:', error);
      return null;
    }
  },

  /**
   * Build encrypted payload with backup envelope included
   */
  async buildEncryptedPayloadWithBackup(params: {
    chatId: string;
    message: string;
    recipientUserIds: string[];
    token: string;
    currentUserId: string;
  }): Promise<EncryptedPayloadWithBackup> {
    const { chatId, message, recipientUserIds, token, currentUserId } = params;

    // Build normal envelopes
    const basePayload = await this.buildEncryptedPayload({
      chatId,
      message,
      recipientUserIds,
      token,
      currentUserId,
    });

    // Add backup envelope for the sender
    const backupEnvelope = await this.encryptForBackup(message);
    const backupEnvelopes = backupEnvelope ? [backupEnvelope] : undefined;

    return {
      ...basePayload,
      backupEnvelopes,
    };
  },

  /**
   * Clear backup key (for logout or reset)
   */
  async clearBackupKey(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(BACKUP_KEY_STORAGE);
      await SecureStore.deleteItemAsync(BACKUP_SALT_STORAGE);
      console.log('[CryptoService] Backup key cleared');
    } catch (error) {
      console.error('[CryptoService] Failed to clear backup key:', error);
    }
  },

  /**
   * Reset all E2EE data (for complete reset)
   */
  async resetAllE2EE(): Promise<void> {
    try {
      // Clear identity keys
      await SecureStore.deleteItemAsync(IDENTITY_PRIVATE_KEY_KEY);
      await SecureStore.deleteItemAsync(IDENTITY_PUBLIC_KEY_KEY);
      await SecureStore.deleteItemAsync(IDENTITY_VERSION_KEY);

      // Clear device registration
      await StorageService.removeItem(DEVICE_REGISTRATION_KEY);

      // Clear backup key
      await this.clearBackupKey();

      // Clear recipient key cache
      recipientPublicKeyCache.clear();

      console.log('[CryptoService] All E2EE data reset');
    } catch (error) {
      console.error('[CryptoService] Failed to reset E2EE data:', error);
    }
  },
};
