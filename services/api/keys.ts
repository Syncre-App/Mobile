import { apiClient } from './client';
import {
  IdentityKey,
  RegisterIdentityKeyRequest,
  DeviceKey,
  RegisterDeviceKeyRequest,
} from '../../types/api';

export const keysApi = {
  /**
   * Get user's own identity key (encrypted private key + public key)
   */
  getIdentityKey: async (): Promise<IdentityKey> => {
    return apiClient.get<IdentityKey>('/keys/identity');
  },

  /**
   * Register/store user's identity key
   */
  registerIdentityKey: async (data: RegisterIdentityKeyRequest): Promise<{ message: string }> => {
    return apiClient.post('/keys/identity', data);
  },

  /**
   * Unlock pending identity with password
   */
  unlockIdentity: async (password: string): Promise<{ message: string }> => {
    return apiClient.post('/keys/identity/unlock', { password });
  },

  /**
   * Get another user's public identity key
   */
  getPublicIdentityKey: async (userId: string): Promise<{ publicKey: string }> => {
    return apiClient.get(`/keys/identity/public/${userId}`);
  },

  /**
   * Get all devices for a user
   */
  getUserDevices: async (userId: string): Promise<DeviceKey[]> => {
    const response = await apiClient.get<{ devices: DeviceKey[] }>(`/keys/${userId}`);
    return response.devices || [];
  },

  /**
   * Register device public key
   */
  registerDeviceKey: async (data: RegisterDeviceKeyRequest): Promise<{ message: string }> => {
    return apiClient.post('/keys/register', data);
  },

  /**
   * Rotate device key (revoke + trigger re-encrypt)
   */
  rotateDeviceKey: async (deviceId: string): Promise<{ message: string }> => {
    return apiClient.post('/keys/rotate', { deviceId });
  },

  /**
   * Revoke device key
   */
  revokeDeviceKey: async (deviceId: string): Promise<{ message: string }> => {
    return apiClient.post('/keys/revoke', { deviceId });
  },

  /**
   * Add envelopes for re-encrypted messages
   */
  addEnvelopes: async (messageId: number, envelopes: any[]): Promise<{ message: string }> => {
    return apiClient.post('/keys/envelopes', { messageId, envelopes });
  },
};
