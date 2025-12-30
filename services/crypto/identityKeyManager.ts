/**
 * Identity Key Manager
 * Handles generation, storage, and retrieval of identity keys
 * Identity keys are X25519 key pairs used for E2EE
 */

import { secureStorage } from '../storage/secure';
import {
  generateKeyPair,
  encryptPrivateKey,
  decryptPrivateKey,
  encodeBase64,
  decodeBase64,
} from './primitives';

const IDENTITY_KEY_STORAGE_KEY = 'e2ee_identity_key';
const IDENTITY_PRIVATE_KEY_STORAGE_KEY = 'e2ee_identity_private_key';

export interface IdentityKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface StoredIdentityKey {
  publicKey: string;
  encryptedPrivateKey: string;
  nonce: string;
  salt: string;
  iterations: number;
  version: number;
}

/**
 * Generate a new identity key pair
 */
export const generateIdentityKeyPair = (): IdentityKeyPair => {
  const keyPair = generateKeyPair();
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.secretKey,
  };
};

/**
 * Store identity key pair locally (encrypted with password)
 */
export const storeIdentityKey = async (
  keyPair: IdentityKeyPair,
  password: string
): Promise<StoredIdentityKey> => {
  const encrypted = await encryptPrivateKey(keyPair.privateKey, password);
  
  const storedKey: StoredIdentityKey = {
    publicKey: encodeBase64(keyPair.publicKey),
    encryptedPrivateKey: encrypted.encryptedPrivateKey,
    nonce: encrypted.nonce,
    salt: encrypted.salt,
    iterations: encrypted.iterations,
    version: 1,
  };

  await secureStorage.set(IDENTITY_KEY_STORAGE_KEY, JSON.stringify(storedKey));
  
  return storedKey;
};

/**
 * Get stored identity key metadata (without decrypting private key)
 */
export const getStoredIdentityKey = async (): Promise<StoredIdentityKey | null> => {
  const stored = await secureStorage.get(IDENTITY_KEY_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored) as StoredIdentityKey;
  } catch {
    return null;
  }
};

/**
 * Check if identity key exists locally
 */
export const hasIdentityKey = async (): Promise<boolean> => {
  const stored = await getStoredIdentityKey();
  return stored !== null;
};

/**
 * Unlock identity key with password
 * Returns the decrypted private key or null if password is wrong
 */
export const unlockIdentityKey = async (
  password: string
): Promise<IdentityKeyPair | null> => {
  const stored = await getStoredIdentityKey();
  if (!stored) return null;

  const privateKey = decryptPrivateKey(
    stored.encryptedPrivateKey,
    stored.nonce,
    stored.salt,
    password,
    stored.iterations
  );

  if (!privateKey) return null;

  return {
    publicKey: decodeBase64(stored.publicKey),
    privateKey,
  };
};

/**
 * Store unlocked private key in memory (for session use)
 * This is stored in SecureStore and should be cleared on logout
 */
export const cacheUnlockedPrivateKey = async (privateKey: Uint8Array): Promise<void> => {
  await secureStorage.set(IDENTITY_PRIVATE_KEY_STORAGE_KEY, encodeBase64(privateKey));
};

/**
 * Get cached unlocked private key
 */
export const getCachedPrivateKey = async (): Promise<Uint8Array | null> => {
  const cached = await secureStorage.get(IDENTITY_PRIVATE_KEY_STORAGE_KEY);
  if (!cached) return null;
  
  try {
    return decodeBase64(cached);
  } catch {
    return null;
  }
};

/**
 * Clear cached private key (on logout)
 */
export const clearCachedPrivateKey = async (): Promise<void> => {
  await secureStorage.delete(IDENTITY_PRIVATE_KEY_STORAGE_KEY);
};

/**
 * Get full identity key pair from cache or unlock with password
 */
export const getIdentityKeyPair = async (
  password?: string
): Promise<IdentityKeyPair | null> => {
  const stored = await getStoredIdentityKey();
  if (!stored) return null;

  // Try cached first
  const cachedPrivateKey = await getCachedPrivateKey();
  if (cachedPrivateKey) {
    return {
      publicKey: decodeBase64(stored.publicKey),
      privateKey: cachedPrivateKey,
    };
  }

  // Need password to unlock
  if (!password) return null;

  const keyPair = await unlockIdentityKey(password);
  if (keyPair) {
    // Cache for future use
    await cacheUnlockedPrivateKey(keyPair.privateKey);
  }
  
  return keyPair;
};

/**
 * Delete all identity key data (for account deletion or key rotation)
 */
export const deleteIdentityKey = async (): Promise<void> => {
  await Promise.all([
    secureStorage.delete(IDENTITY_KEY_STORAGE_KEY),
    secureStorage.delete(IDENTITY_PRIVATE_KEY_STORAGE_KEY),
  ]);
};
