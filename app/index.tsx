import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import NotificationBridge from '../components/NotificationBridge';
import { NotificationProvider } from '../components/NotificationCenter';
import { LoginScreen } from '../screens/LoginScreen';
import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    validateTokenAndNavigate();
  }, []);

  const validateTokenAndNavigate = async () => {
    try {
      console.log('🔍 Checking for existing token...');
      const token = await StorageService.getAuthToken();
      
      if (!token) {
        console.log('❌ No token found - show login');
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      console.log('✅ Token found - validating...');
      // Test the token by making a simple API call
      const response = await ApiService.get('/user/me', token);
      
      if (response.success) {
        console.log('✅ Token is valid - navigating to home');
        // Token is valid, navigate to home screen
        setIsAuthenticated(true);
        router.replace('/home' as any);
      } else {
        console.log('❌ Token is invalid - clearing and show login');
        // Token is invalid, clear it and show login
        await StorageService.removeAuthToken();
        await StorageService.removeItem('user_data');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('❌ Error validating token:', error);
      // On error, clear token and show login
      await StorageService.removeAuthToken();
      await StorageService.removeItem('user_data');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <NotificationProvider>
        <NotificationBridge />
        <LinearGradient colors={['#03040A', '#071026']} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#2C82FF" />
          </View>
        </LinearGradient>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <NotificationBridge />
      <LinearGradient colors={['#03040A', '#071026']} style={{ flex: 1 }}>
        <LoginScreen />
      </LinearGradient>
    </NotificationProvider>
  );
}