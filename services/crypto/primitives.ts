/**
 * Cryptographic primitives for E2EE
 * Uses TweetNaCl for X25519 and XChaCha20-Poly1305 for encryption
 */

import * as Crypto from 'expo-crypto';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import { XChaCha20Poly1305 } from '@stablelib/xchacha20poly1305';
import { deriveKey } from '@stablelib/pbkdf2';
import { SHA256 } from '@stablelib/sha256';

// Constants
const NONCE_LENGTH = 24; // XChaCha20 uses 24-byte nonces
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 150000;

/**
 * Generate random bytes async (reliable, uses expo-crypto)
 */
export const randomBytes = async (length: number): Promise<Uint8Array> => {
  const bytes = await Crypto.getRandomBytesAsync(length);
  return new Uint8Array(bytes);
};

/**
 * Generate a new X25519 key pair for key exchange (ASYNC)
 * Uses expo-crypto for reliable random bytes generation
 */
export const generateKeyPairAsync = async (): Promise<{ publicKey: Uint8Array; secretKey: Uint8Array }> => {
  // Generate 32 random bytes for the secret key using expo-crypto
  const secretKey = await randomBytes(32);
  return nacl.box.keyPair.fromSecretKey(secretKey);
};

/**
 * Generate a new X25519 key pair for key exchange (SYNC - fallback)
 * @deprecated Use generateKeyPairAsync instead
 */
export const generateKeyPair = (): { publicKey: Uint8Array; secretKey: Uint8Array } => {
  // Try polyfilled crypto.getRandomValues first
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const secretKey = new Uint8Array(32);
    crypto.getRandomValues(secretKey);
    return nacl.box.keyPair.fromSecretKey(secretKey);
  }
  // Fallback to nacl's built-in (may fail with no PRNG error)
  return nacl.box.keyPair();
};

/**
 * Generate a new signing key pair (Ed25519) (ASYNC)
 * Uses expo-crypto for reliable random bytes generation
 */
export const generateSigningKeyPairAsync = async (): Promise<{ publicKey: Uint8Array; secretKey: Uint8Array }> => {
  // Ed25519 needs 32 bytes seed
  const seed = await randomBytes(32);
  return nacl.sign.keyPair.fromSeed(seed);
};

/**
 * Generate a new signing key pair (Ed25519) (SYNC - fallback)
 * @deprecated Use generateSigningKeyPairAsync instead
 */
export const generateSigningKeyPair = (): { publicKey: Uint8Array; secretKey: Uint8Array } => {
  // Try polyfilled crypto.getRandomValues first
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const seed = new Uint8Array(32);
    crypto.getRandomValues(seed);
    return nacl.sign.keyPair.fromSeed(seed);
  }
  // Fallback to nacl's built-in
  return nacl.sign.keyPair();
};

/**
 * Derive a shared secret from our secret key and their public key (X25519)
 */
export const deriveSharedSecret = (
  ourSecretKey: Uint8Array,
  theirPublicKey: Uint8Array
): Uint8Array => {
  return nacl.box.before(theirPublicKey, ourSecretKey);
};

/**
 * Derive a key from a password using PBKDF2
 */
export const deriveKeyFromPassword = (
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Uint8Array => {
  const passwordBytes = decodeUTF8(password);
  return deriveKey(SHA256, passwordBytes, salt, iterations, KEY_LENGTH);
};

/**
 * Encrypt data using XChaCha20-Poly1305
 */
export const encrypt = async (
  plaintext: Uint8Array,
  key: Uint8Array
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> => {
  const nonce = await randomBytes(NONCE_LENGTH);
  const cipher = new XChaCha20Poly1305(key);
  const ciphertext = cipher.seal(nonce, plaintext);
  return { ciphertext, nonce };
};

/**
 * Decrypt data using XChaCha20-Poly1305
 */
export const decrypt = (
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array
): Uint8Array | null => {
  try {
    const cipher = new XChaCha20Poly1305(key);
    return cipher.open(nonce, ciphertext);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
};

/**
 * Encrypt a string message
 */
export const encryptMessage = async (
  message: string,
  sharedSecret: Uint8Array
): Promise<{ payload: string; nonce: string }> => {
  const messageBytes = decodeUTF8(message);
  const { ciphertext, nonce } = await encrypt(messageBytes, sharedSecret);
  return {
    payload: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
  };
};

/**
 * Decrypt a string message
 */
export const decryptMessage = (
  payload: string,
  nonce: string,
  sharedSecret: Uint8Array
): string | null => {
  try {
    const ciphertext = decodeBase64(payload);
    const nonceBytes = decodeBase64(nonce);
    const plaintext = decrypt(ciphertext, nonceBytes, sharedSecret);
    if (!plaintext) return null;
    return encodeUTF8(plaintext);
  } catch (error) {
    console.error('Message decryption failed:', error);
    return null;
  }
};

/**
 * Encrypt private key with password
 */
export const encryptPrivateKey = async (
  privateKey: Uint8Array,
  password: string
): Promise<{
  encryptedPrivateKey: string;
  nonce: string;
  salt: string;
  iterations: number;
}> => {
  const salt = await randomBytes(SALT_LENGTH);
  const derivedKey = deriveKeyFromPassword(password, salt, PBKDF2_ITERATIONS);
  const { ciphertext, nonce } = await encrypt(privateKey, derivedKey);
  
  return {
    encryptedPrivateKey: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
    salt: encodeBase64(salt),
    iterations: PBKDF2_ITERATIONS,
  };
};

/**
 * Decrypt private key with password
 */
export const decryptPrivateKey = (
  encryptedPrivateKey: string,
  nonce: string,
  salt: string,
  password: string,
  iterations: number = PBKDF2_ITERATIONS
): Uint8Array | null => {
  try {
    const saltBytes = decodeBase64(salt);
    const derivedKey = deriveKeyFromPassword(password, saltBytes, iterations);
    const ciphertext = decodeBase64(encryptedPrivateKey);
    const nonceBytes = decodeBase64(nonce);
    return decrypt(ciphertext, nonceBytes, derivedKey);
  } catch (error) {
    console.error('Private key decryption failed:', error);
    return null;
  }
};

// Base64 encoding/decoding utilities (re-export)
export { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 };
