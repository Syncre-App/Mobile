import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useE2EEStore } from '../stores/e2eeStore';
import { wsClient } from '../services/websocket/client';
import { setupReencryptListener } from '../services/crypto';
import { Colors } from '../constants/colors';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
  
  const { initialize, isInitialized, isAuthenticated, token, user } = useAuthStore();
  const { initialize: initializeE2EE, registerDevice, isUnlocked } = useE2EEStore();
  const reencryptUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await initialize();
      } catch (error) {
        console.error('Failed to initialize:', error);
      } finally {
        await SplashScreen.hideAsync();
      }
    };

    init();
  }, []);

  // Initialize E2EE when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      initializeE2EE().catch((error) => {
        console.error('E2EE initialization failed:', error);
      });
    }
  }, [isAuthenticated, token]);

  // Register device when E2EE is unlocked
  useEffect(() => {
    if (isAuthenticated && isUnlocked && user?.activeDeviceId) {
      registerDevice(user.activeDeviceId).catch((error) => {
        console.error('Device registration failed:', error);
      });
    }
  }, [isAuthenticated, isUnlocked, user?.activeDeviceId]);

  // WebSocket connection management
  useEffect(() => {
    if (isAuthenticated && token) {
      // Connect WebSocket when authenticated
      wsClient.connect(token).then(() => {
        // Setup re-encrypt listener after WebSocket is connected
        if (reencryptUnsubscribeRef.current) {
          reencryptUnsubscribeRef.current();
        }
        reencryptUnsubscribeRef.current = setupReencryptListener();
      }).catch((error) => {
        console.error('WebSocket connection failed:', error);
      });
    } else {
      // Disconnect when not authenticated
      if (reencryptUnsubscribeRef.current) {
        reencryptUnsubscribeRef.current();
        reencryptUnsubscribeRef.current = null;
      }
      wsClient.disconnect();
    }

    return () => {
      if (reencryptUnsubscribeRef.current) {
        reencryptUnsubscribeRef.current();
        reencryptUnsubscribeRef.current = null;
      }
      wsClient.disconnect();
    };
  }, [isAuthenticated, token]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAuthenticated && token) {
        // Reconnect WebSocket when app comes to foreground
        if (!wsClient.isReady()) {
          wsClient.connect(token).then(() => {
            // Re-setup re-encrypt listener
            if (reencryptUnsubscribeRef.current) {
              reencryptUnsubscribeRef.current();
            }
            reencryptUnsubscribeRef.current = setupReencryptListener();
          }).catch((error) => {
            console.error('WebSocket reconnection failed:', error);
          });
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, token]);

  if (!isInitialized) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
