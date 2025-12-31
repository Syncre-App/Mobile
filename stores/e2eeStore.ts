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

// Debug logging helper
const log = (label: string, message: string, data?: any) => {
  if (__DEV__) {
    console.log(`[E2EEStore] ${label}:`, message, data || '');
  }
};

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
      log('initialize', 'Starting E2EE initialization...');
      set({ isLoading: true, error: null });

      // Check for local key
      const hasLocal = await hasIdentityKey();
      log('initialize', `Local key exists: ${hasLocal}`);
      
      // Check for cached unlocked key
      const cachedKey = await getCachedPrivateKey();
      const isUnlocked = cachedKey !== null;
      log('initialize', `Cached key exists (unlocked): ${isUnlocked}`);

      // Check for server key
      let hasServer = false;
      try {
        const serverKey = await keysApi.getIdentityKey();
        hasServer = !!serverKey?.publicKey;
        log('initialize', `Server key exists: ${hasServer}`, serverKey ? { publicKey: serverKey.publicKey.substring(0, 20) + '...' } : null);
      } catch (error: any) {
        // 404 means no key on server, which is fine
        if (error.status !== 404) {
          console.error('Failed to fetch server identity key:', error);
        }
        log('initialize', 'No server key found or error fetching');
      }

      log('initialize', 'E2EE initialization complete', { hasLocal, hasServer, isUnlocked });
      set({
        isInitialized: true,
        hasLocalKey: hasLocal,
        hasServerKey: hasServer,
        isUnlocked,
        isLoading: false,
      });
    } catch (error: any) {
      console.error('E2EE initialization error:', error);
      log('initialize', 'E2EE initialization failed', { error: error.message });
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
      log('setupIdentityKey', 'Starting identity key setup...');
      set({ isLoading: true, error: null });

      // Generate new key pair (async for reliable PRNG)
      log('setupIdentityKey', 'Generating new key pair...');
      const keyPair = await generateIdentityKeyPair();
      log('setupIdentityKey', 'Key pair generated', { publicKeyLength: keyPair.publicKey.length });

      // Store locally (encrypted with password)
      log('setupIdentityKey', 'Storing key locally...');
      const stored = await storeIdentityKey(keyPair, password);
      log('setupIdentityKey', 'Key stored locally');

      // Register with server
      log('setupIdentityKey', 'Registering key with server...');
      await keysApi.registerIdentityKey({
        publicKey: stored.publicKey,
        encryptedPrivateKey: stored.encryptedPrivateKey,
        nonce: stored.nonce,
        salt: stored.salt,
        iterations: stored.iterations,
        version: stored.version,
      });
      log('setupIdentityKey', 'Key registered with server');

      // Cache unlocked key for session
      log('setupIdentityKey', 'Caching unlocked key for session...');
      await cacheUnlockedPrivateKey(keyPair.privateKey);

      log('setupIdentityKey', 'Identity key setup complete!');
      set({
        hasLocalKey: true,
        hasServerKey: true,
        isUnlocked: true,
        isLoading: false,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Failed to setup identity key:', error);
      log('setupIdentityKey', 'Setup failed', { error: error.message });
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
      log('fetchRecipientDevices', `Fetching devices for users: ${userIds.join(', ')}`);
      const devices: Record<string, RecipientDevice[]> = { ...get().recipientDevices };

      for (const userId of userIds) {
        try {
          const userDevices = await keysApi.getUserDevices(userId);
          log('fetchRecipientDevices', `Got ${userDevices.length} devices for user ${userId}`);
          
          // Debug: log raw response to see what we're getting
          if (__DEV__ && userDevices.length > 0) {
            console.log(`[E2EEStore] Raw device data for user ${userId}:`, JSON.stringify(userDevices[0], null, 2));
          }
          
          devices[userId] = userDevices
            .filter(d => !d.revoked)
            .map(d => ({
              userId,
              deviceId: d.deviceId,
              publicKey: d.identityKey, // Backend returns 'identityKey' for the public key
              keyVersion: d.keyVersion,
            }));
            
          log('fetchRecipientDevices', `Mapped ${devices[userId].length} active devices for user ${userId}`);
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
