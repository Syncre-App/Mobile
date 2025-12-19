import React, { useEffect } from 'react';
import { notificationService } from '../services/NotificationService';
import { useNotifications } from './NotificationCenter';

export const NotificationBridge: React.FC = () => {
  const { push } = useNotifications();

  useEffect(() => {
    notificationService.registerPushHandler(push);
    return () => {
      notificationService.registerPushHandler(() => {});
    };
  }, [push]);

  return null;
};

export default NotificationBridge;
