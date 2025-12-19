import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../theme/designSystem';
import { NotificationProvider } from '../components/NotificationCenter';
import NotificationBridge from '../components/NotificationBridge';
import { ShareIntentService } from '../services/ShareIntentService';

const RootLayoutContent = () => {
  const router = useRouter();
  const { theme } = useTheme();

  const extractChatIdFromNotification = (response: Notifications.NotificationResponse | null) => {
    const data = response?.notification?.request?.content?.data as any;
    return data?.chatId || data?.chat_id || data?.chatID || null;
  };

  const extractWrapDateFromNotification = (response: Notifications.NotificationResponse | null) => {
    const data = response?.notification?.request?.content?.data as any;
    if (!data || data?.type !== 'daily_wrap') return null;
    return data?.date || data?.day || null;
  };

  useEffect(() => {
    const handleIncomingUrl = (url?: string | null) => {
      if (!url) return false;
      if (ShareIntentService.handleIncomingUrl(url)) {
        router.replace('/share');
        return true;
      }
      try {
        const parsed = Linking.parse(url);
        const path = (parsed?.path || '').replace(/^\//, '').toLowerCase();
        if (path.startsWith('spotify/callback')) {
          const params = parsed?.queryParams || {};
          router.replace({
            pathname: '/spotify/callback',
            params,
          } as any);
          return true;
        }
        if (path.startsWith('reset')) {
          const params = parsed?.queryParams || {};
          router.replace({
            pathname: '/reset',
            params: {
              email: (params.email as string) || '',
              token: (params.token as string) || (params.t as string) || '',
              code: (params.code as string) || (params.c as string) || '',
            },
          } as any);
          return true;
        }
      } catch {
        return false;
      }
      return false;
    };

    ShareIntentService.init();
    const shareSub = ShareIntentService.subscribe((payload) => {
      if (payload) router.replace('/share');
    });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        const chatId = extractChatIdFromNotification(response);
        const wrapDate = extractWrapDateFromNotification(response);
        if (wrapDate) {
          router.replace(`/wrap/${wrapDate}` as any);
        } else if (chatId) {
          router.replace(`/chat/${chatId}` as any);
        }
      })
      .catch(() => {});

    const linkingSub = Linking.addEventListener('url', (event) => {
      handleIncomingUrl(event.url);
    });

    Linking.getInitialURL()
      .then((url) => handleIncomingUrl(url))
      .catch(() => {});

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const chatId = extractChatIdFromNotification(response);
      const wrapDate = extractWrapDateFromNotification(response);
      if (wrapDate) {
        router.push(`/wrap/${wrapDate}` as any);
      } else if (chatId) {
        router.push(`/chat/${chatId}` as any);
      }
    });

    return () => {
      shareSub();
      linkingSub.remove();
      responseSub.remove();
    };
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.palette.background }}>
      <SafeAreaProvider>
        <NotificationProvider>
          <NotificationBridge />
          <StatusBar style={theme.isDark ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              gestureEnabled: true,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: theme.palette.background },
            }}
          />
        </NotificationProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}
