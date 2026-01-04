import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import NotificationBridge from '../components/NotificationBridge';
import { NotificationProvider } from '../components/NotificationCenter';
import { AppBackground } from '../components/AppBackground';
import { LoginScreen } from '../screens/LoginScreen';
import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { CryptoService } from '../services/CryptoService';
import { palette } from '../theme/designSystem';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const validateTokenAndNavigate = useCallback(async () => {
    setIsLoading(true);
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
        await StorageService.setObject('user_data', response.data);
        if (response.data?.requires_terms_acceptance || !response.data?.terms_accepted_at) {
          console.log('⚖️ Terms require re-acceptance - navigating to terms');
          setIsAuthenticated(true);
          router.replace('/terms' as any);
          return;
        }
        
        // Check if we have local identity - if not, user needs to re-login
        // (password is needed to decrypt identity from server)
        const hasLocalIdentity = await CryptoService.hasLocalIdentity();
        if (!hasLocalIdentity) {
          console.log('🔑 No local identity - user needs to re-login');
          await StorageService.removeAuthToken();
          await StorageService.removeItem('user_data');
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }
        
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
        setIsLoading(false);
      }
    } catch (error) {
      console.error('❌ Error validating token:', error);
      // On error, clear token and show login
      await StorageService.removeAuthToken();
      await StorageService.removeItem('user_data');
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  }, []);

  // Re-validate when screen comes into focus (e.g., after logout)
  useFocusEffect(
    useCallback(() => {
      validateTokenAndNavigate();
    }, [validateTokenAndNavigate])
  );

  if (isLoading) {
    return (
      <NotificationProvider>
        <NotificationBridge />
        <View style={{ flex: 1, backgroundColor: palette.background }}>
          <AppBackground />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={palette.accent} />
          </View>
        </View>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <NotificationBridge />
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        <AppBackground />
        <LoginScreen />
      </View>
    </NotificationProvider>
  );
}
