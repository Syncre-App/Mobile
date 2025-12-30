// API Configuration
export const API_CONFIG = {
  // Production
  BASE_URL: 'https://api.syncre.xyz/v1',
  WS_URL: 'wss://api.syncre.xyz/ws',
  
  // Development (uncomment for local testing)
  // BASE_URL: 'http://localhost:6999/v1',
  // WS_URL: 'ws://localhost:6999/ws',
  
  // Timeouts
  REQUEST_TIMEOUT: 30000, // 30 seconds
  WS_AUTH_TIMEOUT: 5000,  // 5 seconds to authenticate
  WS_RECONNECT_DELAY: 3000, // 3 seconds
  WS_MAX_RECONNECT_ATTEMPTS: 5,
  
  // File upload limits
  MAX_DIRECT_UPLOAD_SIZE: 95 * 1024 * 1024, // 95 MB
  MAX_TOTAL_UPLOAD_SIZE: 1024 * 1024 * 1024, // 1 GB
  CHUNK_SIZE: 80 * 1024 * 1024, // 80 MB
} as const;

// App Configuration
export const APP_CONFIG = {
  // App info
  APP_NAME: 'Syncre',
  APP_VERSION: '1.0.0',
  
  // Message caching
  MESSAGE_CACHE_LIMIT: 20, // Last 20 messages per chat
  
  // Security
  PBKDF2_ITERATIONS: 150000,
  AUTH_TOKEN_KEY: 'auth_token',
  USER_DATA_KEY: 'user_data',
  BIOMETRIC_ENABLED_KEY: 'biometric_enabled',
  ENCRYPTED_PASSWORD_KEY: 'encrypted_password',
  DEVICE_ID_KEY: 'device_id',
  
  // Typing indicator
  TYPING_DEBOUNCE_MS: 500,
  TYPING_TIMEOUT_MS: 3000,
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Verification
  VERIFICATION_CODE_LENGTH: 6,
  VERIFICATION_RESEND_COOLDOWN: 60, // seconds
} as const;

// External URLs
export const EXTERNAL_URLS = {
  TERMS_OF_SERVICE: 'https://syncre.xyz/terms',
  PRIVACY_POLICY: 'https://syncre.xyz/privacy',
  SUPPORT: 'https://syncre.xyz/support',
} as const;
