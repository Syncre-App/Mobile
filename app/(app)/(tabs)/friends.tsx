import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  SectionList,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../hooks/useTheme';
import { useFriendStore } from '../../../stores/friendStore';
import { Avatar, LoadingSpinner, Button } from '../../../components/ui';
import { Layout } from '../../../constants/layout';
import { Friend, FriendRequest, UserSearchResult } from '../../../types/user';

// Union type for SectionList items
type SectionItem = FriendRequest | Friend;

interface FriendsSection {
  title: string;
  data: SectionItem[];
  type: 'pending' | 'friend';
  collapsible?: boolean;
}

export default function FriendsScreen() {
  const { colors } = useTheme();
  const {
    friends,
    pending,
    searchResults,
    fetchFriends,
    searchUsers,
    clearSearchResults,
    addFriend,
    acceptRequest,
    rejectRequest,
    isLoading,
    isSearching,
  } = useFriendStore();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPending, setExpandedPending] = useState(true);

  useEffect(() => {
    fetchFriends();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers(searchQuery);
      } else {
        clearSearchResults();
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFriends();
    setRefreshing(false);
  }, []);

  const handleAddFriend = async (userId: string) => {
    const result = await addFriend(userId);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSearchQuery('');
      clearSearchResults();
    }
  };

  const handleAcceptRequest = async (friendId: string) => {
    const result = await acceptRequest(friendId);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleRejectRequest = async (friendId: string) => {
    const result = await rejectRequest(friendId);
    if (result.success) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      <Text style={[styles.headerTitle, { color: colors.text }]}>Friends</Text>
      <View style={[styles.searchContainer, { backgroundColor: colors.inputBackground }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search users..."
          placeholderTextColor={colors.inputPlaceholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderSearchResult = ({ item }: { item: UserSearchResult }) => (
    <View style={[styles.friendItem, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={styles.friendInfo}
        onPress={() => router.push(`/(app)/profile/${item.id}`)}
      >
        <Avatar source={item.profile_picture} name={item.username} size="md" />
        <View style={styles.friendDetails}>
          <Text style={[styles.friendName, { color: colors.text }]}>@{item.username}</Text>
        </View>
      </TouchableOpacity>
      
      {!item.isFriend && !item.isPending && (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.accent }]}
          onPress={() => handleAddFriend(item.id)}
        >
          <Ionicons name="person-add" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      )}
      {item.isPending && (
        <Text style={[styles.pendingText, { color: colors.textSecondary }]}>Pending</Text>
      )}
      {item.isFriend && (
        <Ionicons name="checkmark-circle" size={24} color={colors.success} />
      )}
    </View>
  );

  const renderPendingRequest = ({ item }: { item: FriendRequest }) => (
    <View style={[styles.requestItem, { backgroundColor: colors.surface }]}>
      <Avatar source={item.user.profile_picture} name={item.user.username} size="md" />
      <View style={styles.requestDetails}>
        <Text style={[styles.friendName, { color: colors.text }]}>@{item.user.username}</Text>
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: colors.accent }]}
            onPress={() => handleAcceptRequest(item.from_user_id)}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rejectButton, { borderColor: colors.border }]}
            onPress={() => handleRejectRequest(item.from_user_id)}
          >
            <Text style={[styles.rejectButtonText, { color: colors.textSecondary }]}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderFriend = ({ item }: { item: Friend }) => (
    <TouchableOpacity
      style={[styles.friendItem, { backgroundColor: colors.background }]}
      onPress={() => router.push(`/(app)/profile/${item.id}`)}
    >
      <View style={styles.friendInfo}>
        <Avatar
          source={item.profile_picture}
          name={item.username}
          size="md"
          showOnlineStatus
          isOnline={item.status === 'online'}
        />
        <View style={styles.friendDetails}>
          <Text style={[styles.friendName, { color: colors.text }]}>@{item.username}</Text>
          <Text style={[styles.friendStatus, { color: colors.textSecondary }]}>
            {item.status === 'online' ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const renderContent = () => {
    // Show search results
    if (searchQuery.trim()) {
      if (isSearching) {
        return <LoadingSpinner message="Searching..." />;
      }

      return (
        <FlatList
          data={searchResults}
          keyExtractor={item => item.id}
          renderItem={renderSearchResult}
          ListEmptyComponent={
            <View style={styles.emptySearch}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No users found
              </Text>
            </View>
          }
          contentContainerStyle={styles.list}
        />
      );
    }

    // Show friends list with pending requests
    const onlineFriends = friends.filter(f => f.status === 'online');
    const offlineFriends = friends.filter(f => f.status !== 'online');

    const sections: FriendsSection[] = [];

    if (pending.incoming.length > 0) {
      sections.push({
        title: `Pending Requests (${pending.incoming.length})`,
        data: expandedPending ? pending.incoming : [],
        type: 'pending',
        collapsible: true,
      });
    }

    if (onlineFriends.length > 0) {
      sections.push({
        title: `Online (${onlineFriends.length})`,
        data: onlineFriends,
        type: 'friend',
      });
    }

    if (offlineFriends.length > 0) {
      sections.push({
        title: `Offline (${offlineFriends.length})`,
        data: offlineFriends,
        type: 'friend',
      });
    }

    if (sections.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Friends Yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Search for users to add as friends
          </Text>
        </View>
      );
    }

    return (
      <SectionList<SectionItem, FriendsSection>
        sections={sections}
        keyExtractor={(item, index) => ('id' in item ? item.id : index.toString())}
        renderItem={({ item, section }) =>
          section.type === 'pending'
            ? renderPendingRequest({ item: item as FriendRequest })
            : renderFriend({ item: item as Friend })
        }
        renderSectionHeader={({ section }) => (
          <TouchableOpacity
            style={[styles.sectionHeader, { backgroundColor: colors.background }]}
            onPress={() => {
              if (section.collapsible) {
                setExpandedPending(!expandedPending);
              }
            }}
            disabled={!section.collapsible}
          >
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {section.title}
            </Text>
            {section.collapsible && (
              <Ionicons
                name={expandedPending ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textSecondary}
              />
            )}
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
      />
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      {renderHeader()}
      {isLoading && friends.length === 0 ? (
        <LoadingSpinner fullScreen message="Loading friends..." />
      ) : (
        renderContent()
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.md,
  },
  headerTitle: {
    fontSize: Layout.fontSize.largeTitle,
    fontWeight: Layout.fontWeight.bold,
    marginBottom: Layout.spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    borderRadius: Layout.radius.md,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: Layout.fontSize.md,
    marginLeft: Layout.spacing.sm,
    marginRight: Layout.spacing.sm,
  },
  list: {
    paddingTop: Layout.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.sm,
  },
  sectionTitle: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.semibold,
    textTransform: 'uppercase',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendDetails: {
    marginLeft: Layout.spacing.md,
    flex: 1,
  },
  friendName: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.medium,
  },
  friendStatus: {
    fontSize: Layout.fontSize.sm,
    marginTop: 2,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingText: {
    fontSize: Layout.fontSize.sm,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
    marginHorizontal: Layout.spacing.lg,
    marginBottom: Layout.spacing.sm,
    borderRadius: Layout.radius.md,
  },
  requestDetails: {
    marginLeft: Layout.spacing.md,
    flex: 1,
  },
  requestActions: {
    flexDirection: 'row',
    marginTop: Layout.spacing.sm,
    gap: Layout.spacing.sm,
  },
  acceptButton: {
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.xs,
    borderRadius: Layout.radius.sm,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.semibold,
  },
  rejectButton: {
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.xs,
    borderRadius: Layout.radius.sm,
    borderWidth: 1,
  },
  rejectButtonText: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.medium,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.xl,
  },
  emptyTitle: {
    fontSize: Layout.fontSize.xl,
    fontWeight: Layout.fontWeight.semibold,
    marginTop: Layout.spacing.lg,
    marginBottom: Layout.spacing.sm,
  },
  emptySubtitle: {
    fontSize: Layout.fontSize.md,
    textAlign: 'center',
  },
  emptySearch: {
    padding: Layout.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: Layout.fontSize.md,
  },
});
