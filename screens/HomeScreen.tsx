import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ChatListWidget } from '../components/ChatListWidget';
import { FriendRequestsWidget } from '../components/FriendRequestsWidget';
import { FriendSearchWidget } from '../components/FriendSearchWidget';
import { GlassCard } from '../components/GlassCard';
import { ApiService } from '../services/ApiService';
import { NotificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';
import { WebSocketMessage, WebSocketService } from '../services/WebSocketService';

export const HomeScreen: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [userStatuses, setUserStatuses] = useState<any>({});
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const incomingRequestsRef = useRef<any[]>([]);
  const outgoingRequestsRef = useRef<any[]>([]);
  const [requestProcessingId, setRequestProcessingId] = useState<string | null>(null);
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );
  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return dateB - dateA;
    });
  }, [notifications]);
  
  useEffect(() => {
    validateTokenAndInit();
  }, [validateTokenAndInit]);

  const validateTokenAndInit = useCallback(async () => {
    try {
      console.log('🔍 HomeScreen: Validating token...');
      const token = await StorageService.getAuthToken();
      
      if (!token) {
        console.log('❌ HomeScreen: No token found - redirect to login');
        router.replace('/');
        return;
      }

      // Test token validity
      const response = await ApiService.get('/user/me', token);
      
      if (response.success) {
        console.log('✅ HomeScreen: Token valid - initializing...');
        setIsValidatingToken(false);
        await initializeScreen();
        connectWebSocket();
      } else {
        console.log('❌ HomeScreen: Token invalid - clearing and redirect to login');
        await StorageService.removeAuthToken();
        await StorageService.removeItem('user_data');
        router.replace('/');
      }
    } catch (error) {
      console.error('❌ HomeScreen: Token validation error:', error);
      await StorageService.removeAuthToken();
      await StorageService.removeItem('user_data');
      router.replace('/');
    }
  }, [connectWebSocket, initializeScreen, router]);

  const initializeScreen = useCallback(async () => {
    try {
      // First try to get user data from storage
      const userData = await StorageService.getObject('user_data');
      setUser(userData);
      
      // Also fetch current user data from API to ensure we have latest info
      const token = await StorageService.getAuthToken();
      if (token) {
        const response = await ApiService.get('/user/me', token);
        if (response.success && response.data) {
          console.log('🔍 User data from API:', JSON.stringify(response.data, null, 2));
          setUser(response.data);
          // Update stored user data
          await StorageService.setObject('user_data', response.data);
        }
      }
      
      await loadChats();
      await loadFriendData();
      await loadNotifications();
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  }, [loadChats, loadFriendData, loadNotifications]);

  const loadChats = useCallback(async () => {
    setChatsLoading(true);
    try {
      const token = await StorageService.getAuthToken();
      console.log('loadChats: token=', !!token);
      if (token) {
        // Fix API endpoint to match REST API documentation: /chat instead of /chats
        const response = await ApiService.get('/chat', token);
        console.log('loadChats: response=', response);
        if (response.success && response.data) {
          // API returns { chats: [...] } according to documentation
          setChats(response.data.chats || []);
        } else {
          console.warn('loadChats: failed to fetch chats:', response.error);
        }
      } else {
        console.warn('loadChats: no auth token, skipping chats fetch');
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setChatsLoading(false);
    }
  }, []);

  const loadFriendData = useCallback(async () => {
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        return;
      }

      const response = await ApiService.get('/user/friends', token);
      if (response.success && response.data) {
        const pending = response.data.pending || {};
        const incoming = Array.isArray(pending.incoming) ? pending.incoming : [];
        const outgoing = Array.isArray(pending.outgoing) ? pending.outgoing : [];

        const normalizedIncoming = incoming.map((item: any) => ({
          ...item,
          id: item.id?.toString?.() ?? String(item.id),
        }));
        const normalizedOutgoing = outgoing.map((item: any) => ({
          ...item,
          id: item.id?.toString?.() ?? String(item.id),
        }));

        incomingRequestsRef.current = normalizedIncoming;
        outgoingRequestsRef.current = normalizedOutgoing;
        setIncomingRequests(normalizedIncoming);
        setOutgoingRequests(normalizedOutgoing);
      }
    } catch (error) {
      console.error('Failed to load friend data:', error);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    const buildFallbackNotifications = () => {
      const incoming = incomingRequestsRef.current.map((item: any) => ({
        id: `incoming-${item.id}`,
        type: 'friend_request',
        title: `${item.username || 'Someone'} sent you a friend request`,
        userid: item.id,
        message: 'Tap to accept or decline this request.',
        timestamp: new Date().toISOString(),
      }));

      const outgoing = outgoingRequestsRef.current.map((item: any) => ({
        id: `outgoing-${item.id}`,
        type: 'friend_request_outgoing',
        title: `Pending request to ${item.username || 'user'}`,
        userid: item.id,
        message: 'Waiting for the other user to respond.',
        timestamp: new Date().toISOString(),
      }));

      return [...incoming, ...outgoing];
    };

    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        setNotifications(buildFallbackNotifications());
        return;
      }

      const response = await ApiService.get('/user/notifications', token);
      if (response.success && response.data) {
        const items = Array.isArray(response.data.notifications) ? response.data.notifications : [];
        console.log('🔔 Notifications response data:', response.data);
        console.log('🔔 Notifications fetched:', items);
        setNotifications(items);
      } else {
        console.warn('🔔 Failed to fetch notifications:', response.error);
        console.log('🔔 Full response:', response);
        if (response.statusCode === 404) {
          setNotifications(buildFallbackNotifications());
        }
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications(buildFallbackNotifications());
    }
  }, []);

  const markNotificationsAsRead = useCallback(async () => {
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        setNotifications((prev) => prev.map((notification: any) => ({ ...notification, read: true })));
        return;
      }

      const response = await ApiService.post('/user/notifications/read', {}, token);
      if (response.success && response.data) {
        const items = Array.isArray(response.data.notifications) ? response.data.notifications : [];
        setNotifications(items);
      }
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
      setNotifications((prev) => prev.map((notification: any) => ({ ...notification, read: true })));
    }
  }, []);

  const connectWebSocket = useCallback(async () => {
    try {
      const wsService = WebSocketService.getInstance();
      await wsService.connect();
      setIsOnline(true);
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setIsOnline(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    await initializeScreen();
  }, [initializeScreen]);

  const handleProfilePress = () => {
    router.push('/profile');
  };

  const handleFriendStateChanged = useCallback(async () => {
    await Promise.all([loadFriendData(), loadChats(), loadNotifications()]);
  }, [loadChats, loadFriendData, loadNotifications]);

  const handleRespondToRequest = useCallback(async (friendId: string, action: 'accept' | 'reject') => {
    try {
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

        await Promise.all([loadFriendData(), loadNotifications()]);
      } else {
        NotificationService.show('error', response.error || 'Failed to update request');
      }
    } catch (error) {
      console.error('Failed to respond to friend request:', error);
      NotificationService.show('error', 'Failed to update request');
    } finally {
      setRequestProcessingId(null);
    }
  }, [loadChats, loadFriendData, loadNotifications]);

  const handleRemoveFriend = useCallback(async (friendId: string) => {
    try {
      setRemovingFriendId(friendId);
      const token = await StorageService.getAuthToken();
      if (!token) {
        NotificationService.show('error', 'Missing authentication token');
        return;
      }

      const response = await ApiService.post('/user/remove', { friendId }, token);
      if (response.success) {
        const message = response.data?.message || 'Friend removed successfully';
        NotificationService.show('success', message);
        await Promise.all([loadFriendData(), loadChats(), loadNotifications()]);
      } else {
        NotificationService.show('error', response.error || 'Failed to remove friend');
      }
    } catch (error) {
      console.error('Failed to remove friend:', error);
      NotificationService.show('error', 'Failed to remove friend');
    } finally {
      setRemovingFriendId(null);
    }
  }, [loadChats, loadFriendData, loadNotifications]);

  const handleChatRefresh = useCallback(async () => {
    await Promise.all([loadChats(), loadFriendData(), loadNotifications()]);
  }, [loadChats, loadFriendData, loadNotifications]);

  const handleNotificationsPress = useCallback(() => {
    if (!isNotificationsVisible) {
      markNotificationsAsRead();
    }
    setIsNotificationsVisible((prev) => !prev);
  }, [isNotificationsVisible, markNotificationsAsRead]);

  const handleRealtimeMessage = useCallback((message: WebSocketMessage) => {
    if (!message || !message.type) {
      return;
    }

    const data = message.data || {};
    const friendUser = data.friend || data.fromUser || data.toUser;
    const friendName = friendUser?.username || 'User';

    switch (message.type) {
      case 'friend_request_received': {
        NotificationService.show('info', `${friendName} sent you a friend request`);
        NotificationService.showAlert('Friend Request', `${friendName} wants to connect with you.`, [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Decline',
            style: 'destructive',
            onPress: () => data.fromUser?.id && handleRespondToRequest(String(data.fromUser.id), 'reject'),
          },
          {
            text: 'Accept',
            onPress: () => data.fromUser?.id && handleRespondToRequest(String(data.fromUser.id), 'accept'),
          },
        ]);
        handleFriendStateChanged();
        break;
      }
      case 'friend_request_sent': {
        NotificationService.show('info', `Friend request sent to ${friendName}`);
        loadFriendData();
        loadNotifications();
        break;
      }
      case 'friend_request_accepted': {
        NotificationService.show('success', `${friendName} accepted your friend request`);
        handleFriendStateChanged();
        break;
      }
      case 'friend_request_declined': {
        NotificationService.show('warning', `${friendName} declined your friend request`);
        handleFriendStateChanged();
        break;
      }
      case 'friend_removed': {
        NotificationService.show('info', `${friendName} removed you as a friend`);
        handleFriendStateChanged();
        break;
      }
      default:
        break;
    }
  }, [handleFriendStateChanged, handleRespondToRequest, loadNotifications]);

  useEffect(() => {
    const wsService = WebSocketService.getInstance();
    const unsubscribe = wsService.addMessageListener(handleRealtimeMessage);
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [handleRealtimeMessage]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#03040A', '#071026']}
        style={StyleSheet.absoluteFillObject}
      />
      
      {isValidatingToken ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2C82FF" />
          <Text style={styles.loadingText}>Validating session...</Text>
        </View>
      ) : (
        <SafeAreaView style={styles.safeArea}>
          {/* Simple header with profile */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Chats</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.notificationButton}
                onPress={handleNotificationsPress}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isNotificationsVisible ? 'notifications' : 'notifications-outline'}
                  size={22}
                  color="#ffffff"
                />
                {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.profileButton} onPress={handleProfilePress}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>
                    {user?.username?.charAt(0)?.toUpperCase() || 
                     user?.name?.charAt(0)?.toUpperCase() || 
                     user?.email?.charAt(0)?.toUpperCase() || 
                     'U'}
                  </Text>
                </View>
                <View style={[styles.profileStatusDot, { backgroundColor: isOnline ? '#4CAF50' : '#757575' }]} />
              </TouchableOpacity>
            </View>
          </View>

          {isNotificationsVisible && (
            <View style={styles.notificationsOverlay}>
              <GlassCard width="100%" style={styles.notificationsCard}>
                <Text style={styles.notificationsTitle}>Notifications</Text>
                {sortedNotifications.length === 0 ? (
                  <Text style={styles.notificationsEmpty}>You are all caught up</Text>
                ) : (
                  sortedNotifications.map((notification) => {
                    const isFriendRequest = notification.type === 'friend_request';
                    const relatedUserId = notification.userid?.toString?.() || notification.userid;
                    return (
                      <View key={notification.id} style={styles.notificationItem}>
                        <View style={styles.notificationTextBlock}>
                          <Text style={styles.notificationItemTitle}>{notification.title || 'Notification'}</Text>
                          {notification.timestamp ? (
                            <Text style={styles.notificationTimestamp}>
                              {new Date(notification.timestamp).toLocaleString()}
                            </Text>
                          ) : null}
                          <Text style={styles.notificationMessage}>{notification.message || ''}</Text>
                        </View>
                        {isFriendRequest && relatedUserId ? (
                          <View style={styles.notificationActions}>
                            <TouchableOpacity
                              style={[styles.notificationActionButton, styles.notificationAccept]}
                              onPress={() => handleRespondToRequest(relatedUserId, 'accept')}
                            >
                              <Text style={styles.notificationActionText}>Accept</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.notificationActionButton, styles.notificationDecline]}
                              onPress={() => handleRespondToRequest(relatedUserId, 'reject')}
                            >
                              <Text style={[styles.notificationActionText, styles.notificationDeclineText]}>Decline</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </GlassCard>
            </View>
          )}

          {/* Friend Search */}
          <FriendSearchWidget onFriendUpdated={handleFriendStateChanged} />

          {/* Friend Requests */}
          <FriendRequestsWidget
            incoming={incomingRequests}
            outgoing={outgoingRequests}
            onAccept={(friendId) => handleRespondToRequest(friendId, 'accept')}
            onReject={(friendId) => handleRespondToRequest(friendId, 'reject')}
            processingId={requestProcessingId}
          />

          {/* Chat List */}
          <View style={styles.chatSection}>
            <ChatListWidget 
              chats={chats}
              isLoading={chatsLoading}
              onRefresh={handleChatRefresh}
              userStatuses={userStatuses}
              onRemoveFriend={handleRemoveFriend}
              removingFriendId={removingFriendId}
            />
          </View>
        </SafeAreaView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#03040A', // Dark theme to match login
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerCard: {
    padding: 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  titleContainer: {
    flex: 1,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  moreButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButton: {
    position: 'relative',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  profileStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderWidth: 2,
    borderColor: '#03040A',
  },
  notificationsOverlay: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  notificationsCard: {
    marginHorizontal: 0,
  },
  notificationsTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  notificationsEmpty: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  notificationItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  notificationTextBlock: {
    marginBottom: 8,
  },
  notificationItemTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationTimestamp: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginBottom: 4,
  },
  notificationMessage: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  notificationActionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationAccept: {
    backgroundColor: '#2C82FF',
  },
  notificationDecline: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  notificationActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  notificationDeclineText: {
    color: '#FF6B6B',
  },
  chatSection: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
