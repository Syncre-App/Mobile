import { useCallback, useEffect, useState } from 'react';

import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { CryptoService } from '../services/CryptoService';
import { LocationSyncService } from '../services/LocationSyncService';
import { TimezoneService } from '../services/TimezoneService';

export interface AuthUser {
  id: string;
  username?: string;
  email?: string;
  [key: string]: any;
}

interface UseAuthResult {
  user: AuthUser | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = (): UseAuthResult => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserFromStorage = useCallback(async () => {
    const storedUser = await StorageService.getObject<AuthUser>('user_data');
    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      setIsLoading(true);
      TimezoneService.refreshFromDevice();
      await loadUserFromStorage();

      const token = await StorageService.getAuthToken();
      if (!token) {
        setUser(null);
        return;
      }

      const response = await ApiService.get('/user/me', token);
      if (response.success && response.data) {
        setUser(response.data);
        await StorageService.setObject('user_data', response.data);
        try {
          await CryptoService.ensureIdentity();
        } catch (cryptoError) {
          console.error('useAuth: failed to ensure identity keys', cryptoError);
        }
        await LocationSyncService.sync();
      }
    } catch (error) {
      console.error('useAuth: failed to refresh user', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadUserFromStorage]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const signOut = useCallback(async () => {
    await StorageService.removeAuthToken();
    await StorageService.removeItem('user_data');
    setUser(null);
  }, []);

  return {
    user,
    isLoading,
    refreshUser,
    signOut,
  };
};
