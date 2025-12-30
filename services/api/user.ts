import { apiClient } from './client';
import { AuthUser, BlockedUser, UserSearchResult } from '../../types/user';
import { FriendsResponse } from '../../types/api';

export const userApi = {
  /**
   * Get current user profile
   */
  getMe: async (): Promise<AuthUser> => {
    return apiClient.get<AuthUser>('/user/me');
  },

  /**
   * Get user by ID
   */
  getUser: async (userId: string): Promise<AuthUser> => {
    return apiClient.get<AuthUser>(`/user/${userId}`);
  },

  /**
   * Search for users
   */
  searchUsers: async (query: string): Promise<UserSearchResult[]> => {
    const response = await apiClient.get<{ users: UserSearchResult[] }>(`/user/search?q=${encodeURIComponent(query)}`);
    return response.users || [];
  },

  /**
   * Upload profile picture
   */
  uploadProfilePicture: async (uri: string): Promise<{ profile_picture: string }> => {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'profile.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('profilePicture', {
      uri,
      name: filename,
      type,
    } as any);

    return apiClient.upload<{ profile_picture: string }>('/user/profile-picture', formData);
  },

  /**
   * Update user location
   */
  updateLocation: async (location: { latitude: number; longitude: number }): Promise<{ message: string }> => {
    return apiClient.post('/user/location', { location });
  },

  /**
   * Get friends list and pending requests
   */
  getFriends: async (): Promise<FriendsResponse> => {
    return apiClient.get<FriendsResponse>('/user/friends');
  },

  /**
   * Send friend request
   */
  addFriend: async (friendId: string): Promise<{ message: string }> => {
    return apiClient.post('/user/add-friend', { friendId });
  },

  /**
   * Remove friend
   */
  removeFriend: async (friendId: string): Promise<{ message: string }> => {
    return apiClient.post('/user/remove-friend', { friendId });
  },

  /**
   * Respond to friend request
   */
  respondFriendRequest: async (friendId: string, action: 'accept' | 'reject'): Promise<{ message: string }> => {
    return apiClient.post('/user/respond-friend', { friendId, action });
  },

  /**
   * Block a user
   */
  blockUser: async (targetUserId: string): Promise<{ message: string }> => {
    return apiClient.post('/user/block', { targetUserId });
  },

  /**
   * Unblock a user
   */
  unblockUser: async (targetUserId: string): Promise<{ message: string }> => {
    return apiClient.post('/user/unblock', { targetUserId });
  },

  /**
   * Get blocked users list
   */
  getBlockedUsers: async (): Promise<BlockedUser[]> => {
    const response = await apiClient.get<{ blocked: BlockedUser[] }>('/user/blocked');
    return response.blocked || [];
  },

  /**
   * Report a user
   */
  reportUser: async (data: {
    targetUserId: string;
    reason?: string;
    context?: string;
    messageId?: number;
    messageContent?: string;
  }): Promise<{ message: string }> => {
    return apiClient.post('/user/report', data);
  },

  /**
   * Get notifications
   */
  getNotifications: async (): Promise<any[]> => {
    const response = await apiClient.get<{ notifications: any[] }>('/user/notifications');
    return response.notifications || [];
  },

  /**
   * Mark notifications as read
   */
  markNotificationsRead: async (notificationId?: string): Promise<{ message: string }> => {
    return apiClient.post('/user/notifications/read', { notificationId });
  },
};
