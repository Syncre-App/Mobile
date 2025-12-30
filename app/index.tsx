import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useE2EEStore } from '../stores/e2eeStore';
import { secureStorage } from '../services/storage/secure';
import { LoadingSpinner } from '../components/ui';

export default function Index() {
  const { isAuthenticated, isLoading, isInitialized, token } = useAuthStore();
  const { isUnlocked } = useE2EEStore();
  const [checkingPin, setCheckingPin] = useState(true);
  const [hasPin, setHasPin] = useState(false);

  useEffect(() => {
    const checkPin = async () => {
      if (isAuthenticated && token) {
        const pinExists = await secureStorage.hasPinSetup();
        setHasPin(pinExists);
      }
      setCheckingPin(false);
    };
    
    if (isInitialized) {
      checkPin();
    }
  }, [isInitialized, isAuthenticated, token]);

  // Still loading
  if (!isInitialized || isLoading || checkingPin) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  // Not authenticated - go to login
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Authenticated but E2EE not unlocked
  if (!isUnlocked) {
    if (hasPin) {
      // Has PIN, need to unlock
      return <Redirect href="/(app)/pin-unlock" />;
    } else {
      // No PIN, need to set up
      return <Redirect href="/(auth)/pin-setup" />;
    }
  }

  // Authenticated and E2EE unlocked - go to main app
  return <Redirect href="/(app)/(tabs)" />;
}
