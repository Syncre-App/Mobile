import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useFriendStore } from '../../stores/friendStore';
import { useChatStore } from '../../stores/chatStore';
import { Avatar, LoadingSpinner } from '../../components/ui';
import { Layout } from '../../constants/layout';
import { Friend } from '../../types/user';

export default function NewChatScreen() {
  const { colors } = useTheme();
  const { friends, fetchFriends, isLoading } = useFriendStore();
  const { chats } = useChatStore();
  
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFriends();
  }, []);

  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectFriend = (friend: Friend) => {
    // Check if chat already exists with this friend
    const existingChat = chats.find(
      chat => !chat.isGroup && chat.participants.some(p => p.id === friend.id)
    );

    if (existingChat) {
      router.replace(`/(app)/chat/${existingChat.id}`);
    } else {
      // TODO: Create new chat via API
      // For now, just close the modal
      router.back();
    }
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <TouchableOpacity
      style={[styles.friendItem, { backgroundColor: colors.background }]}
      onPress={() => handleSelectFriend(item)}
    >
      <Avatar
        source={item.profile_picture}
        name={item.username}
        size="md"
        showOnlineStatus
        isOnline={item.status === 'online'}
      />
      <View style={styles.friendInfo}>
        <Text style={[styles.friendName, { color: colors.text }]}>@{item.username}</Text>
        <Text style={[styles.friendStatus, { color: colors.textSecondary }]}>
          {item.status === 'online' ? 'Online' : 'Offline'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>New Chat</Text>
        <TouchableOpacity
          onPress={() => router.push('/(app)/new-group')}
          style={styles.groupButton}
        >
          <Ionicons name="people-outline" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.inputBackground }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search friends..."
            placeholderTextColor={colors.inputPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {isLoading ? (
        <LoadingSpinner message="Loading friends..." />
      ) : (
        <FlatList
          data={filteredFriends}
          keyExtractor={item => item.id}
          renderItem={renderFriend}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery ? 'No friends found' : 'No friends yet'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
    borderBottomWidth: 0.5,
  },
  closeButton: {
    padding: Layout.spacing.xs,
  },
  headerTitle: {
    fontSize: Layout.fontSize.lg,
    fontWeight: Layout.fontWeight.semibold,
  },
  groupButton: {
    padding: Layout.spacing.xs,
  },
  searchContainer: {
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
  },
  searchInputContainer: {
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
  },
  list: {
    paddingTop: Layout.spacing.sm,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
  },
  friendInfo: {
    marginLeft: Layout.spacing.md,
  },
  friendName: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.medium,
  },
  friendStatus: {
    fontSize: Layout.fontSize.sm,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Layout.spacing.xxl,
  },
  emptyText: {
    fontSize: Layout.fontSize.md,
    marginTop: Layout.spacing.md,
  },
});
