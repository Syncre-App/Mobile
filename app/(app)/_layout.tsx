import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';

export default function AppLayout() {
  const { colors } = useTheme();
  const { isAuthenticated, needsUnlock, isInitialized } = useAuthStore();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (isInitialized && !isAuthenticated && !needsUnlock) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, needsUnlock, isInitialized]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="unlock" options={{ animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen 
        name="chat/[id]" 
        options={{ 
          animation: 'slide_from_right',
          gestureEnabled: true,
        }} 
      />
      <Stack.Screen name="new-chat" options={{ presentation: 'modal' }} />
      <Stack.Screen name="new-group" options={{ presentation: 'modal' }} />
      <Stack.Screen name="profile/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="settings/edit-profile" options={{ presentation: 'modal' }} />
      <Stack.Screen name="settings/blocked" />
      <Stack.Screen name="settings/devices" />
      <Stack.Screen name="settings/security" />
    </Stack>
  );
}
