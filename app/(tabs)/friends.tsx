import React, { useCallback, useState } from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChatContext } from './_layout';
import { AppBackground } from '../../components/AppBackground';
import { FriendSearchWidget } from '../../components/FriendSearchWidget';
import { FriendRequestsWidget } from '../../components/FriendRequestsWidget';
import { ApiService } from '../../services/ApiService';
import { NotificationService } from '../../services/NotificationService';
import { StorageService } from '../../services/StorageService';
import { WebSocketService } from '../../services/WebSocketService';
import { font, palette, spacing } from '../../theme/designSystem';

export default function FriendsTab() {
  const insets = useSafeAreaInsets();
  const {
    incomingRequests,
    outgoingRequests,
    loadChats,
    loadFriendData,
    loadUnreadSummary,
  } = useChatContext();

  const [requestProcessingId, setRequestProcessingId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────

  const handleFriendStateChanged = useCallback(async () => {
    await Promise.all([loadFriendData(), loadChats(), loadUnreadSummary(true)]);
    WebSocketService.getInstance().refreshFriendsStatus();
  }, [loadChats, loadFriendData, loadUnreadSummary]);

  const handleRespondToRequest = useCallback(
    async (friendId: string, action: 'accept' | 'reject') => {
      try {
        setRequestError(null);
        setRequestProcessingId(friendId);
        const token = await StorageService.getAuthToken();
        if (!token) {
          NotificationService.show('error', 'Missing authentication token');
          return;
        }

        const response = await ApiService.post('/user/respond', { friendId, action }, token);
        if (response.success) {
          const message = response.data?.message;

          if (action === 'accept') {
            NotificationService.show('success', message || 'Friend request accepted');
            await loadChats();
          } else {
            NotificationService.show('info', message || 'Friend request declined');
          }

          await Promise.all([loadFriendData(), loadUnreadSummary(true)]);
        } else {
          setRequestError(response.error || 'Failed to update request');
          NotificationService.show('error', response.error || 'Failed to update request');
        }
      } catch (error) {
        console.error('Failed to respond to friend request:', error);
        setRequestError('Could not update the friend request. Please try again.');
        NotificationService.show('error', 'Failed to update request');
      } finally {
        setRequestProcessingId(null);
      }
    },
    [loadChats, loadFriendData, loadUnreadSummary]
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
          headerTitle: 'Friends',
          headerTitleStyle: {
            color: palette.text,
            ...font('display'),
            fontSize: 20,
          },
          headerSearchBarOptions: Platform.OS === 'ios' ? {
            placeholder: 'Search friends...',
            hideWhenScrolling: false,
          } : undefined,
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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search Section */}
          <View style={styles.section}>
            <FriendSearchWidget onFriendUpdated={handleFriendStateChanged} showHeader />
          </View>

          {/* Friend Requests Section */}
          {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
            <View style={styles.section}>
              <FriendRequestsWidget
                incoming={incomingRequests}
                outgoing={outgoingRequests}
                onAccept={(friendId) => handleRespondToRequest(friendId, 'accept')}
                onReject={(friendId) => handleRespondToRequest(friendId, 'reject')}
                processingId={requestProcessingId}
              />
              {requestError ? <Text style={styles.requestError}>{requestError}</Text> : null}
            </View>
          )}

          {/* Empty State */}
          {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Find new friends</Text>
              <Text style={styles.emptyText}>
                Search for users by username or email to send friend requests.
              </Text>
            </View>
          )}
        </ScrollView>
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
  scrollView: {
    flex: 1,
    marginTop: 60, // Account for header
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  requestError: {
    marginTop: spacing.sm,
    color: palette.error,
    fontSize: 14,
    ...font('semibold'),
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 20,
    ...font('semibold'),
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});
