import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { wsClient } from '../services/websocket/client';
import { Colors } from '../constants/colors';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
  
  const { initialize, isInitialized, isAuthenticated, token } = useAuthStore();

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

  // WebSocket connection management
  useEffect(() => {
    if (isAuthenticated && token) {
      // Connect WebSocket when authenticated
      wsClient.connect(token).catch((error) => {
        console.error('WebSocket connection failed:', error);
      });
    } else {
      // Disconnect when not authenticated
      wsClient.disconnect();
    }

    return () => {
      wsClient.disconnect();
    };
  }, [isAuthenticated, token]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAuthenticated && token) {
        // Reconnect WebSocket when app comes to foreground
        if (!wsClient.isReady()) {
          wsClient.connect(token).catch((error) => {
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
