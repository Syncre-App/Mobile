import { apiClient } from './client';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyRequest,
  VerifyResponse,
  PasswordResetRequestBody,
  PasswordResetRequestResponse,
  PasswordResetVerifyRequest,
  PasswordResetCompleteRequest,
} from '../../types/api';
import { AuthUser } from '../../types/user';

export const authApi = {
  /**
   * Login with email and password
   */
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse>('/auth/login', data);
  },

  /**
   * Register a new user
   */
  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    return apiClient.post<RegisterResponse>('/auth/register', data);
  },

  /**
   * Verify email with 6-digit code
   */
  verify: async (data: VerifyRequest): Promise<VerifyResponse> => {
    return apiClient.post<VerifyResponse>('/auth/verify', data);
  },

  /**
   * Request password reset
   */
  requestPasswordReset: async (data: PasswordResetRequestBody): Promise<PasswordResetRequestResponse> => {
    return apiClient.post<PasswordResetRequestResponse>('/auth/password-reset/request', data);
  },

  /**
   * Verify password reset code
   */
  verifyPasswordReset: async (data: PasswordResetVerifyRequest): Promise<{ message: string; expires_at: string }> => {
    return apiClient.post('/auth/password-reset/verify', data);
  },

  /**
   * Complete password reset with new password
   */
  completePasswordReset: async (data: PasswordResetCompleteRequest): Promise<{ message: string; require_login: boolean }> => {
    return apiClient.post('/auth/password-reset/complete', data);
  },

  /**
   * Get current user profile
   */
  getCurrentUser: async (): Promise<AuthUser> => {
    return apiClient.get<AuthUser>('/user/me');
  },

  /**
   * Accept terms of service
   */
  acceptTerms: async (): Promise<{ message: string }> => {
    return apiClient.post('/user/accept-terms');
  },

  /**
   * Request account deletion (24h delay)
   */
  deleteAccount: async (): Promise<{ message: string }> => {
    return apiClient.post('/user/delete-account');
  },
};
