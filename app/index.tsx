import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { LoadingSpinner } from '../components/ui';

export default function Index() {
  const { isAuthenticated, needsUnlock, isLoading, isInitialized } = useAuthStore();

  // Still loading
  if (!isInitialized || isLoading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  // Not authenticated - go to login
  if (!isAuthenticated && !needsUnlock) {
    return <Redirect href="/(auth)/login" />;
  }

  // Needs biometric unlock
  if (needsUnlock) {
    return <Redirect href="/(app)/unlock" />;
  }

  // Authenticated - go to main app
  return <Redirect href="/(app)/(tabs)" />;
}
