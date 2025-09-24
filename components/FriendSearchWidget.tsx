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
import { GlassCard } from './GlassCard';
import { TransparentField } from './TransparentField';

interface User {
  id: string;
  username: string;
  email: string;
  [key: string]: any;
}

interface FriendSearchWidgetProps {
  onFriendAdded: () => void;
}

export const FriendSearchWidget: React.FC<FriendSearchWidgetProps> = ({
  onFriendAdded,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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
        
        console.log('🔍 Found', users.length, 'users');
        setSearchResults(users);
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

      const response = await ApiService.post('/user/add-friend', { friendId: user.id }, token);
      
      if (response.success) {
        console.log('✅ Friend added successfully');
        NotificationService.show('success', `${user.username} added as friend!`);
        onFriendAdded();
        
        // Clear search
        setSearchQuery('');
        setSearchResults([]);
        setIsExpanded(false);
      } else {
        console.log('❌ Failed to add friend:', response.error);
        NotificationService.show('error', response.error || 'Failed to add friend');
      }
    } catch (error: any) {
      console.log('❌ Error adding friend:', error);
      NotificationService.show('error', 'Failed to add friend');
    }
  };

  const confirmAddFriend = (user: User) => {
    Alert.alert(
      'Add Friend',
      `Do you want to add ${user.username} as a friend?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Add',
          onPress: () => handleAddFriend(user),
        },
      ]
    );
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      // Clear search when collapsing
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const renderSearchResult = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => confirmAddFriend(item)}
    >
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultUsername}>{item.username}</Text>
        <Text style={styles.searchResultEmail}>{item.email}</Text>
      </View>
      <Ionicons name="person-add" size={20} color="#2C82FF" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <GlassCard style={styles.card}>
        <TouchableOpacity
          onPress={toggleExpanded}
          style={styles.header}
        >
          <Ionicons name="search" size={20} color="rgba(255, 255, 255, 0.7)" />
          <Text style={styles.headerText}>Find Friends</Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="rgba(255, 255, 255, 0.7)"
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.searchContent}>
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
        )}
      </GlassCard>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  headerText: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  searchContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchInput: {
    marginBottom: 12,
  },
  searchResults: {
    maxHeight: 200,
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
  searchResultEmail: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
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
