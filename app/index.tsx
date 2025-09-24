import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import NotificationBridge from '../components/NotificationBridge';
import { NotificationProvider } from '../components/NotificationCenter';
import { LoginScreen } from '../screens/LoginScreen';

export default function Index() {
  return (
    <NotificationProvider>
      <NotificationBridge />
      <LinearGradient colors={['#03040A', '#071026']} style={{ flex: 1 }}>
        <LoginScreen />
      </LinearGradient>
    </NotificationProvider>
  );
}