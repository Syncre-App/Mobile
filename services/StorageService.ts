import AsyncStorage from '@react-native-async-storage/async-storage';

export class StorageService {
  static async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Error storing data:', error);
      throw error;
    }
  }

  static async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Error retrieving data:', error);
      return null;
    }
  }

  static async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing data:', error);
      throw error;
    }
  }

  static async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }

  static async setObject(key: string, value: any): Promise<void> {
    try {
      if (value === undefined || value === null) {
        // AsyncStorage does not accept undefined; remove the key instead
        console.warn(`StorageService.setObject: value for key '${key}' is null/undefined — removing key`);
        await AsyncStorage.removeItem(key);
        return;
      }
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error('Error storing object:', error);
      throw error;
    }
  }

  static async getObject<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Error retrieving object:', error);
      return null;
    }
  }

  // Auth token helpers
  static async setAuthToken(token: string): Promise<void> {
    return this.setItem('auth_token', token);
  }

  static async getAuthToken(): Promise<string | null> {
    return this.getItem('auth_token');
  }

  static async removeAuthToken(): Promise<void> {
    return this.removeItem('auth_token');
  }

  // Content filter helpers
  static async setContentFilter(mode: 'standard' | 'none'): Promise<void> {
    return this.setItem('content_filter', mode);
  }

  static async getContentFilter(): Promise<'standard' | 'none'> {
    const value = await this.getItem('content_filter');
    if (value === 'none') return 'none';
    return 'standard'; // default
  }

  // Privacy settings helpers
  static async setReadReceipts(enabled: boolean): Promise<void> {
    return this.setItem('read_receipts', enabled ? 'true' : 'false');
  }

  static async getReadReceipts(): Promise<boolean> {
    const value = await this.getItem('read_receipts');
    return value !== 'false'; // default true
  }

  static async setLastSeen(enabled: boolean): Promise<void> {
    return this.setItem('last_seen', enabled ? 'true' : 'false');
  }

  static async getLastSeen(): Promise<boolean> {
    const value = await this.getItem('last_seen');
    return value !== 'false'; // default true
  }

  static async setTypingIndicator(enabled: boolean): Promise<void> {
    return this.setItem('typing_indicator', enabled ? 'true' : 'false');
  }

  static async getTypingIndicator(): Promise<boolean> {
    const value = await this.getItem('typing_indicator');
    return value !== 'false'; // default true
  }
}
