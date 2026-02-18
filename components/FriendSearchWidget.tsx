import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ApiService } from '../services/ApiService';
import { NotificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';
import { UserCacheService } from '../services/UserCacheService';
import { font, layout, palette, radii, spacing } from '../theme/designSystem';
import { TransparentField } from './TransparentField';
import { UserAvatar } from './UserAvatar';
import BadgeIcon from './BadgeIcon';

interface User {
  id: string;
  username: string;
  profile_picture?: string | null;
  friendship_status?: string;
  [key: string]: any;
}

interface FriendSearchWidgetProps {
  onFriendUpdated: () => void;
  showHeader?: boolean;
}

export const FriendSearchWidget: React.FC<FriendSearchWidgetProps> = ({
  onFriendUpdated,
  showHeader = true,
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

        if (Array.isArray(response.data)) {
          users = response.data;
        } else if (response.data.users && Array.isArray(response.data.users)) {
          users = response.data.users;
        } else {
          users = [];
        }

        const normalized = users.map((candidate: any) => ({
          ...candidate,
          id: candidate.id?.toString?.() ?? String(candidate.id),
          friendship_status: candidate.friendship_status || candidate.status || 'available',
          badges: Array.isArray(candidate.badges) ? candidate.badges : [],
        }));

        console.log('🔍 Found', normalized.length, 'users');
        UserCacheService.addUsers(normalized as any[]);
        setSearchResults(normalized);
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
        setSearchResults((prev) =>
          prev.map((entry) =>
            entry.id === user.id
              ? {
                  ...entry,
                  friendship_status: status === 'accepted' ? 'friend' : 'pending_outgoing',
                }
              : entry
          )
        );
      } else {
        console.log('❌ Failed to add friend:', response.error);
        if (response.statusCode === 409) {
          NotificationService.show('info', response.error || 'Friend request already pending or you are already connected');
          setSearchResults((prev) =>
            prev.map((entry) =>
              entry.id === user.id ? { ...entry, friendship_status: 'pending_outgoing' } : entry
            )
          );
        } else {
          NotificationService.show('error', response.error || 'Failed to send friend request');
        }
      }
    } catch (error: any) {      
      console.log('❌ Error adding friend:', error);
      NotificationService.show('error', 'Failed to send friend request');
    }
  };

  const handleCancelRequest = async (user: User) => {
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        console.log('❌ No auth token for canceling friend request');
        return;
      }
      const response = await ApiService.post('/user/remove', { friendId: user.id }, token);
      if (response.success) {
        NotificationService.show('info', 'Friend request withdrawn');
        setSearchResults((prev) =>
          prev.map((entry) =>
            entry.id === user.id ? { ...entry, friendship_status: 'available' } : entry
          )
        );
        onFriendUpdated();
      } else {
        NotificationService.show('error', response.error || 'Unable to cancel request');
      }
    } catch (error: any) {
      console.log('❌ Error canceling request:', error);
      NotificationService.show('error', 'Unable to cancel request');
    }
  };

  const resolveStatus = (user: User) => {
    const status = user.friendship_status || user.status || 'available';
    return String(status).toLowerCase();
  };

  const renderStatusText = (status: string) => {
    switch (status) {
      case 'friend':
        return 'You are already friends';
      case 'pending_outgoing':
        return 'Request sent — tap to cancel';
      case 'pending_incoming':
        return 'They sent you a request';
      default:
        return 'Tap to send a friend request';
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

  const renderSearchResult = (item: User) => {
    const status = resolveStatus(item);
    const actionable = status === 'available' || status === 'pending_outgoing';
    const onPress =
      status === 'available'
        ? () => confirmAddFriend(item)
        : status === 'pending_outgoing'
          ? () => handleCancelRequest(item)
          : undefined;
    const icon = (() => {
      if (status === 'friend') return <Ionicons name="checkmark-circle" size={20} color="#22c55e" />;
      if (status === 'pending_outgoing') return <Ionicons name="time-outline" size={20} color="#f59e0b" />;
      if (status === 'pending_incoming') return <Ionicons name="mail-unread-outline" size={20} color="#22d3ee" />;
      return <Ionicons name="person-add" size={20} color="#2C82FF" />;
    })();

    const content = (
      <>
        <UserAvatar
          uri={item.profile_picture}
          name={item.username || item.email}
          size={44}
          style={styles.avatarContainer}
        />
        <View style={styles.searchResultInfo}>
          <View style={styles.searchResultTitleRow}>
            <Text style={styles.searchResultUsername}>{item.username}</Text>
            {Array.isArray(item.badges) && item.badges.length > 0 ? (
              <View style={styles.badgeContainer}>
                {item.badges.slice(0, 3).map((badge: string, idx: number) => (
                  <View key={`${item.id}-badge-${badge}-${idx}`} style={styles.badgeWrapper}>
                    <BadgeIcon type={badge as any} size={20} />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <Text style={styles.searchResultMeta}>{renderStatusText(status)}</Text>
        </View>
        {icon}
      </>
    );

    if (actionable) {
      return (
        <TouchableOpacity
          key={item.id}
          style={styles.searchResultItem}
          onPress={onPress}
          disabled={!onPress}
        >
          {content}
        </TouchableOpacity>
      );
    }

    return (
      <View key={item.id} style={[styles.searchResultItem, styles.searchResultItemDisabled]}>
        {content}
      </View>
    );
  };

  return (
    <View style={[styles.container, !showHeader && styles.containerCompact]}>
      {showHeader ? (
        <>
          <Text style={styles.label}>Connect</Text>
          <Text style={styles.title}>Add a friend</Text>
        </>
      ) : null}
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
        <View style={styles.searchResults}>
          {searchResults.map(renderSearchResult)}
        </View>
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
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  containerCompact: {
    marginBottom: spacing.md,
  },
  searchInput: {
    marginBottom: spacing.sm,
    alignSelf: 'stretch',
  },
  searchResults: {
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
  searchResultItemDisabled: {
    opacity: 0.7,
  },
  avatarContainer: {
    marginRight: spacing.xs,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  searchResultUsername: {
    color: palette.text,
    fontSize: 16,
    ...font('semibold'),
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeWrapper: {
    shadowColor: '#ffffff',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
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
    ...font('displayMedium'),
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: spacing.xxs,
  },
  title: {
    color: palette.text,
    fontSize: 20,
    ...font('semibold'),
    marginBottom: spacing.sm,
  },
});
