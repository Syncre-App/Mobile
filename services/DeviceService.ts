import { Platform } from 'react-native';
import { StorageService } from './StorageService';

const DEVICE_ID_STORAGE_KEY = 'push_device_id'; // keep aligned with push registration

export const DeviceService = {
  async getOrCreateDeviceId(): Promise<string> {
    const existing = await StorageService.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const randomId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await StorageService.setItem(DEVICE_ID_STORAGE_KEY, randomId);
    return randomId;
  },

  async getDeviceId(): Promise<string | null> {
    return StorageService.getItem(DEVICE_ID_STORAGE_KEY);
  },

  async clearDeviceId(): Promise<void> {
    await StorageService.removeItem(DEVICE_ID_STORAGE_KEY);
  },
};
