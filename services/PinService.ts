import * as SecureStore from 'expo-secure-store';

const PIN_STORAGE_KEY = 'syncre_identity_pin_v1';

export const PinService = {
  async getPin(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(PIN_STORAGE_KEY);
    } catch (error) {
      console.error('[PinService] Failed to read stored PIN:', error);
      return null;
    }
  },

  async setPin(pin: string): Promise<void> {
    if (!pin || !pin.trim()) {
      await this.clearPin();
      return;
    }
    try {
      await SecureStore.setItemAsync(PIN_STORAGE_KEY, pin.trim());
    } catch (error) {
      console.error('[PinService] Failed to persist PIN:', error);
      throw error;
    }
  },

  async clearPin(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(PIN_STORAGE_KEY);
    } catch (error) {
      console.error('[PinService] Failed to clear PIN:', error);
    }
  },
};
