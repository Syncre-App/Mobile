// Generic API response types
export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  error?: string;
}

export interface ApiError {
  message: string;
  status: number;
  error?: string;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    terms_accepted_at: string | null;
  };
  banned_until: string | null;
  requires_terms_acceptance: boolean;
  delete_after: string | null;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  acceptedTerms: boolean;
}

export interface RegisterResponse {
  message: string;
}

export interface VerifyRequest {
  email: string;
  code: string;
}

export interface VerifyResponse {
  message: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
}

export interface PasswordResetRequestBody {
  email: string;
}

export interface PasswordResetRequestResponse {
  message: string;
  expires_at: string;
  resetToken: string;
}

export interface PasswordResetVerifyRequest {
  email: string;
  code: string;
  token: string;
}

export interface PasswordResetCompleteRequest {
  email: string;
  code: string;
  token: string;
  newPassword: string;
}

// Identity key types
export interface IdentityKey {
  userId: string;
  publicKey: string;
  encryptedPrivateKey: string;
  nonce: string;
  salt: string;
  iterations: number;
  version: number;
  updatedAt: string;
}

export interface RegisterIdentityKeyRequest {
  publicKey: string;
  encryptedPrivateKey: string;
  nonce: string;
  salt: string;
  iterations?: number;
  version?: number;
}

export interface DeviceKey {
  deviceId: string;
  identityKey: string; // Public identity key (base64)
  keyVersion: number;
  revoked?: boolean;
  lastSeen?: string;
  createdAt?: string;
}

export interface RegisterDeviceKeyRequest {
  deviceId: string;
  identityKey: string;
  keyVersion?: number;
}

// Push notification types
export interface PushRegisterRequest {
  deviceId: string;
  expoToken: string;
  platform?: 'ios' | 'android';
}

// Friend types
export interface FriendsResponse {
  friends: Array<{
    id: string;
    username: string;
    profile_picture: string | null;
    status: 'online' | 'offline' | 'idle';
    last_seen: string | null;
  }>;
  pending: {
    incoming: Array<{
      id: string;
      from_user_id: string;
      user: {
        id: string;
        username: string;
        profile_picture: string | null;
      };
      created_at: string;
    }>;
    outgoing: Array<{
      id: string;
      to_user_id: string;
      user: {
        id: string;
        username: string;
        profile_picture: string | null;
      };
      created_at: string;
    }>;
  };
}

// Chat types
export interface ChatListResponse {
  chats: Array<{
    id: number;
    users: string;
    userIds: string[];
    participants: Array<{
      id: string;
      username: string;
      profile_picture: string | null;
    }>;
    participantCount: number;
    isGroup: boolean;
    ownerId: string | null;
    name: string | null;
    displayName: string;
    avatarUrl: string | null;
    created_at: string;
    updated_at: string;
  }>;
}

export interface MessagesResponse {
  messages: Array<import('./chat').Message>;
  hasMore: boolean;
  nextCursor: string | null;
  timezone: string;
}

// File upload types
export interface AttachmentUploadResponse {
  id: number;
  name: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: string;
}

export interface ChunkedUploadStartResponse {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
}
