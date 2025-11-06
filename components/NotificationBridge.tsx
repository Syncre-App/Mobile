import React, { useEffect } from 'react';
import { notificationService } from '../services/NotificationService';
import { useNotifications } from './NotificationCenter';

const NotificationBridge: React.FC = () => {
  const { push } = useNotifications();

  useEffect(() => {
    notificationService.registerPushHandler(push);
    return () => {
      // unregister
      try {
        notificationService.registerPushHandler(() => {});
      } catch (e) {}
    };
  }, [push]);

  return null;
};

export default NotificationBridge;
