import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { ApiService } from '../services/ApiService';
import Constants from 'expo-constants';
import { UpdateService } from '../services/UpdateService';
import { IdentityService } from '../services/IdentityService';
import { StorageService } from '../services/StorageService';

export default function RootLayout() {
  const [maintenance, setMaintenance] = useState(true);

  useEffect(() => {
    const checkMaintenance = async () => {
      if (Constants.expoConfig?.extra?.maintenance) {
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
          router.replace('/update');
          return;
        }

        const token = await StorageService.getAuthToken();
        if (token) {
          const needsIdentitySetup = await IdentityService.requiresBootstrap(token);
          const mode = needsIdentitySetup ? 'setup' : 'unlock';
          setMaintenance(false);
          router.replace(`/identity?mode=${mode}`);
          return;
        }

        setMaintenance(false);
        router.replace('/');
      } catch (error) {
        setMaintenance(true);
        router.replace('/maintenance');
        return;
      }
    };

    checkMaintenance();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#03040A' }}>
      <StatusBar style="light" backgroundColor="#03040A" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#03040A' },
        }}
      />
    </GestureHandlerRootView>
  );
}
