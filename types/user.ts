export interface User {
  id: string;
  username: string;
  email: string;
  profile_picture: string | null;
  created_at: string;
  status: 'online' | 'offline' | 'idle';
  last_seen: string | null;
  role: 'user' | 'bot';
  badges: string[];
  terms_accepted_at: string | null;
}

export interface AuthUser extends User {
  banned: boolean;
  banned_time: string | null;
  delete_requested_at: string | null;
  delete_scheduled_for: string | null;
  activeDeviceId?: string; // Current device ID for E2EE and WebSocket
}

export interface Friend {
  id: string;
  username: string;
  profile_picture: string | null;
  status: 'online' | 'offline' | 'idle';
  last_seen: string | null;
}

export interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  user: {
    id: string;
    username: string;
    profile_picture: string | null;
  };
}

export interface BlockedUser {
  id: string;
  username: string;
  profile_picture: string | null;
  blocked_at: string;
}

export interface UserSearchResult {
  id: string;
  username: string;
  profile_picture: string | null;
  status: string | null;
  last_seen: string | null;
  created_at: string;
  badges: string[];
  friendship_status: 'friend' | 'pending_outgoing' | 'pending_incoming' | 'available';
  // Computed properties for convenience
  isFriend?: boolean;
  isPending?: boolean;
}
