import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { ApiService } from './ApiService';
import { NotificationService } from './NotificationService';
import { StorageService } from './StorageService';

const DEVICE_ID_STORAGE_KEY = 'push_device_id';
const LAST_REGISTERED_TOKEN_KEY = 'push_last_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const getOrCreateDeviceId = async (): Promise<string> => {
  const existing = await StorageService.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const randomId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await StorageService.setItem(DEVICE_ID_STORAGE_KEY, randomId);
  return randomId;
};

const getExpoProjectId = (): string | undefined => {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.expoConfig?.extra?.projectId ||
    Constants.easConfig?.projectId ||
    process.env.EXPO_PROJECT_ID
  );
};

export const PushService = {
  async registerForPushNotifications() {
    try {
      if (!Device.isDevice) {
        console.warn('Push notifications are not supported on simulators');
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permission not granted');
        return;
      }

      const projectId = getExpoProjectId();
      if (!projectId) {
        console.warn('Missing EAS project ID — cannot request Expo push token');
        return;
      }

      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      const expoToken = tokenResponse.data;

      const authToken = await StorageService.getAuthToken();
      if (!authToken) {
        console.warn('Cannot register push token — missing auth token');
        return;
      }

      const deviceId = await getOrCreateDeviceId();

      await ApiService.post(
        '/push/register',
        {
          deviceId,
          expoToken,
        platform: Platform.OS,
        },
        authToken
      );

      await StorageService.setItem(LAST_REGISTERED_TOKEN_KEY, expoToken);
    } catch (error) {
      console.error('Failed to register push notifications:', error);
    }
  },

  async unregisterPushToken() {
    try {
      const authToken = await StorageService.getAuthToken();
      if (!authToken) {
        return;
      }

      const deviceId = await StorageService.getItem(DEVICE_ID_STORAGE_KEY);
      if (!deviceId) {
        return;
      }

      await ApiService.post('/push/unregister', { deviceId }, authToken);
    } catch (error) {
      console.error('Failed to unregister push token:', error);
    }
  },

  addNotificationListeners(onReceive?: (notification: Notifications.Notification) => void) {
    const subs: Notifications.Subscription[] = [];

    if (onReceive) {
      const listener = Notifications.addNotificationReceivedListener(onReceive);
      subs.push(listener);
    }

    return () => subs.forEach((sub) => sub.remove());
  },

  async sendTestPush() {
    try {
      const authToken = await StorageService.getAuthToken();
      if (!authToken) {
        NotificationService.show('error', 'You must be logged in to send a test push.');
        return;
      }

      const response = await ApiService.post(
        '/push/send-test',
        {
          title: 'Syncre Test',
          body: 'Push notifications are configured correctly.',
          data: { type: 'test' },
        },
        authToken
      );

      if (response.success) {
        NotificationService.show('success', 'Test push sent!');
      } else {
        NotificationService.show('error', response.error || 'Failed to send test push');
      }
    } catch (error) {
      console.error('Failed to send test push:', error);
      NotificationService.show('error', 'Failed to send test push');
    }
  },
};
