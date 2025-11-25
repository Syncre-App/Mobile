import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Alert,
  DeviceEventEmitter,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBackground } from '../components/AppBackground';
import { ChatListWidget } from '../components/ChatListWidget';
import { FriendRequestsWidget } from '../components/FriendRequestsWidget';
import { FriendSearchWidget } from '../components/FriendSearchWidget';
import { GlassCard } from '../components/GlassCard';
import { UserAvatar } from '../components/UserAvatar';
import { layout, palette, radii, spacing } from '../theme/designSystem';
import { ApiService } from '../services/ApiService';
import { ChatService } from '../services/ChatService';
import { NotificationService } from '../services/NotificationService';
import { PushService } from '../services/PushService';
import { StorageService } from '../services/StorageService';
import { UserCacheService } from '../services/UserCacheService';
import { UserStatus, WebSocketMessage, WebSocketService } from '../services/WebSocketService';

export const HomeScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);
  const [chatUnreadCounts, setChatUnreadCounts] = useState<Record<string, number>>({});
  const [totalUnreadChats, setTotalUnreadChats] = useState(0);
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

  const persistNotifications = useCallback((list: any[]) => {
    const minimized = list.map((notification: any) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      userid: notification.userid?.toString?.() ?? notification.userid,
      timestamp: notification.timestamp,
      read: Boolean(notification.read),
    }));
    StorageService.setObject('notifications_cache', minimized).catch(() => {});
  }, []);

  const removeNotificationLocally = useCallback(
    (notificationId: string) => {
      if (!notificationId) {
        return;
      }
      setNotifications((prev: any[]) => {
        const next = prev.filter((notification) => notification.id !== notificationId);
        persistNotifications(next);
        return next;
      });
    },
    [persistNotifications]
  );

  const loadUnreadSummary = useCallback(async () => {
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        setChatUnreadCounts({});
        setTotalUnreadChats(0);
        try {
          await Notifications.setBadgeCountAsync(0);
        } catch (err) {
          console.warn('[HomeScreen] Failed to update badge count:', err);
        }
        return;
      }

      const response = await ApiService.get('/chat/unread/summary', token);
      if (response.success && response.data) {
        const mapping = response.data.chats || {};
        const normalized = Object.keys(mapping).reduce((acc, key) => {
          const value = Number(mapping[key]) || 0;
          if (value > 0) {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, number>);
        setChatUnreadCounts(normalized);
        const total = Number(
          response.data.total ??
            Object.values(normalized).reduce((sum, val) => sum + val, 0)
        );
        setTotalUnreadChats(total);
        try {
          await Notifications.setBadgeCountAsync(total);
        } catch (err) {
          console.warn('[HomeScreen] Failed to update badge count:', err);
        }
      } else {
        setChatUnreadCounts({});
        setTotalUnreadChats(0);
        try {
          await Notifications.setBadgeCountAsync(0);
        } catch (err) {
          console.warn('[HomeScreen] Failed to reset badge count:', err);
        }
      }
    } catch (error) {
      console.error('Failed to load unread summary:', error);
    }
  }, []);
  type UnreadMap = Record<string, number>;
  const computeUnreadTotal = (map: UnreadMap) =>
    Object.values(map).reduce((sum: number, val: number) => sum + val, 0);

  const updateLocalUnread = useCallback(
    async (updater: UnreadMap | ((prev: UnreadMap) => UnreadMap)) => {
      setChatUnreadCounts((prev) => {
        const next: UnreadMap = typeof updater === 'function' ? (updater as (p: UnreadMap) => UnreadMap)(prev) : updater;
        const total = computeUnreadTotal(next);
        setTotalUnreadChats(total);
        Notifications.setBadgeCountAsync(total).catch((err) =>
          console.warn('[HomeScreen] Failed to sync badge from local update:', err)
        );
        return next;
      });
    },
    []
  );

  const cacheUsers = useCallback(
    (users: any[], opts: { updateStatus?: boolean } = { updateStatus: true }) => {
      if (!users?.length) return;
      const normalized = users
        .filter(Boolean)
        .map((user) => ({
          id: user.id?.toString?.() ?? String(user.id),
          username: user.username || '',
          email: user.email || '',
          profile_picture: user.profile_picture || null,
          status: user.status || null,
        }));

      UserCacheService.addUsers(normalized as any[]);

      if (opts.updateStatus) {
        setUserStatuses((prev: any) => {
          const next = { ...prev };
          normalized.forEach((user) => {
            if (user.status) {
              next[user.id] = user.status;
            }
          });
          return next;
        });
      }
    },
    []
  );

  const ensureNotificationUsers = useCallback(async (items: any[], token?: string | null) => {
    if (!Array.isArray(items) || items.length === 0) return;

    const missingIds = new Set<string>();

    items.forEach((notification) => {
      const relatedId = notification?.userid?.toString?.() ?? notification?.userid;
      if (relatedId) {
        const normalized = String(relatedId);
        const cached = UserCacheService.getUser(normalized);
        if (!cached) {
          missingIds.add(normalized);
        }
      }
    });

    if (!missingIds.size || !token) {
      return;
    }

    await Promise.allSettled(
      Array.from(missingIds).map(async (userId) => {
        try {
          const response = await ApiService.get(`/user/${userId}`, token);
          if (response.success && response.data) {
            cacheUsers([response.data]);
          }
        } catch (error) {
          console.warn('[notifications] Unable to hydrate user', userId, error);
        }
      })
    );
  }, [cacheUsers]);

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
          if (Array.isArray(response.data.chats)) {
            response.data.chats.forEach((chat: any) => {
              if (Array.isArray(chat.participants)) {
                UserCacheService.addUsers(
                  chat.participants.map((participant: any) => ({
                    ...participant,
                    id: participant.id?.toString?.() ?? String(participant.id),
                  }))
                );
              }
            });
          }
        } else {
          console.warn('loadChats: failed to fetch chats:', response.error);
        }
        WebSocketService.getInstance().refreshFriendsStatus();
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

        if (Array.isArray(response.data.friends)) {
          cacheUsers(response.data.friends as any[]);
        }
        cacheUsers(normalizedIncoming as any[], { updateStatus: false });
        cacheUsers(normalizedOutgoing as any[], { updateStatus: false });

        incomingRequestsRef.current = normalizedIncoming;
        outgoingRequestsRef.current = normalizedOutgoing;
        setIncomingRequests(normalizedIncoming);
        setOutgoingRequests(normalizedOutgoing);
        WebSocketService.getInstance().refreshFriendsStatus();
      }
    } catch (error) {
      console.error('Failed to load friend data:', error);
    }
  }, [cacheUsers]);

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    const buildFallbackNotifications = () => {
      const incoming = incomingRequestsRef.current.map((item: any) => ({
        id: `incoming-${item?.id}`,
        type: 'friend_request',
        title: `${item.username || 'Someone'} sent you a friend request`,
        userid: item?.id,
        message: 'Tap to accept or decline this request.',
        timestamp: new Date().toISOString(),
      }));

      const outgoing = outgoingRequestsRef.current.map((item: any) => ({
        id: `outgoing-${item?.id}`,
        type: 'friend_request_outgoing',
        title: `Pending request to ${item.username || 'user'}`,
        userid: item?.id,
        message: 'Waiting for the other user to respond.',
        timestamp: new Date().toISOString(),
      }));

      cacheUsers(incomingRequestsRef.current as any[], { updateStatus: false });
      cacheUsers(outgoingRequestsRef.current as any[], { updateStatus: false });

      const generated = [...incoming, ...outgoing];
      persistNotifications(generated);
      return generated;
    };

    try {
      const token = await StorageService.getAuthToken();
      const cachedNotifications = await StorageService.getObject<any[]>('notifications_cache');
      if (cachedNotifications && cachedNotifications.length) {
        setNotifications(cachedNotifications);
      }

      if (!token) {
        if (!cachedNotifications) {
          setNotifications(buildFallbackNotifications());
        }
        return;
      }

      const response = await ApiService.get('/user/notifications', token);
      if (response.success && response.data) {
        const items = Array.isArray(response.data.notifications) ? response.data.notifications : [];
        console.log('🔔 Notifications response data:', response.data);
        console.log('🔔 Notifications fetched:', items);
        await ensureNotificationUsers(items, token);
        setNotifications(items);
        persistNotifications(items);
        return;
      }

      if (response.statusCode === 404 || response.statusCode === 401) {
        const fallback = buildFallbackNotifications();
        console.log('🔔 Notifications endpoint returned', response.statusCode, '- using fallback list');
        await ensureNotificationUsers(fallback, token);
        setNotifications(fallback);
        persistNotifications(fallback);
        return;
      }

      console.warn('🔔 Failed to fetch notifications:', response.error);
      console.log('🔔 Full response:', response);
      const fallback = buildFallbackNotifications();
      await ensureNotificationUsers(fallback, token);
      setNotifications(fallback);
      persistNotifications(fallback);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      const fallback = buildFallbackNotifications();
      const token = await StorageService.getAuthToken();
      await ensureNotificationUsers(fallback, token);
      setNotifications(fallback);
      persistNotifications(fallback);
    } finally {
      setNotificationsLoading(false);
    }
  }, [ensureNotificationUsers, persistNotifications, cacheUsers]);

  const initializeScreen = useCallback(async () => {
    try {
      const userData: any = await StorageService.getObject('user_data');
      setUser(userData);
      if (userData && userData.id) {
        cacheUsers([userData]);
      }
      
      // Also fetch current user data from API to ensure we have latest info
      const token = await StorageService.getAuthToken();
      if (token) {
        const response = await ApiService.get('/user/me', token);
        if (response.success && response.data) {
          console.log('🔍 User data from API:', JSON.stringify(response.data, null, 2));
          setUser(response.data);
          // Update stored user data
          await StorageService.setObject('user_data', response.data);
          cacheUsers([response.data]);
          WebSocketService.getInstance().refreshFriendsStatus();
        }
      }
      
      await loadChats();
      await loadFriendData();
      await loadNotifications();
      await loadUnreadSummary();
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  }, [loadChats, loadFriendData, loadNotifications, loadUnreadSummary, cacheUsers]);

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
        PushService.registerForPushNotifications();
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

  useEffect(() => {
    const hydrateUserCache = async () => {
      await UserCacheService.hydrate();
      const users = UserCacheService.getAllUsers();
      if (users.length) {
        cacheUsers(users, { updateStatus: false });
        setUserStatuses((prev: any) => {
          const next = { ...prev };
          users.forEach((user: any) => {
            if (user.status) {
              next[user.id] = user.status;
            }
          });
          return next;
        });
      }
    };

    hydrateUserCache();
  }, [cacheUsers]);
  
  useEffect(() => {
    validateTokenAndInit();
  }, [validateTokenAndInit]);

  useEffect(() => {
    const wsInstance = WebSocketService.getInstance();
    const applyStatuses = (statuses: UserStatus) => {
      setUserStatuses((prev: any) => ({ ...prev, ...statuses }));
    };

    applyStatuses(wsInstance.getUserStatuses());
    const unsubscribe = wsInstance.addStatusListener(applyStatuses);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        PushService.registerForPushNotifications();
        WebSocketService.getInstance().refreshFriendsStatus();
        loadUnreadSummary();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [ensureNotificationUsers, loadUnreadSummary]);

  const markNotificationAsRead = useCallback(
    async (notificationId: string) => {
      if (!notificationId) {
        return;
      }

      removeNotificationLocally(notificationId);

      try {
        const token = await StorageService.getAuthToken();
        if (!token) {
          return;
        }

        const response = await ApiService.post(
          '/user/notifications/read',
          { notificationId },
          token
        );

        if (response.success && response.data) {
          const items = Array.isArray(response.data.notifications) ? response.data.notifications : [];
          await ensureNotificationUsers(items, token);
          setNotifications(items);
          persistNotifications(items);
        }
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    },
    [ensureNotificationUsers, persistNotifications, removeNotificationLocally]
  );

  const handleRefresh = useCallback(async () => {
    await initializeScreen();
  }, [initializeScreen]);

  const handleProfilePress = () => {
    router.push('/profile');
  };

  const handleMarkChatRead = useCallback(
    async (chatId: string) => {
      if (!chatId) return;
      updateLocalUnread((prev) => {
        const next = { ...prev };
        delete next[chatId];
        return next;
      });
      try {
        const token = await StorageService.getAuthToken();
        if (token) {
          await ApiService.post(`/chat/${chatId}/seen`, {}, token);
        }
      } catch (error) {
        console.warn('[HomeScreen] Failed to mark chat as read:', error);
      }
    },
    [updateLocalUnread]
  );

  const handleMarkChatUnread = useCallback(
    (chatId: string) => {
      if (!chatId) return;
      updateLocalUnread((prev) => ({
        ...prev,
        [chatId]: (prev[chatId] || 0) + 1,
      }));
    },
    [updateLocalUnread]
  );

  const handleFriendStateChanged = useCallback(async () => {
    await Promise.all([loadFriendData(), loadChats(), loadNotifications(), loadUnreadSummary()]);
    WebSocketService.getInstance().refreshFriendsStatus();
  }, [loadChats, loadFriendData, loadNotifications, loadUnreadSummary]);

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
      Alert.alert(
        'Delete group',
        `Are you sure you want to delete ${chat.name || 'this group'}?`,
        [
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
        ]
      );
    },
    [loadChats]
  );

  const handleRespondToRequest = useCallback(async (friendId: string, action: 'accept' | 'reject', options?: { notificationId?: string }) => {
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

        if (options?.notificationId) {
          removeNotificationLocally(options.notificationId);
        }

        await Promise.all([loadFriendData(), loadNotifications(), loadUnreadSummary()]);
      } else {
        NotificationService.show('error', response.error || 'Failed to update request');
      }
    } catch (error) {
      console.error('Failed to respond to friend request:', error);
      NotificationService.show('error', 'Failed to update request');
    } finally {
      setRequestProcessingId(null);
    }
  }, [loadChats, loadFriendData, loadNotifications, loadUnreadSummary, removeNotificationLocally]);

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
        await Promise.all([loadFriendData(), loadChats(), loadNotifications(), loadUnreadSummary()]);
      } else {
        NotificationService.show('error', response.error || 'Failed to remove friend');
      }
    } catch (error) {
      console.error('Failed to remove friend:', error);
      NotificationService.show('error', 'Failed to remove friend');
    } finally {
      setRemovingFriendId(null);
    }
  }, [loadChats, loadFriendData, loadNotifications, loadUnreadSummary]);

  const handleChatRefresh = useCallback(async () => {
    await Promise.all([loadChats(), loadFriendData(), loadNotifications(), loadUnreadSummary()]);
  }, [loadChats, loadFriendData, loadNotifications, loadUnreadSummary]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationsPress = useCallback(() => {
    setIsNotificationsVisible((prev) => !prev);
  }, []);

  const handleNotificationPress = useCallback(
    (notification: any) => {
      if (notification.type === 'friend_request') {
        return;
      }
      markNotificationAsRead(notification.id);
    },
    [markNotificationAsRead]
  );

  useEffect(() => {
    const unsubscribe = PushService.addNotificationListeners(() => {
      loadNotifications();
      loadUnreadSummary();
    });
    return unsubscribe;
  }, [loadNotifications, loadUnreadSummary]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('unread:refresh', () => {
      loadUnreadSummary();
    });
    return () => {
      subscription.remove();
    };
  }, [loadUnreadSummary]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('chats:refresh', () => {
      loadChats();
    });
    return () => {
      subscription.remove();
    };
  }, [loadChats]);

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
      case 'chat_group_created':
      case 'chat_updated':
      case 'chat_members_added':
      case 'chat_members_removed':
      case 'chat_deleted':
      case 'chat_removed': {
        loadChats();
        break;
      }
      case 'message_envelope':
      case 'new_message': {
        loadUnreadSummary();
        break;
      }
      case 'message_status': {
        loadUnreadSummary();
        break;
      }
      default:
        break;
    }
  }, [handleFriendStateChanged, handleRespondToRequest, loadNotifications, loadUnreadSummary]);

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
      <AppBackground />
      
      {isValidatingToken ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={styles.loadingText}>Validating session...</Text>
        </View>
      ) : (
        <SafeAreaView
          style={[
            styles.safeArea,
            {
              paddingTop: Math.max(
                insets.top,
                Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 0
              ),
            },
          ]}
          edges={['left', 'right']}
        >
          <View style={styles.topBar}>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.notificationButton}
                onPress={handleNotificationsPress}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={isNotificationsVisible ? 'notifications' : 'notifications-outline'}
                  size={22}
                  color={palette.text}
                />
                {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.profileButton} onPress={handleProfilePress}>
                <UserAvatar
                  uri={user?.profile_picture}
                  name={user?.username || user?.name || user?.email}
                  size={46}
                  presence={isOnline ? 'online' : 'offline'}
                  presencePlacement="overlay"
                  style={styles.profileAvatar}
                />
              </TouchableOpacity>
            </View>
          </View>

          {isNotificationsVisible && (
            <View style={styles.notificationsOverlay}>
              <GlassCard width="100%" style={styles.notificationsCard}>
                <View style={styles.notificationsHeader}>
                  <Text style={styles.notificationsTitle}>Notifications</Text>
                  <TouchableOpacity
                    onPress={() => setIsNotificationsVisible(false)}
                    style={styles.notificationCloseButton}
                    accessibilityRole="button"
                  >
                    <Ionicons name="close" size={18} color="#ffffff" />
                  </TouchableOpacity>
                </View>
                {notificationsLoading ? (
                  <View style={styles.notificationSkeletons}>
                    {[0, 1, 2].map((key) => (
                      <View key={`notif-skel-${key}`} style={styles.notificationSkeletonRow}>
                        <View style={styles.notificationSkeletonAvatar} />
                        <View style={styles.notificationSkeletonBody}>
                          <View style={styles.notificationSkeletonLineWide} />
                          <View style={styles.notificationSkeletonLine} />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : sortedNotifications.length === 0 ? (
                  <Text style={styles.notificationsEmpty}>You are all caught up</Text>
                ) : (
                  sortedNotifications.map((notification) => {
                    const isFriendRequest = notification.type === 'friend_request';
                    const relatedUserId = notification.userid?.toString?.() || notification.userid;
                    const relatedUser =
                      relatedUserId ? UserCacheService.getUser(String(relatedUserId)) : null;

                    return (
                      <TouchableOpacity
                        key={notification.id}
                        style={styles.notificationItem}
                        activeOpacity={0.85}
                        onPress={() => handleNotificationPress(notification)}
                      >
                        <UserAvatar
                          uri={relatedUser?.profile_picture}
                          name={relatedUser?.username || notification.title}
                          size={44}
                          style={styles.notificationAvatar}
                        />
                        <View style={styles.notificationBody}>
                          <View style={styles.notificationTextBlock}>
                            <Text style={styles.notificationItemTitle}>
                              {notification.title || 'Notification'}
                            </Text>
                            {notification.timestamp ? (
                              <Text style={styles.notificationTimestamp}>
                                {new Date(notification.timestamp).toLocaleString()}
                              </Text>
                            ) : null}
                            {notification.message ? (
                              <Text style={styles.notificationMessage}>{notification.message}</Text>
                            ) : null}
                          </View>
                          {isFriendRequest && relatedUserId ? (
                            <View style={styles.notificationActions}>
                              <TouchableOpacity
                                style={[styles.notificationActionButton, styles.notificationAccept]}
                                onPress={() =>
                                  handleRespondToRequest(String(relatedUserId), 'accept', {
                                    notificationId: notification.id,
                                  })
                                }
                              >
                                <Text style={styles.notificationActionText}>Accept</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.notificationActionButton, styles.notificationDecline]}
                                onPress={() =>
                                  handleRespondToRequest(String(relatedUserId), 'reject', {
                                    notificationId: notification.id,
                                  })
                                }
                              >
                                <Text style={[styles.notificationActionText, styles.notificationDeclineText]}>
                                  Decline
                                </Text>
                              </TouchableOpacity>
                            </View>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </GlassCard>
            </View>
          )}
          <View style={styles.mainColumn}>
            <View style={styles.searchSection}>
              <FriendSearchWidget onFriendUpdated={handleFriendStateChanged} showHeader={false} />
            </View>

            {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
              <View style={styles.section}>
                <FriendRequestsWidget
                  incoming={incomingRequests}
                  outgoing={outgoingRequests}
                  onAccept={(friendId) => handleRespondToRequest(friendId, 'accept')}
                  onReject={(friendId) => handleRespondToRequest(friendId, 'reject')}
                  processingId={requestProcessingId}
                />
              </View>
            )}

            <View style={[styles.section, styles.chatSection]}>
              <ChatListWidget
                chats={chats}
                isLoading={chatsLoading}
                onRefresh={handleChatRefresh}
                userStatuses={userStatuses}
                onRemoveFriend={handleRemoveFriend}
                removingFriendId={removingFriendId}
                unreadCounts={chatUnreadCounts}
                onEditGroup={handleEditGroup}
                onDeleteGroup={handleDeleteGroup}
                onMarkRead={handleMarkChatRead}
                onMarkUnread={handleMarkChatUnread}
              />
            </View>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  mainColumn: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: palette.text,
    marginTop: spacing.sm,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Medium',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  notificationButton: {
    position: 'relative',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxs,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  notificationSkeletons: {
    gap: spacing.sm,
  },
  notificationSkeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  notificationSkeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  notificationSkeletonBody: {
    flex: 1,
    gap: 6,
  },
  notificationSkeletonLineWide: {
    height: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    width: '80%',
  },
  notificationSkeletonLine: {
    height: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    width: '60%',
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  profileAvatar: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  notificationsOverlay: {
    position: 'absolute',
    top: 120,
    right: spacing.lg,
    alignSelf: 'flex-end',
    paddingHorizontal: 0,
    zIndex: 30,
    minWidth: 260,
    maxWidth: '85%',
  },
  notificationsCard: {
    marginHorizontal: 0,
  },
  notificationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  notificationCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  notificationsTitle: {
    color: palette.text,
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  notificationsEmpty: {
    color: palette.textMuted,
    fontSize: 14,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  notificationAvatar: {
    marginTop: 2,
  },
  notificationBody: {
    flex: 1,
  },
  notificationTextBlock: {
    marginBottom: spacing.xs,
  },
  notificationItemTitle: {
    color: palette.text,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-SemiBold',
    marginBottom: 4,
  },
  notificationTimestamp: {
    color: palette.textSubtle,
    fontSize: 12,
    marginBottom: 4,
  },
  notificationMessage: {
    color: palette.textMuted,
    fontSize: 14,
  },
  notificationActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  notificationActionButton: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationAccept: {
    backgroundColor: palette.accent,
  },
  notificationDecline: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  notificationActionText: {
    color: palette.text,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  notificationDeclineText: {
    color: palette.error,
  },
  section: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  searchSection: {
    marginBottom: spacing.lg,
  },
  chatSection: {
    flex: 1,
  },
  sectionBadge: {
    alignSelf: 'flex-end',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 1.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
  },
  sectionBadgeText: {
    color: palette.accentSecondary,
    fontSize: 13,
    fontFamily: 'SpaceGrotesk-Medium',
  },
});
