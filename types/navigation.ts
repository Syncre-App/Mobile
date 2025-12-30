// Route params for type-safe navigation

export type AuthStackParamList = {
  login: undefined;
  register: undefined;
  verify: { email: string };
  'forgot-password': { step?: 'request' | 'verify' | 'complete' };
};

export type AppStackParamList = {
  '(tabs)': undefined;
  unlock: undefined;
  'chat/[id]': { id: string };
  'new-chat': undefined;
  'new-group': undefined;
  'profile/[id]': { id: string };
  'settings/edit-profile': undefined;
  'settings/blocked': undefined;
  'settings/devices': undefined;
  'settings/security': undefined;
};

export type TabParamList = {
  index: undefined;      // Chats
  friends: undefined;    // Friends
  settings: undefined;   // Settings
};

// Chat screen params
export interface ChatScreenParams {
  id: string;
  name?: string;
}

// Profile screen params
export interface ProfileScreenParams {
  id: string;
}

// Verify screen params
export interface VerifyScreenParams {
  email: string;
}
