import React from 'react';
import NotificationBridge from '../components/NotificationBridge';
import { NotificationProvider } from '../components/NotificationCenter';
import { LoginScreen } from '../screens/LoginScreen';

export default function Index() {
  return (
    <NotificationProvider>
      <NotificationBridge />
      <LoginScreen />
    </NotificationProvider>
  );
}