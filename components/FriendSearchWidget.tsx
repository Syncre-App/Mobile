import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ApiService } from '../services/ApiService';
import { NotificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';
import { UserCacheService } from '../services/UserCacheService';
import { palette, radii, spacing } from '../theme/designSystem';
import { TransparentField } from './TransparentField';
import { UserAvatar } from './UserAvatar';

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
        UserCacheService.addUsers(
          filtered.map((candidate: any) => ({
            ...candidate,
            id: candidate.id?.toString?.() ?? String(candidate.id),
          }))
        );
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
    <TouchableOpacity style={styles.searchResultItem} onPress={() => confirmAddFriend(item)}>
      <UserAvatar
        uri={item.profile_picture}
        name={item.username || item.email}
        size={44}
        style={styles.avatarContainer}
      />
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultUsername}>{item.username}</Text>
        <Text style={styles.searchResultMeta}>Tap to send a friend request</Text>
      </View>
      <Ionicons name="person-add" size={20} color="#2C82FF" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Connect</Text>
      <Text style={styles.title}>Add a friend</Text>
      <TransparentField
        placeholder="Search users by username or email"
        value={searchQuery}
        onChangeText={handleSearchChange}
        prefixIcon={
          isSearching ? (
            <ActivityIndicator size="small" color={palette.textSubtle} />
          ) : (
            <Ionicons name="search" size={18} color={palette.textSubtle} />
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
    marginBottom: spacing.lg,
    width: '100%',
  },
  searchInput: {
    marginBottom: spacing.sm,
    alignSelf: 'stretch',
  },
  searchResults: {
    maxHeight: 220,
    marginTop: spacing.xs,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    marginBottom: spacing.xs,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  avatarContainer: {
    marginRight: spacing.xs,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultUsername: {
    color: palette.text,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  searchResultMeta: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  noResultsText: {
    color: palette.textMuted,
    fontSize: 14,
  },
  label: {
    color: palette.textSubtle,
    fontFamily: 'SpaceGrotesk-Medium',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: spacing.xxs,
  },
  title: {
    color: palette.text,
    fontSize: 20,
    fontFamily: 'PlusJakartaSans-SemiBold',
    marginBottom: spacing.sm,
  },
});
