/**
 * Crypto Service Index
 * Exports all E2EE functionality
 */

// Primitives
export {
  randomBytes,
  generateKeyPair,
  generateKeyPairAsync,
  generateSigningKeyPair,
  generateSigningKeyPairAsync,
  deriveSharedSecret,
  deriveKeyFromPassword,
  encrypt,
  decrypt,
  encryptMessage,
  decryptMessage,
  encryptPrivateKey,
  decryptPrivateKey,
  encodeBase64,
  decodeBase64,
  encodeUTF8,
  decodeUTF8,
} from './primitives';

// Identity Key Management
export {
  generateIdentityKeyPair,
  storeIdentityKey,
  getStoredIdentityKey,
  hasIdentityKey,
  unlockIdentityKey,
  cacheUnlockedPrivateKey,
  getCachedPrivateKey,
  clearCachedPrivateKey,
  getIdentityKeyPair,
  deleteIdentityKey,
} from './identityKeyManager';
export type { IdentityKeyPair, StoredIdentityKey } from './identityKeyManager';

// Message Encryption
export {
  encryptMessageForRecipients,
  decryptMessageFromEnvelope,
  findEnvelopeForDevice,
  decryptMessageForDevice,
  reencryptMessageForDevice,
} from './messageEncryption';
export type { MessageEnvelope, RecipientDevice, EncryptedMessage } from './messageEncryption';

// Multi-Device Sync
export {
  handleReencryptRequest,
  setupReencryptListener,
  requestReencryptionFromPeers,
} from './multiDeviceSync';
