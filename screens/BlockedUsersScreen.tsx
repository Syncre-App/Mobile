import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { NotificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';
import { ApiService } from '../services/ApiService';
import { AppBackground } from '../components/AppBackground';
import { UserAvatar } from '../components/UserAvatar';
import { palette, radii, spacing } from '../theme/designSystem';

const HEADER_BUTTON_DIMENSION = spacing.sm * 2 + 24;

interface BlockedUser {
  id: string;
  username: string;
  display_name: string;
  profile_picture: string | null;
  blocked_at: string;
}

export const BlockedUsersScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const minTopPadding = spacing.lg;
  const extraTopPadding = Math.max(minTopPadding - insets.top, 0);
  
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBlockedUsers = useCallback(async () => {
    try {
      const token = await StorageService.getAuthToken();
      if (!token) return;
      
      const response = await ApiService.get('/user/blocked', token);
      if (response.success && response.data?.blockedUsers) {
        setBlockedUsers(response.data.blockedUsers);
      }
    } catch (error) {
      console.error('Error loading blocked users:', error);
      NotificationService.show('error', 'Failed to load blocked users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBlockedUsers();
  }, [loadBlockedUsers]);

  const handleUnblock = (user: BlockedUser) => {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${user.display_name || user.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            // Store the user for potential rollback
            const userToUnblock = user;
            
            try {
              const token = await StorageService.getAuthToken();
              if (!token) return;

              // Optimistically update the UI first
              setBlockedUsers((prev) => prev.filter((u) => u.id !== user.id));

              const response = await ApiService.post(
                '/user/unblock',
                { targetUserId: user.id },
                token
              );
              
              if (response.success) {
                NotificationService.show('success', `${user.display_name || user.username} has been unblocked`);
              } else {
                // Rollback on failure
                setBlockedUsers((prev) => [...prev, userToUnblock]);
                NotificationService.show('error', response.error || 'Failed to unblock user');
              }
            } catch (error) {
              // Rollback on error
              setBlockedUsers((prev) => [...prev, userToUnblock]);
              console.error('Error unblocking user:', error);
              NotificationService.show('error', 'Failed to unblock user');
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    router.back();
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadBlockedUsers();
  };

  const renderBlockedUser = ({ item }: { item: BlockedUser }) => {
    return (
      <View style={styles.userItem}>
        <View style={styles.userInfo}>
          <UserAvatar
            uri={item.profile_picture}
            name={item.display_name || item.username}
            size={48}
          />
          <View style={styles.userTexts}>
            <Text style={styles.displayName}>
              {item.display_name || item.username}
            </Text>
            <Text style={styles.username}>@{item.username}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.unblockButton}
          onPress={() => handleUnblock(item)}
        >
          <Text style={styles.unblockButtonText}>Unblock</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="checkmark-circle-outline" size={64} color={palette.textMuted} />
      <Text style={styles.emptyTitle}>No blocked users</Text>
      <Text style={styles.emptySubtitle}>
        Users you block will appear here. You can unblock them at any time.
      </Text>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { paddingTop: extraTopPadding }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <AppBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <View style={styles.headerCentered} pointerEvents="none">
          <Text style={styles.headerTitle}>Blocked Users</Text>
        </View>

        <View style={styles.headerPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderBlockedUser}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    position: 'relative',
  },
  headerButton: {
    width: HEADER_BUTTON_DIMENSION,
    height: HEADER_BUTTON_DIMENSION,
    padding: spacing.sm,
    borderRadius: radii.xxl,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPlaceholder: {
    width: HEADER_BUTTON_DIMENSION,
    height: HEADER_BUTTON_DIMENSION,
  },
  headerTitle: {
    color: palette.text,
    fontSize: 20,
    fontFamily: 'SpaceGrotesk-SemiBold',
  },
  headerCentered: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userTexts: {
    marginLeft: spacing.md,
    flex: 1,
  },
  displayName: {
    color: palette.text,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  username: {
    color: palette.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  unblockButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  unblockButtonText: {
    color: palette.text,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 20,
    fontFamily: 'SpaceGrotesk-SemiBold',
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    color: palette.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});
