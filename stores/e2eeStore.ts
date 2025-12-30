/**
 * E2EE Store
 * Manages end-to-end encryption state and operations
 */

import { create } from 'zustand';
import { keysApi } from '../services/api';
import {
  generateIdentityKeyPair,
  storeIdentityKey,
  getStoredIdentityKey,
  hasIdentityKey,
  unlockIdentityKey,
  cacheUnlockedPrivateKey,
  getCachedPrivateKey,
  clearCachedPrivateKey,
  getIdentityKeyPair,
  encodeBase64,
  decodeBase64,
  IdentityKeyPair,
  StoredIdentityKey,
  RecipientDevice,
  encryptMessageForRecipients,
  decryptMessageForDevice,
  MessageEnvelope,
} from '../services/crypto';
import { secureStorage } from '../services/storage/secure';

interface E2EEState {
  // State
  isInitialized: boolean;
  hasLocalKey: boolean;
  hasServerKey: boolean;
  isUnlocked: boolean;
  isLoading: boolean;
  error: string | null;

  // Cached keys for other users (userId -> devices)
  recipientDevices: Record<string, RecipientDevice[]>;

  // Actions
  initialize: () => Promise<void>;
  setupIdentityKey: (password: string) => Promise<{ success: boolean; error?: string }>;
  unlockWithPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  registerDevice: (deviceId: string) => Promise<{ success: boolean; error?: string }>;
  fetchRecipientDevices: (userIds: string[]) => Promise<void>;
  encryptMessage: (plaintext: string, chatParticipantIds: string[], senderDeviceId: string) => Promise<MessageEnvelope[] | null>;
  decryptMessage: (envelopes: MessageEnvelope[], userId: string, deviceId: string) => Promise<string | null>;
  clearSession: () => Promise<void>;
  clearError: () => void;
}

export const useE2EEStore = create<E2EEState>((set, get) => ({
  // Initial state
  isInitialized: false,
  hasLocalKey: false,
  hasServerKey: false,
  isUnlocked: false,
  isLoading: false,
  error: null,
  recipientDevices: {},

  // Initialize E2EE state
  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      // Check for local key
      const hasLocal = await hasIdentityKey();
      
      // Check for cached unlocked key
      const cachedKey = await getCachedPrivateKey();
      const isUnlocked = cachedKey !== null;

      // Check for server key
      let hasServer = false;
      try {
        const serverKey = await keysApi.getIdentityKey();
        hasServer = !!serverKey?.publicKey;
      } catch (error: any) {
        // 404 means no key on server, which is fine
        if (error.status !== 404) {
          console.error('Failed to fetch server identity key:', error);
        }
      }

      set({
        isInitialized: true,
        hasLocalKey: hasLocal,
        hasServerKey: hasServer,
        isUnlocked,
        isLoading: false,
      });
    } catch (error: any) {
      console.error('E2EE initialization error:', error);
      set({
        isInitialized: true,
        isLoading: false,
        error: error.message || 'Failed to initialize E2EE',
      });
    }
  },

  // Setup new identity key (first time or key rotation)
  setupIdentityKey: async (password: string) => {
    try {
      set({ isLoading: true, error: null });

      // Generate new key pair
      const keyPair = generateIdentityKeyPair();

      // Store locally (encrypted with password)
      const stored = await storeIdentityKey(keyPair, password);

      // Register with server
      await keysApi.registerIdentityKey({
        publicKey: stored.publicKey,
        encryptedPrivateKey: stored.encryptedPrivateKey,
        nonce: stored.nonce,
        salt: stored.salt,
        iterations: stored.iterations,
        version: stored.version,
      });

      // Cache unlocked key for session
      await cacheUnlockedPrivateKey(keyPair.privateKey);

      set({
        hasLocalKey: true,
        hasServerKey: true,
        isUnlocked: true,
        isLoading: false,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Failed to setup identity key:', error);
      set({
        isLoading: false,
        error: error.message || 'Failed to setup encryption',
      });
      return { success: false, error: error.message };
    }
  },

  // Unlock identity key with password
  unlockWithPassword: async (password: string) => {
    try {
      set({ isLoading: true, error: null });

      // Try to unlock from local storage first
      let keyPair = await unlockIdentityKey(password);

      if (!keyPair) {
        // Try to fetch from server and decrypt
        try {
          const serverKey = await keysApi.getIdentityKey();
          if (serverKey) {
            // Store server key locally
            const storedKey: StoredIdentityKey = {
              publicKey: serverKey.publicKey,
              encryptedPrivateKey: serverKey.encryptedPrivateKey,
              nonce: serverKey.nonce,
              salt: serverKey.salt,
              iterations: serverKey.iterations,
              version: serverKey.version,
            };
            await secureStorage.set('e2ee_identity_key', JSON.stringify(storedKey));
            
            // Try unlock again
            keyPair = await unlockIdentityKey(password);
          }
        } catch (fetchError) {
          console.error('Failed to fetch server key:', fetchError);
        }
      }

      if (!keyPair) {
        set({ isLoading: false, error: 'Invalid password' });
        return { success: false, error: 'Invalid password' };
      }

      // Cache for session
      await cacheUnlockedPrivateKey(keyPair.privateKey);

      set({
        isUnlocked: true,
        hasLocalKey: true,
        isLoading: false,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Failed to unlock identity key:', error);
      set({
        isLoading: false,
        error: error.message || 'Failed to unlock',
      });
      return { success: false, error: error.message };
    }
  },

  // Register device with server
  registerDevice: async (deviceId: string) => {
    try {
      set({ isLoading: true, error: null });

      const keyPair = await getIdentityKeyPair();
      if (!keyPair) {
        throw new Error('No identity key available');
      }

      await keysApi.registerDeviceKey({
        deviceId,
        identityKey: encodeBase64(keyPair.publicKey),
        keyVersion: 1,
      });

      set({ isLoading: false });
      return { success: true };
    } catch (error: any) {
      console.error('Failed to register device:', error);
      set({
        isLoading: false,
        error: error.message || 'Failed to register device',
      });
      return { success: false, error: error.message };
    }
  },

  // Fetch recipient devices for encryption
  fetchRecipientDevices: async (userIds: string[]) => {
    try {
      const devices: Record<string, RecipientDevice[]> = { ...get().recipientDevices };

      for (const userId of userIds) {
        try {
          const userDevices = await keysApi.getUserDevices(userId);
          devices[userId] = userDevices
            .filter(d => !d.revoked)
            .map(d => ({
              userId,
              deviceId: d.deviceId,
              publicKey: d.pubIdentityKey,
              keyVersion: d.keyVersion,
            }));
        } catch (error) {
          console.error(`Failed to fetch devices for user ${userId}:`, error);
        }
      }

      set({ recipientDevices: devices });
    } catch (error) {
      console.error('Failed to fetch recipient devices:', error);
    }
  },

  // Encrypt message for all chat participants
  encryptMessage: async (plaintext: string, chatParticipantIds: string[], senderDeviceId: string) => {
    try {
      const { recipientDevices, fetchRecipientDevices } = get();

      // Ensure we have devices for all participants
      const missingUsers = chatParticipantIds.filter(id => !recipientDevices[id]?.length);
      if (missingUsers.length > 0) {
        await fetchRecipientDevices(missingUsers);
      }

      // Collect all recipient devices
      const allDevices: RecipientDevice[] = [];
      for (const userId of chatParticipantIds) {
        const devices = get().recipientDevices[userId] || [];
        allDevices.push(...devices);
      }

      if (allDevices.length === 0) {
        console.error('No recipient devices found');
        return null;
      }

      const result = await encryptMessageForRecipients(plaintext, allDevices, senderDeviceId);
      return result?.envelopes || null;
    } catch (error) {
      console.error('Failed to encrypt message:', error);
      return null;
    }
  },

  // Decrypt message
  decryptMessage: async (envelopes: MessageEnvelope[], userId: string, deviceId: string) => {
    try {
      return await decryptMessageForDevice(envelopes, userId, deviceId);
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      return null;
    }
  },

  // Clear session (on logout)
  clearSession: async () => {
    await clearCachedPrivateKey();
    set({
      isUnlocked: false,
      recipientDevices: {},
    });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));
