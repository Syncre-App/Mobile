import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import appConfig from '../app.json';

import { ApiService } from './ApiService';
import { StorageService } from './StorageService';
import { DeviceService } from './DeviceService';

const LAST_REGISTERED_TOKEN_KEY = 'push_last_token';
const DEFAULT_ANDROID_CHANNEL = 'default';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const FALLBACK_PROJECT_ID =
  (appConfig?.expo as any)?.extra?.eas?.projectId || process.env.EXPO_PROJECT_ID;

const getExpoProjectId = (): string | undefined => {
  const manifestExtra =
    (Constants.manifest2 as any)?.extra ||
    Constants.manifest?.extra ||
    (Constants as any)?.manifestExtra ||
    Constants.expoConfig?.extra;

  return (
    Constants.easConfig?.projectId ||
    manifestExtra?.eas?.projectId ||
    manifestExtra?.projectId ||
    process.env.EXPO_PROJECT_ID ||
    process.env.EXPO_PUBLIC_PROJECT_ID ||
    FALLBACK_PROJECT_ID
  );
};

export const PushService = {
  async registerForPushNotifications() {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(DEFAULT_ANDROID_CHANNEL, {
          name: 'syncre',
          importance: Notifications.AndroidImportance.MAX,
          showBadge: true,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2C82FF',
        });
      }

      if (!Device.isDevice) {
        console.warn('Push notifications are not supported on simulators');
        return;
      }

      const isExpoGo = Constants.executionEnvironment === 'storeClient';
      if (isExpoGo) {
        console.warn(
          'Expo Go (SDK 53+) does not support remote push notifications — build a development client to test pushes'
        );
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
      console.log('[PushService] Obtained Expo push token', expoToken);

      const authToken = await StorageService.getAuthToken();
      if (!authToken) {
        console.warn('Cannot register push token — missing auth token');
        return;
      }

      const deviceId = await DeviceService.getOrCreateDeviceId();

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

      const deviceId = await DeviceService.getDeviceId();
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
};
