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
}
