import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useE2EEStore } from '../stores/e2eeStore';
import { keysApi } from '../services/api';
import { LoadingSpinner } from '../components/ui';

export default function Index() {
  const { isAuthenticated, isLoading, isInitialized, token } = useAuthStore();
  const { isUnlocked } = useE2EEStore();
  const [checkingIdentity, setCheckingIdentity] = useState(true);
  const [hasIdentityKey, setHasIdentityKey] = useState(false);

  useEffect(() => {
    const checkIdentityKey = async () => {
      if (isAuthenticated && token) {
        try {
          // Check if user has identity key on server
          await keysApi.getIdentityKey();
          setHasIdentityKey(true);
        } catch (error: any) {
          // 404 means no identity key exists
          setHasIdentityKey(error.status !== 404);
        }
      }
      setCheckingIdentity(false);
    };
    
    if (isInitialized) {
      checkIdentityKey();
    }
  }, [isInitialized, isAuthenticated, token]);

  // Still loading
  if (!isInitialized || isLoading || checkingIdentity) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  // Not authenticated - go to login
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Authenticated but E2EE not unlocked
  if (!isUnlocked) {
    if (hasIdentityKey) {
      // Has identity key on server, need to unlock with PIN
      return <Redirect href="/(app)/pin-unlock" />;
    } else {
      // No identity key, need to set up PIN and create new key
      return <Redirect href="/(auth)/pin-setup" />;
    }
  }

  // Authenticated and E2EE unlocked - go to main app
  return <Redirect href="/(app)/(tabs)" />;
}
