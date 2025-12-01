import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
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

  const checkMaintenance = async () => {
    const maintenanceFlag = isMaintenanceEnabled();
    if (maintenanceFlag) {
      setMaintenance(true);
      router.replace('/maintenance');
      return;
    }

    try {
      const apiStatus = await ApiService.get('/health');
      if (!apiStatus.success) {
        setMaintenance(true);
        router.replace('/maintenance');
        return;
      }

      const updateStatus = await UpdateService.checkForMandatoryUpdate();
      if (updateStatus.requiresUpdate) {
        setMaintenance(false);
        router.replace('/update');
        return;
      }

      const token = await StorageService.getAuthToken();
      if (token) {
        const needsIdentitySetup = await IdentityService.requiresBootstrap(token);
        const hasLocalIdentity = Boolean(await CryptoService.getStoredIdentity());

        if (needsIdentitySetup) {
          setMaintenance(false);
          router.replace('/identity?mode=setup');
          return;
        }

        if (!hasLocalIdentity) {
          setMaintenance(false);
          router.replace('/identity?mode=unlock');
          return;
        }

        setMaintenance(false);
        router.replace('/home');
        return;
      }

      setMaintenance(false);
      router.replace('/');
    } catch {
      setMaintenance(true);
      router.replace('/maintenance');
    }
  };

  useEffect(() => {
    checkMaintenance();
  }, []);

  useEffect(() => {
    // Handle notification taps -> navigate to the target chat
    const handleNotificationResponse = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification?.request?.content?.data as any;
      const chatId = data?.chatId || data?.chat_id || data?.chatID;
      if (chatId) {
        router.push(`/chat/${chatId}`);
      }
    };

    Notifications.getLastNotificationResponseAsync()
      .then(handleNotificationResponse)
      .catch(() => {});

    const responseSub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => {
      responseSub.remove();
    };
  }, [router]);

  useEffect(() => {
    ShareIntentService.init();

    const unsubscribeShare = ShareIntentService.subscribe((payload) => {
      if (payload) router.replace('/share');
    });

    const linkingSub = Linking.addEventListener('url', (event) => {
      if (ShareIntentService.handleIncomingUrl(event.url)) router.replace('/share');
    });

    Linking.getInitialURL().then((url) => {
      if (ShareIntentService.handleIncomingUrl(url)) router.replace('/share');
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
          initialRouteName="index"
          screenOptions={{
            headerShown: false as boolean,
            gestureEnabled: true as boolean,
            contentStyle: undefined,
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
