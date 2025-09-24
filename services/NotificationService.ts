import { Alert, ToastAndroid, Platform } from 'react-native';

export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

export class NotificationService {
  private static instance: NotificationService;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  static show(type: NotificationType | string, message: string, title?: string): void {
    const instance = NotificationService.getInstance();
    const notificationType = typeof type === 'string' ? type as NotificationType : type;
    
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      const alertTitle = title || instance.getDefaultTitle(notificationType);
      Alert.alert(alertTitle, message);
    }
  }

  show(type: NotificationType, message: string, title?: string): void {
    NotificationService.show(type, message, title);
  }

  static showAlert(title: string, message: string, buttons?: any[]): void {
    Alert.alert(title, message, buttons);
  }

  showAlert(title: string, message: string, buttons?: any[]): void {
    NotificationService.showAlert(title, message, buttons);
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

// Export singleton instance
export const notificationService = NotificationService.getInstance();
