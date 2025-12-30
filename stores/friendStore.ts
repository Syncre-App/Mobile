import { create } from 'zustand';
import { Friend, FriendRequest, UserSearchResult } from '../types/user';
import { userApi } from '../services/api';

interface PendingRequests {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

interface FriendState {
  // State
  friends: Friend[];
  pending: PendingRequests;
  searchResults: UserSearchResult[];
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;

  // Actions
  fetchFriends: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  clearSearchResults: () => void;
  addFriend: (friendId: string) => Promise<{ success: boolean; error?: string }>;
  removeFriend: (friendId: string) => Promise<{ success: boolean; error?: string }>;
  acceptRequest: (friendId: string) => Promise<{ success: boolean; error?: string }>;
  rejectRequest: (friendId: string) => Promise<{ success: boolean; error?: string }>;
  updateFriendStatus: (friendId: string, status: 'online' | 'offline' | 'idle') => void;
  clearError: () => void;
  reset: () => void;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  // Initial state
  friends: [],
  pending: {
    incoming: [],
    outgoing: [],
  },
  searchResults: [],
  isLoading: false,
  isSearching: false,
  error: null,

  // Fetch friends and pending requests
  fetchFriends: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const response = await userApi.getFriends();
      
      set({
        friends: response.friends.map(f => ({
          id: f.id,
          username: f.username,
          profile_picture: f.profile_picture,
          status: f.status,
          last_seen: f.last_seen,
        })),
        pending: {
          incoming: response.pending.incoming.map(p => ({
            id: p.id,
            from_user_id: p.from_user_id,
            to_user_id: '', // Not provided in response
            status: 'pending' as const,
            created_at: p.created_at,
            user: p.user,
          })),
          outgoing: response.pending.outgoing.map(p => ({
            id: p.id,
            from_user_id: '', // Not provided in response
            to_user_id: p.to_user_id,
            status: 'pending' as const,
            created_at: p.created_at,
            user: p.user,
          })),
        },
        isLoading: false,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to fetch friends',
      });
    }
  },

  // Search for users
  searchUsers: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }

    try {
      set({ isSearching: true });
      const results = await userApi.searchUsers(query);
      set({ searchResults: results, isSearching: false });
    } catch (error: any) {
      set({
        isSearching: false,
        error: error.message || 'Search failed',
      });
    }
  },

  // Clear search results
  clearSearchResults: () => {
    set({ searchResults: [] });
  },

  // Send friend request
  addFriend: async (friendId: string) => {
    try {
      set({ isLoading: true, error: null });
      await userApi.addFriend(friendId);
      
      // Refresh friends list
      await get().fetchFriends();
      
      return { success: true };
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      return { success: false, error: error.message };
    }
  },

  // Remove friend
  removeFriend: async (friendId: string) => {
    try {
      set({ isLoading: true, error: null });
      await userApi.removeFriend(friendId);
      
      // Update local state
      set(state => ({
        friends: state.friends.filter(f => f.id !== friendId),
        isLoading: false,
      }));
      
      return { success: true };
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      return { success: false, error: error.message };
    }
  },

  // Accept friend request
  acceptRequest: async (friendId: string) => {
    try {
      set({ isLoading: true, error: null });
      await userApi.respondFriendRequest(friendId, 'accept');
      
      // Refresh friends list
      await get().fetchFriends();
      
      return { success: true };
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      return { success: false, error: error.message };
    }
  },

  // Reject friend request
  rejectRequest: async (friendId: string) => {
    try {
      set({ isLoading: true, error: null });
      await userApi.respondFriendRequest(friendId, 'reject');
      
      // Update local state
      set(state => ({
        pending: {
          ...state.pending,
          incoming: state.pending.incoming.filter(r => r.from_user_id !== friendId),
        },
        isLoading: false,
      }));
      
      return { success: true };
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      return { success: false, error: error.message };
    }
  },

  // Update friend's online status
  updateFriendStatus: (friendId: string, status: 'online' | 'offline' | 'idle') => {
    set(state => ({
      friends: state.friends.map(f =>
        f.id === friendId ? { ...f, status } : f
      ),
    }));
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Reset store
  reset: () => {
    set({
      friends: [],
      pending: { incoming: [], outgoing: [] },
      searchResults: [],
      isLoading: false,
      isSearching: false,
      error: null,
    });
  },
}));
