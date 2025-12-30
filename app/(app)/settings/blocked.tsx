import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../hooks/useTheme';
import { userApi } from '../../../services/api';
import { Avatar, LoadingSpinner, Button } from '../../../components/ui';
import { Layout } from '../../../constants/layout';
import { BlockedUser } from '../../../types/user';

export default function BlockedUsersScreen() {
  const { colors } = useTheme();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    try {
      setIsLoading(true);
      const users = await userApi.getBlockedUsers();
      setBlockedUsers(users);
    } catch (error) {
      console.error('Failed to load blocked users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblock = (user: BlockedUser) => {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock @${user.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              await userApi.unblockUser(user.id);
              setBlockedUsers(prev => prev.filter(u => u.id !== user.id));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to unblock user');
            }
          },
        },
      ]
    );
  };

  const renderUser = ({ item }: { item: BlockedUser }) => (
    <View style={[styles.userItem, { backgroundColor: colors.background }]}>
      <Avatar source={item.profile_picture} name={item.username} size="md" />
      <View style={styles.userInfo}>
        <Text style={[styles.username, { color: colors.text }]}>@{item.username}</Text>
      </View>
      <TouchableOpacity
        style={[styles.unblockButton, { borderColor: colors.accent }]}
        onPress={() => handleUnblock(item)}
      >
        <Text style={[styles.unblockText, { color: colors.accent }]}>Unblock</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Blocked Users</Text>
        <View style={styles.placeholder} />
      </View>

      {isLoading ? (
        <LoadingSpinner fullScreen />
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={item => item.id}
          renderItem={renderUser}
          contentContainerStyle={blockedUsers.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="ban-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No blocked users
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
  backButton: {
    padding: Layout.spacing.xs,
  },
  headerTitle: {
    fontSize: Layout.fontSize.lg,
    fontWeight: Layout.fontWeight.semibold,
  },
  placeholder: {
    width: 40,
  },
  list: {
    paddingTop: Layout.spacing.sm,
  },
  emptyList: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
  },
  userInfo: {
    flex: 1,
    marginLeft: Layout.spacing.md,
  },
  username: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.medium,
  },
  unblockButton: {
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.xs,
    borderRadius: Layout.radius.sm,
    borderWidth: 1,
  },
  unblockText: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.medium,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: Layout.fontSize.md,
    marginTop: Layout.spacing.md,
  },
});
