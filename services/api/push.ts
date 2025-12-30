import { apiClient } from './client';
import { PushRegisterRequest } from '../../types/api';

export const pushApi = {
  /**
   * Register push notification token
   */
  registerToken: async (data: PushRegisterRequest): Promise<{ message: string }> => {
    return apiClient.post('/push/register', data);
  },

  /**
   * Unregister push notification token
   */
  unregisterToken: async (deviceId: string): Promise<{ message: string }> => {
    return apiClient.post('/push/unregister', { deviceId });
  },
};
