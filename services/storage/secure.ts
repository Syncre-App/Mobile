import * as SecureStore from 'expo-secure-store';
import { APP_CONFIG } from '../../constants/config';

/**
 * Secure storage wrapper using expo-secure-store
 * Uses Keychain on iOS and Keystore on Android
 */
export const secureStorage = {
  /**
   * Save a value securely
   */
  async set(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch (error) {
      console.error(`SecureStore set error for key ${key}:`, error);
      throw error;
    }
  },

  /**
   * Get a value from secure storage
   */
  async get(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`SecureStore get error for key ${key}:`, error);
      return null;
    }
  },

  /**
   * Delete a value from secure storage
   */
  async delete(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`SecureStore delete error for key ${key}:`, error);
    }
  },

  /**
   * Save auth token
   */
  async setAuthToken(token: string): Promise<void> {
    await this.set(APP_CONFIG.AUTH_TOKEN_KEY, token);
  },

  /**
   * Get auth token
   */
  async getAuthToken(): Promise<string | null> {
    return this.get(APP_CONFIG.AUTH_TOKEN_KEY);
  },

  /**
   * Delete auth token
   */
  async deleteAuthToken(): Promise<void> {
    await this.delete(APP_CONFIG.AUTH_TOKEN_KEY);
  },

  /**
   * Save user data
   */
  async setUserData(data: object): Promise<void> {
    await this.set(APP_CONFIG.USER_DATA_KEY, JSON.stringify(data));
  },

  /**
   * Get user data
   */
  async getUserData<T>(): Promise<T | null> {
    const data = await this.get(APP_CONFIG.USER_DATA_KEY);
    if (data) {
      try {
        return JSON.parse(data) as T;
      } catch {
        return null;
      }
    }
    return null;
  },

  /**
   * Delete user data
   */
  async deleteUserData(): Promise<void> {
    await this.delete(APP_CONFIG.USER_DATA_KEY);
  },

  /**
   * Save device ID
   */
  async setDeviceId(deviceId: string): Promise<void> {
    await this.set(APP_CONFIG.DEVICE_ID_KEY, deviceId);
  },

  /**
   * Get device ID
   */
  async getDeviceId(): Promise<string | null> {
    return this.get(APP_CONFIG.DEVICE_ID_KEY);
  },

  /**
   * Save encrypted password (for biometric unlock)
   */
  async setEncryptedPassword(encryptedPassword: string): Promise<void> {
    await this.set(APP_CONFIG.ENCRYPTED_PASSWORD_KEY, encryptedPassword);
  },

  /**
   * Get encrypted password
   */
  async getEncryptedPassword(): Promise<string | null> {
    return this.get(APP_CONFIG.ENCRYPTED_PASSWORD_KEY);
  },

  /**
   * Delete encrypted password
   */
  async deleteEncryptedPassword(): Promise<void> {
    await this.delete(APP_CONFIG.ENCRYPTED_PASSWORD_KEY);
  },

  /**
   * Set biometric enabled flag
   */
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    await this.set(APP_CONFIG.BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
  },

  /**
   * Check if biometric is enabled
   */
  async isBiometricEnabled(): Promise<boolean> {
    const value = await this.get(APP_CONFIG.BIOMETRIC_ENABLED_KEY);
    return value === 'true';
  },

  /**
   * Clear all auth data (for logout)
   */
  async clearAuthData(): Promise<void> {
    await Promise.all([
      this.deleteAuthToken(),
      this.deleteUserData(),
      this.deleteEncryptedPassword(),
      this.delete(APP_CONFIG.BIOMETRIC_ENABLED_KEY),
    ]);
  },
};
