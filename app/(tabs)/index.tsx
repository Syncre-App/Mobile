import React, { useCallback, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Platform,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChatContext } from './_layout';
import { AppBackground } from '../../components/AppBackground';
import { ChatListWidget } from '../../components/ChatListWidget';
import { UserAvatar } from '../../components/UserAvatar';
import { ApiService } from '../../services/ApiService';
import { ChatService } from '../../services/ChatService';
import { NotificationService } from '../../services/NotificationService';
import { StorageService } from '../../services/StorageService';
import { font, palette, spacing } from '../../theme/designSystem';

export default function ChatsTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    user,
    setUser,
    chats,
    chatsLoading,
    userStatuses,
    chatUnreadCounts,
    chatStreaks,
    blockedSet,
    isOnline,
    loadChats,
    loadFriendData,
    loadUnreadSummary,
  } = useChatContext();

  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────

  const handleProfilePress = () => {
    router.push('/profile');
  };

  const handleChatRefresh = useCallback(async () => {
    await Promise.all([loadChats(), loadFriendData(), loadUnreadSummary(true)]);
  }, [loadChats, loadFriendData, loadUnreadSummary]);

  const handleMarkChatRead = useCallback(
    async (chatId: string) => {
      if (!chatId) return;
      try {
        const token = await StorageService.getAuthToken();
        if (token) {
          await ApiService.post(`/chat/${chatId}/seen`, {}, token);
          loadUnreadSummary(true);
        }
      } catch (error) {
        console.warn('[ChatsTab] Failed to mark chat as read:', error);
      }
    },
    [loadUnreadSummary]
  );

  const handleRemoveFriend = useCallback(
    async (friendId: string) => {
      try {
        setRemovingFriendId(friendId);
        const token = await StorageService.getAuthToken();
        if (!token) {
          NotificationService.show('error', 'Missing authentication token');
          return;
        }

        const response = await ApiService.post('/user/remove', { friendId }, token);
        if (response.success) {
          NotificationService.show('success', response.data?.message || 'Friend removed successfully');
          await Promise.all([loadFriendData(), loadChats(), loadUnreadSummary(true)]);
        } else {
          NotificationService.show('error', response.error || 'Failed to remove friend');
        }
      } catch (error) {
        console.error('Failed to remove friend:', error);
        NotificationService.show('error', 'Failed to remove friend');
      } finally {
        setRemovingFriendId(null);
      }
    },
    [loadChats, loadFriendData, loadUnreadSummary]
  );

  const handleReportUser = useCallback(async (userId: string) => {
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        NotificationService.show('error', 'Missing authentication token');
        return;
      }
      const response = await ApiService.post(
        '/user/report',
        { targetUserId: userId, reason: 'Reported from chat list' },
        token
      );
      if (response.success) {
        NotificationService.show('success', 'Report submitted');
      } else {
        NotificationService.show('error', response.error || 'Failed to submit report');
      }
    } catch (error) {
      console.error('Failed to report user:', error);
      NotificationService.show('error', 'Failed to submit report');
    }
  }, []);

  const handleToggleBlockUser = useCallback(
    async (userId: string, isBlocked: boolean) => {
      try {
        const token = await StorageService.getAuthToken();
        if (!token) {
          NotificationService.show('error', 'Missing authentication token');
          return;
        }
        const endpoint = isBlocked ? '/user/unblock' : '/user/block';
        const response = await ApiService.post(endpoint, { targetUserId: userId }, token);
        if (response.success) {
          const nextList = (response.data as any)?.blocked_users || [];
          const updatedUser = user ? { ...user, blocked_users: nextList } : { blocked_users: nextList };
          setUser(updatedUser);
          await StorageService.setObject('user_data', updatedUser);
          NotificationService.show('success', isBlocked ? 'User unblocked' : 'User blocked');
        } else {
          NotificationService.show('error', response.error || 'Failed to update block list');
        }
      } catch (error) {
        console.error('Failed to toggle block user:', error);
        NotificationService.show('error', 'Failed to update block list');
      }
    },
    [user, setUser]
  );

  const handleEditGroup = useCallback(
    (chat: any) => {
      if (!chat?.id) return;
      router.push({
        pathname: '/group/[id]/edit',
        params: { id: chat.id?.toString?.() ?? String(chat.id) },
      } as any);
    },
    [router]
  );

  const handleDeleteGroup = useCallback(
    (chat: any) => {
      if (!chat?.id) return;
      Alert.alert('Delete group', `Are you sure you want to delete ${chat.name || 'this group'}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const response = await ChatService.deleteGroup(chat.id?.toString?.() ?? String(chat.id));
            if (response.success) {
              NotificationService.show('success', 'Group deleted');
              DeviceEventEmitter.emit('chats:refresh');
              loadChats();
            } else {
              NotificationService.show('error', response.error || 'Failed to delete group');
            }
          },
        },
      ]);
    },
    [loadChats]
  );

  const handleLeaveGroup = useCallback(
    (chat: any) => {
      if (!chat?.id) return;
      Alert.alert('Leave group', `Leave ${chat.name || 'this group'}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const chatId = chat.id?.toString?.() ?? String(chat.id);
            const memberId = user?.id?.toString?.() ?? String(user?.id || '');
            if (!memberId) {
              NotificationService.show('error', 'Missing user context to leave group');
              return;
            }
            const response = await ChatService.removeMember(chatId, memberId);
            if (response.success) {
              NotificationService.show('success', 'Left group');
              DeviceEventEmitter.emit('chats:refresh');
              loadChats();
            } else {
              NotificationService.show('error', response.error || 'Failed to leave group');
            }
          },
        },
      ]);
    },
    [loadChats, user?.id]
  );

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: 'Chats',
          headerTitleStyle: {
            color: palette.text,
            ...font('display'),
            fontSize: 20,
          },
          headerRight: () => (
            <TouchableOpacity onPress={handleProfilePress} style={styles.headerProfileButton}>
              <UserAvatar
                uri={user?.profile_picture}
                name={user?.username || user?.name || user?.email}
                size={36}
                presence={isOnline ? 'online' : 'offline'}
                presencePlacement="overlay"
              />
            </TouchableOpacity>
          ),
        }}
      />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppBackground />

      <SafeAreaView
        style={[
          styles.safeArea,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 0),
          },
        ]}
        edges={['left', 'right']}
      >
        <View style={styles.content}>
          <ChatListWidget
            chats={chats}
            isLoading={chatsLoading}
            onRefresh={handleChatRefresh}
            userStatuses={userStatuses}
            onRemoveFriend={handleRemoveFriend}
            onReportUser={handleReportUser}
            onToggleBlock={handleToggleBlockUser}
            blockedUserIds={blockedSet}
            removingFriendId={removingFriendId}
            unreadCounts={chatUnreadCounts}
            streaks={chatStreaks}
            onEditGroup={handleEditGroup}
            onDeleteGroup={handleDeleteGroup}
            onLeaveGroup={handleLeaveGroup}
            onMarkRead={handleMarkChatRead}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  content: {
    flex: 1,
    marginTop: 60, // Account for header
  },
  headerProfileButton: {
    marginRight: spacing.sm,
  },
});
