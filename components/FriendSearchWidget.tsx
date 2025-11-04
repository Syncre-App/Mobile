import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ApiService } from '../services/ApiService';
import { NotificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';
import { TransparentField } from './TransparentField';

interface User {
  id: string;
  username: string;
  profile_picture?: string | null;
  [key: string]: any;
}

interface FriendSearchWidgetProps {
  onFriendUpdated: () => void;
}

export const FriendSearchWidget: React.FC<FriendSearchWidgetProps> = ({
  onFriendUpdated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      console.log('🔍 Searching users with query:', query);
      const token = await StorageService.getAuthToken();
      
      if (!token) {
        console.log('❌ No auth token for search');
        setIsSearching(false);
        return;
      }

      const response = await ApiService.get(`/user/search?q=${encodeURIComponent(query)}`, token);
      
      if (response.success && response.data) {
        let users: User[];
        
        // Handle both array and object response
        if (Array.isArray(response.data)) {
          users = response.data;
        } else if (response.data.users && Array.isArray(response.data.users)) {
          users = response.data.users;
        } else {
          users = [];
        }
        
        const filtered = users.filter((candidate: any) => {
          const availability = candidate?.friendship_status || candidate?.status;
          const normalized = availability ? String(availability).toLowerCase() : 'available';
          return normalized === 'available';
        });
        
        console.log('🔍 Found', users.length, 'users');
        console.log('🔍 Filtered to', filtered.length, 'available users');
        setSearchResults(filtered);
      } else {
        console.log('❌ Search failed:', response.error);
        setSearchResults([]);
      }
    } catch (error: any) {
      console.log('❌ Search error:', error);
      setSearchResults([]);
      NotificationService.show('error', 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(text);
    }, 500);
  };

  const handleAddFriend = async (user: User) => {
    try {
      console.log('👋 Adding friend:', user.username);
      const token = await StorageService.getAuthToken();
      
      if (!token) {
        console.log('❌ No auth token for adding friend');
        return;
      }

      const response = await ApiService.post('/user/add', { friendId: user.id }, token);
      
      if (response.success) {
        const status = response.data?.status as string | undefined;
        const message = response.data?.message as string | undefined;

        console.log('✅ Friend request result:', status);

        if (status === 'accepted') {
          NotificationService.show('success', message || `${user.username} is now your friend`);
        } else {
          NotificationService.show('info', message || `Friend request sent to ${user.username}`);
        }

        onFriendUpdated();
        
        // Clear search
        setSearchQuery('');
        setSearchResults([]);
      } else {
        console.log('❌ Failed to add friend:', response.error);
        if (response.statusCode === 409) {
          NotificationService.show('info', response.error || 'Friend request already pending or you are already connected');
          setSearchResults((prev) => prev.filter((item) => item.id !== user.id));
        } else {
          NotificationService.show('error', response.error || 'Failed to send friend request');
        }
      }
    } catch (error: any) {      
      console.log('❌ Error adding friend:', error);
      NotificationService.show('error', 'Failed to send friend request');
    }
  };

  const confirmAddFriend = (user: User) => {
    Alert.alert(
      'Send Friend Request',
      `Do you want to send a friend request to ${user.username}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Send',
          onPress: () => handleAddFriend(user),
        },
      ]
    );
  };

  const renderSearchResult = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => confirmAddFriend(item)}
    >
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultUsername}>{item.username}</Text>
        <Text style={styles.searchResultMeta}>Tap to send a friend request</Text>
      </View>
      <Ionicons name="person-add" size={20} color="#2C82FF" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TransparentField
        placeholder="Search users by username or email"
        value={searchQuery}
        onChangeText={handleSearchChange}
        prefixIcon={
          isSearching ? (
            <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.7)" />
          ) : (
            <Ionicons name="search" size={18} color="rgba(255, 255, 255, 0.7)" />
          )
        }
        style={styles.searchInput}
      />

      {searchResults.length > 0 && (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={renderSearchResult}
          style={styles.searchResults}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {searchQuery.length > 0 && searchResults.length === 0 && !isSearching && (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>No users found</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
    marginBottom: 16,
  },
  searchInput: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  searchResults: {
    maxHeight: 200,
    paddingHorizontal: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 8,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultUsername: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  searchResultMeta: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noResultsText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
});
