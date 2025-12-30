import { create } from 'zustand';
import { AuthUser } from '../types/user';
import { apiClient, authApi } from '../services/api';
import { secureStorage } from '../services/storage/secure';
import { LoginRequest, RegisterRequest } from '../types/api';

interface AuthState {
  // State
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  needsUnlock: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  login: (data: LoginRequest) => Promise<{ success: boolean; verified?: boolean; error?: string }>;
  register: (data: RegisterRequest) => Promise<{ success: boolean; error?: string }>;
  verify: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setNeedsUnlock: (value: boolean) => void;
  clearError: () => void;
  setToken: (token: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  needsUnlock: false,
  error: null,

  // Initialize auth state from secure storage
  initialize: async () => {
    try {
      set({ isLoading: true });

      const token = await secureStorage.getAuthToken();
      const userData = await secureStorage.getUserData<AuthUser>();
      const biometricEnabled = await secureStorage.isBiometricEnabled();

      if (token && userData) {
        apiClient.setAuthToken(token);

        // Check if biometric unlock is needed
        if (biometricEnabled) {
          set({
            token,
            user: userData,
            isAuthenticated: false, // Not fully authenticated until unlocked
            needsUnlock: true,
            isInitialized: true,
            isLoading: false,
          });
        } else {
          // Verify token is still valid
          try {
            const freshUser = await authApi.getCurrentUser();
            await secureStorage.setUserData(freshUser);
            set({
              token,
              user: freshUser,
              isAuthenticated: true,
              needsUnlock: false,
              isInitialized: true,
              isLoading: false,
            });
          } catch (error: any) {
            // Token invalid, clear storage
            await secureStorage.clearAuthData();
            apiClient.setAuthToken(null);
            set({
              token: null,
              user: null,
              isAuthenticated: false,
              needsUnlock: false,
              isInitialized: true,
              isLoading: false,
            });
          }
        }
      } else {
        set({
          isInitialized: true,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({
        isInitialized: true,
        isLoading: false,
        error: 'Failed to initialize auth',
      });
    }
  },

  // Login
  login: async (data: LoginRequest) => {
    try {
      set({ isLoading: true, error: null });

      const response = await authApi.login(data);

      // Store token and user data
      await secureStorage.setAuthToken(response.token);
      
      // Get full user data
      apiClient.setAuthToken(response.token);
      const fullUser = await authApi.getCurrentUser();
      await secureStorage.setUserData(fullUser);

      set({
        token: response.token,
        user: fullUser,
        isAuthenticated: true,
        isLoading: false,
        needsUnlock: false,
      });

      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      
      // Check if user is not verified
      if (error.status === 403 && error.message?.includes('not verified')) {
        set({ isLoading: false, error: errorMessage });
        return { success: false, verified: false, error: errorMessage };
      }

      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  // Register
  register: async (data: RegisterRequest) => {
    try {
      set({ isLoading: true, error: null });

      await authApi.register(data);

      set({ isLoading: false });
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  // Verify email
  verify: async (email: string, code: string) => {
    try {
      set({ isLoading: true, error: null });

      await authApi.verify({ email, code });

      set({ isLoading: false });
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || 'Verification failed';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  // Logout
  logout: async () => {
    try {
      set({ isLoading: true });

      // Clear all stored data
      await secureStorage.clearAuthData();
      apiClient.setAuthToken(null);

      set({
        user: null,
        token: null,
        isAuthenticated: false,
        needsUnlock: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Logout error:', error);
      set({ isLoading: false });
    }
  },

  // Refresh user data
  refreshUser: async () => {
    try {
      const { token } = get();
      if (!token) return;

      const freshUser = await authApi.getCurrentUser();
      await secureStorage.setUserData(freshUser);
      set({ user: freshUser });
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  },

  // Set needs unlock (after biometric setup)
  setNeedsUnlock: (value: boolean) => {
    set({ needsUnlock: value });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Set token (used after biometric unlock)
  setToken: async (token: string) => {
    apiClient.setAuthToken(token);
    
    try {
      const user = await authApi.getCurrentUser();
      await secureStorage.setUserData(user);
      
      set({
        token,
        user,
        isAuthenticated: true,
        needsUnlock: false,
      });
    } catch (error) {
      console.error('Set token error:', error);
      throw error;
    }
  },
}));
