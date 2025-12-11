import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiService } from '../services/ApiService';
import Constants from 'expo-constants';
import { UpdateService } from '../services/UpdateService';
import { IdentityService } from '../services/IdentityService';
import { StorageService } from '../services/StorageService';
import { CryptoService } from '../services/CryptoService';
import { ShareIntentService } from '../services/ShareIntentService';

const isMaintenanceEnabled = (): boolean => {
  const raw = Constants.expoConfig?.extra?.maintenance;
  return raw === true || raw === 'true';
};

export default function RootLayout() {
  const [maintenance, setMaintenance] = useState<boolean>(false);
  const router = useRouter();

  const resolveInitialRoute = useCallback(async () => {
    const maintenanceFlag = isMaintenanceEnabled();
    if (maintenanceFlag) {
      setMaintenance(true);
      return { path: '/maintenance', allowChatNavigation: false };
    }

    try {
      const apiStatus = await ApiService.get('/health');
      if (!apiStatus.success) {
        setMaintenance(true);
        return { path: '/maintenance', allowChatNavigation: false };
      }

      const updateStatus = await UpdateService.checkForMandatoryUpdate();
      if (updateStatus.requiresUpdate) {
        setMaintenance(false);
        return { path: '/update', allowChatNavigation: false };
      }

      const token = await StorageService.getAuthToken();
      if (token) {
        const needsIdentitySetup = await IdentityService.requiresBootstrap(token);
        const hasLocalIdentity = Boolean(await CryptoService.getStoredIdentity());

        if (needsIdentitySetup) {
          setMaintenance(false);
          return { path: '/identity?mode=setup', allowChatNavigation: false };
        }

        if (!hasLocalIdentity) {
          setMaintenance(false);
          return { path: '/identity?mode=unlock', allowChatNavigation: false };
        }

        setMaintenance(false);
        return { path: '/home', allowChatNavigation: true };
      }

      setMaintenance(false);
      return { path: '/', allowChatNavigation: false };
    } catch {
      setMaintenance(true);
      return { path: '/maintenance', allowChatNavigation: false };
    }
  }, []);

  const extractChatIdFromNotification = (response: Notifications.NotificationResponse | null) => {
    const data = response?.notification?.request?.content?.data as any;
    return data?.chatId || data?.chat_id || data?.chatID || null;
  };

  useEffect(() => {
    let mounted = true;

    const bootstrapNavigation = async () => {
      const lastResponse = await Notifications.getLastNotificationResponseAsync().catch(() => null);
      const pendingChatId = extractChatIdFromNotification(lastResponse);
      const initialRoute = await resolveInitialRoute();
      if (!mounted) {
        return;
      }

      if (pendingChatId && initialRoute.allowChatNavigation) {
        router.replace(`/chat/${pendingChatId}`);
      } else {
        router.replace(initialRoute.path as any);
      }
    };

    bootstrapNavigation();

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const chatId = extractChatIdFromNotification(response);
      if (chatId) {
        router.push(`/chat/${chatId}`);
      }
    });

    return () => {
      mounted = false;
      responseSub.remove();
    };
  }, [resolveInitialRoute, router]);

  useEffect(() => {
    ShareIntentService.init();

    const handleIncomingUrl = (url?: string | null) => {
      if (!url) return false;
      if (ShareIntentService.handleIncomingUrl(url)) {
        router.replace('/share');
        return true;
      }
      try {
        const parsed = Linking.parse(url);
        const path = (parsed?.path || '').replace(/^\//, '').toLowerCase();
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
      } catch (err) {
        console.warn('[linking] Failed to parse incoming url', err);
      }
      return false;
    };

    const unsubscribeShare = ShareIntentService.subscribe((payload) => {
      if (payload) router.replace('/share');
    });

    const linkingSub = Linking.addEventListener('url', (event) => {
      if (handleIncomingUrl(event.url)) return;
    });

    Linking.getInitialURL().then((url) => {
      handleIncomingUrl(url);
    }).catch(() => { });

    return () => {
      unsubscribeShare();
      linkingSub.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#03040A' }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#03040A" />
        <Stack
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#03040A' },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="home" />
          <Stack.Screen name="register" />
          <Stack.Screen name="verify" />
          <Stack.Screen name="reset" />
          <Stack.Screen name="terms" />
          <Stack.Screen name="identity" />
          <Stack.Screen name="maintenance" />
          <Stack.Screen name="update" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="group/create" />
          <Stack.Screen name="group/[id]/edit" />
          <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
          <Stack.Screen name="settings/edit-profile" options={{ title: 'Edit Profile' }} />
          <Stack.Screen name="settings/privacy" options={{ title: 'Privacy' }} />
          <Stack.Screen name="settings/blocked-users" options={{ title: 'Blocked Users' }} />
          <Stack.Screen name="share/index" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
