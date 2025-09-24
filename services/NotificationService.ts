import { Alert, Platform, ToastAndroid } from 'react-native';
// small uid helper to avoid adding a dependency
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

// Lightweight NotificationService: will call native fallback or rely on an external provider
export class NotificationService {
  private static instance: NotificationService;
  private pushHandler: ((n: { id: string; type: string; title?: string; message: string }) => void) | null = null;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  registerPushHandler(fn: (n: { id: string; type: string; title?: string; message: string }) => void) {
    this.pushHandler = fn;
  }

  show(type: NotificationType | string, message: string, title?: string) {
    const t = typeof type === 'string' ? (type as NotificationType) : type;
  const payload = { id: uid(), type: t, title, message };

    if (this.pushHandler) {
      try {
        this.pushHandler(payload);
        return;
      } catch (e) {
        // fallthrough to fallback
      }
    }

    // Fallback behavior: native short toast on Android, Alert on others
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert(title || this.getDefaultTitle(t as NotificationType), message);
    }
  }

  showAlert(title: string, message: string, buttons?: any[]) {
    if (this.pushHandler) {
      this.pushHandler({ id: uid(), type: NotificationType.INFO, title, message });
      return;
    }
    Alert.alert(title, message, buttons);
  }

  // Static helpers for backward-compatibility
  static show(type: NotificationType | string, message: string, title?: string) {
    NotificationService.getInstance().show(type, message, title);
  }

  static showAlert(title: string, message: string, buttons?: any[]) {
    NotificationService.getInstance().showAlert(title, message, buttons);
  }

  private getDefaultTitle(type: NotificationType): string {
    switch (type) {
      case NotificationType.SUCCESS:
        return 'Success';
      case NotificationType.ERROR:
        return 'Error';
      case NotificationType.WARNING:
        return 'Warning';
      case NotificationType.INFO:
        return 'Info';
      default:
        return 'Notification';
    }
  }
}

export const notificationService = NotificationService.getInstance();

