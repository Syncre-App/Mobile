import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useE2EEStore } from '../stores/e2eeStore';
import { secureStorage } from '../services/storage/secure';
import { LoadingSpinner } from '../components/ui';

/**
 * Root Index - Navigation Router
 * 
 * Flow:
 * 1. Not authenticated -> Login
 * 2. Authenticated + has PIN -> PIN Unlock -> Main App
 * 3. Authenticated + no PIN -> Main App (PIN is optional)
 * 
 * Note: E2EE is handled during login with password, not with PIN.
 * PIN is only for local quick unlock (lock screen).
 */
export default function Index() {
  const { isAuthenticated, isLoading, isInitialized } = useAuthStore();
  const { isUnlocked } = useE2EEStore();
  const [checking, setChecking] = useState(true);
  const [hasPin, setHasPin] = useState(false);

  useEffect(() => {
    const checkPinSetup = async () => {
      if (isAuthenticated) {
        const pinExists = await secureStorage.hasPinSetup();
        setHasPin(pinExists);
      }
      setChecking(false);
    };
    
    if (isInitialized) {
      checkPinSetup();
    }
  }, [isInitialized, isAuthenticated]);

  // Still loading
  if (!isInitialized || isLoading || checking) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  // Not authenticated - go to login
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Authenticated but has PIN and E2EE not unlocked yet
  // This happens when app restarts - need to unlock with PIN
  // But wait - E2EE needs password, not PIN...
  // 
  // The correct flow after app restart:
  // - If E2EE is unlocked (cached in memory) -> check PIN -> app
  // - If E2EE is NOT unlocked -> need to re-login with password
  //
  // For now, if hasPin, show PIN unlock. The E2EE state persists in memory during session.
  if (hasPin && !isUnlocked) {
    // Need to re-authenticate to unlock E2EE
    // For better UX, we could cache the encrypted private key and ask for password
    // But for now, redirect to login
    return <Redirect href="/(auth)/login" />;
  }

  if (hasPin) {
    // Has PIN, show PIN unlock screen
    return <Redirect href="/(app)/pin-unlock" />;
  }

  // Authenticated, no PIN - go to main app
  return <Redirect href="/(app)/(tabs)" />;
}
