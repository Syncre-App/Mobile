import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import CallKeep from 'react-native-callkeep';
import { callService } from './CallService';

class VoIPPushService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (Platform.OS === 'ios') {
        await this.setupIOSVoIPPush();
      } else if (Platform.OS === 'android') {
        await this.setupAndroidPush();
      }

      this.isInitialized = true;
      console.log('[VoIPPush] Initialized successfully');
    } catch (error) {
      console.error('[VoIPPush] Failed to initialize:', error);
    }
  }

  private async setupIOSVoIPPush(): Promise<void> {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    Notifications.addNotificationReceivedListener((notification) => {
      console.log('[VoIPPush] Notification received:', notification);
      this.handleIncomingCallNotification(notification.request.content.data);
    });
  }

  private async setupAndroidPush(): Promise<void> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[VoIPPush] Permission not granted');
      return;
    }

    await Notifications.setNotificationChannelAsync('incoming-calls', {
      name: 'Incoming Calls',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableVibrate: true,
      showBadge: false,
    });

    Notifications.addNotificationReceivedListener((notification) => {
      console.log('[VoIPPush] Notification received:', notification);
      this.handleIncomingCallNotification(notification.request.content.data);
    });
  }

  private async handleIncomingCallNotification(data: any): Promise<void> {
    if (!data || data.type !== 'incoming_call') return;

    const { callId, callerName, callType } = data;

    try {
      if (Platform.OS === 'ios') {
        CallKeep.displayIncomingCall(
          callId,
          callerName || 'Syncre',
          callerName || 'Unknown',
          'generic',
          callType === 'video'
        );
      } else if (Platform.OS === 'android') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: callerName || 'Incoming Call',
            body: callType === 'video' ? 'Video call incoming...' : 'Voice call incoming...',
            data: { callId, type: 'incoming_call', callType },
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
          },
          trigger: null,
        });
      }
    } catch (error) {
      console.error('[VoIPPush] Error displaying incoming call:', error);
    }
  }

  async sendVoIPPushNotification(
    recipientId: string,
    callId: string,
    callerName: string,
    callType: 'audio' | 'video'
  ): Promise<boolean> {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipientId,
          data: {
            type: 'incoming_call',
            callId,
            callerName,
            callType,
          },
          title: callerName,
          body: callType === 'video' ? 'Video call incoming...' : 'Voice call incoming...',
          sound: 'default',
          priority: 'high',
          channelId: 'incoming-calls',
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('[VoIPPush] Error sending push:', error);
      return false;
    }
  }

  async scheduleLocalNotification(
    title: string,
    body: string,
    data: any,
    delayMs: number = 0
  ): Promise<string | null> {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title, body, data, sound: 'default' },
      } as any);
      return id;
    } catch (error) {
      console.error('[VoIPPush] Error scheduling notification:', error);
      return null;
    }
  }

  cancelAllNotifications(): void {
    Notifications.cancelAllScheduledNotificationsAsync();
  }

  async getDevicePushToken(): Promise<string | null> {
    try {
      const { data } = await Notifications.getDevicePushTokenAsync();
      return data;
    } catch (error) {
      console.error('[VoIPPush] Error getting device push token:', error);
      return null;
    }
  }
}

export const voipPushService = new VoIPPushService();
export default voipPushService;
