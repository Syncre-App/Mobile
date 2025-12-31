import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NativeTabs, Icon, Label, Badge } from 'expo-router/unstable-native-tabs';
import { DynamicColorIOS, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ApiService } from '../../services/ApiService';
import { StorageService } from '../../services/StorageService';
import { UserCacheService } from '../../services/UserCacheService';
import { WebSocketService, WebSocketMessage, UserStatus } from '../../services/WebSocketService';
import { PushService } from '../../services/PushService';

// ═══════════════════════════════════════════════════════════════
// Chat Context - Shared state across tabs
// ═══════════════════════════════════════════════════════════════

interface ChatContextValue {
  user: any;
  setUser: React.Dispatch<React.SetStateAction<any>>;
  chats: any[];
  setChats: React.Dispatch<React.SetStateAction<any[]>>;
  chatsLoading: boolean;
  setChatsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  incomingRequests: any[];
  setIncomingRequests: React.Dispatch<React.SetStateAction<any[]>>;
  outgoingRequests: any[];
  setOutgoingRequests: React.Dispatch<React.SetStateAction<any[]>>;
  userStatuses: UserStatus;
  setUserStatuses: React.Dispatch<React.SetStateAction<UserStatus>>;
  chatUnreadCounts: Record<string, number>;
  setChatUnreadCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  totalUnreadChats: number;
  setTotalUnreadChats: React.Dispatch<React.SetStateAction<number>>;
  chatStreaks: Record<string, any>;
  setChatStreaks: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  isOnline: boolean;
  setIsOnline: React.Dispatch<React.SetStateAction<boolean>>;
  blockedSet: Set<string>;
  // Actions
  loadChats: () => Promise<boolean>;
  loadFriendData: () => Promise<boolean>;
  loadUnreadSummary: (skipDebounce?: boolean) => Promise<boolean>;
  handleRefresh: () => Promise<void>;
  cacheUsers: (users: any[], opts?: { updateStatus?: boolean }) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider');
  }
  return context;
};

// ═══════════════════════════════════════════════════════════════
// Tab Layout Component
// ═══════════════════════════════════════════════════════════════

export default function TabLayout() {
  // ─────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────
  const [user, setUser] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const [userStatuses, setUserStatuses] = useState<UserStatus>({});
  const [chatUnreadCounts, setChatUnreadCounts] = useState<Record<string, number>>({});
  const [totalUnreadChats, setTotalUnreadChats] = useState(0);
  const [chatStreaks, setChatStreaks] = useState<Record<string, any>>({});
  const [isOnline, setIsOnline] = useState(false);

  const unreadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatsLoadingRef = useRef(false);
  const unreadLoadingRef = useRef(false);
  const incomingRequestsRef = useRef<any[]>([]);
  const outgoingRequestsRef = useRef<any[]>([]);

  // ─────────────────────────────────────────────────────────────
  // Computed
  // ─────────────────────────────────────────────────────────────
  const blockedSet = useMemo<Set<string>>(
    () =>
      new Set<string>(
        Array.isArray(user?.blocked_users)
          ? user.blocked_users.map((id: any) => id?.toString?.() ?? String(id)).filter(Boolean)
          : []
      ),
    [user?.blocked_users]
  );

  // ─────────────────────────────────────────────────────────────
  // Cache Users
  // ─────────────────────────────────────────────────────────────
  const cacheUsers = useCallback(
    (users: any[], opts: { updateStatus?: boolean } = { updateStatus: true }) => {
      if (!users?.length) return;
      const normalized = users
        .filter(Boolean)
        .map((u) => ({
          id: u.id?.toString?.() ?? String(u.id),
          username: u.username || '',
          email: u.email || '',
          profile_picture: u.profile_picture || null,
          status: u.status || null,
        }));

      UserCacheService.addUsers(normalized as any[]);

      if (opts.updateStatus) {
        setUserStatuses((prev: any) => {
          const next = { ...prev };
          normalized.forEach((u) => {
            if (u.status) {
              next[u.id] = u.status;
            }
          });
          return next;
        });
      }
    },
    []
  );

  // ─────────────────────────────────────────────────────────────
  // Load Unread Summary
  // ─────────────────────────────────────────────────────────────
  const loadUnreadSummary = useCallback(async (skipDebounce = false) => {
    if (unreadLoadingRef.current && !skipDebounce) {
      return false;
    }

    if (unreadTimeoutRef.current) {
      clearTimeout(unreadTimeoutRef.current);
    }

    if (!skipDebounce) {
      unreadTimeoutRef.current = setTimeout(() => {
        loadUnreadSummary(true);
      }, 1000);
      return false;
    }

    unreadLoadingRef.current = true;
    let success = false;
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        setChatUnreadCounts({});
        setTotalUnreadChats(0);
        try {
          await Notifications.setBadgeCountAsync(0);
        } catch (err) {
          console.warn('[TabLayout] Failed to update badge count:', err);
        }
        return false;
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
          console.warn('[TabLayout] Failed to update badge count:', err);
        }
      } else {
        setChatUnreadCounts({});
        setTotalUnreadChats(0);
        try {
          await Notifications.setBadgeCountAsync(0);
        } catch (err) {
          console.warn('[TabLayout] Failed to reset badge count:', err);
        }
      }
      success = true;
    } catch (error) {
      console.error('Failed to load unread summary:', error);
      success = false;
    } finally {
      unreadLoadingRef.current = false;
    }
    return success;
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Load Chats
  // ─────────────────────────────────────────────────────────────
  const loadChats = useCallback(async (skipLoadingCheck = false) => {
    if (!skipLoadingCheck && chatsLoadingRef.current) {
      return false;
    }

    chatsLoadingRef.current = true;
    setChatsLoading(true);
    let success = false;
    try {
      const token = await StorageService.getAuthToken();
      if (token) {
        const response = await ApiService.get('/chat', token);
        if (response.success && response.data) {
          success = true;
          const chatList = response.data.chats || [];
          setChats(chatList);
          if (Array.isArray(chatList)) {
            chatList.forEach((chat: any) => {
              if (Array.isArray(chat.participants)) {
                UserCacheService.addUsers(
                  chat.participants.map((participant: any) => ({
                    ...participant,
                    id: participant.id?.toString?.() ?? String(participant.id),
                  }))
                );
              }
            });

            const chatIds = chatList.map((chat: any) => chat.id);
            if (chatIds.length > 0) {
              try {
                const streaksResponse = await ApiService.getStreaksForChats(chatIds, token);
                if (streaksResponse.success && streaksResponse.data?.streaks) {
                  setChatStreaks(streaksResponse.data.streaks);
                }
              } catch (streakErr) {
                console.warn('Failed to fetch streaks:', streakErr);
              }
            }
          }
        }
        WebSocketService.getInstance().refreshFriendsStatus();
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      chatsLoadingRef.current = false;
      setChatsLoading(false);
    }
    return success;
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Load Friend Data
  // ─────────────────────────────────────────────────────────────
  const loadFriendData = useCallback(async () => {
    let success = false;
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        return false;
      }

      const response = await ApiService.get('/user/friends', token);
      if (response.success && response.data) {
        success = true;
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
      success = false;
    }
    return success;
  }, [cacheUsers]);

  // ─────────────────────────────────────────────────────────────
  // Handle Refresh
  // ─────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    const token = await StorageService.getAuthToken();
    if (token) {
      const response = await ApiService.get('/user/me', token);
      if (response.success && response.data) {
        setUser(response.data);
        await StorageService.setObject('user_data', response.data);
        cacheUsers([response.data]);
      }
    }
    await Promise.all([loadChats(), loadFriendData(), loadUnreadSummary(true)]);
  }, [loadChats, loadFriendData, loadUnreadSummary, cacheUsers]);

  // ─────────────────────────────────────────────────────────────
  // Initialize
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const initialize = async () => {
      await UserCacheService.hydrate();

      const userData: any = await StorageService.getObject('user_data');
      setUser(userData);
      if (userData && userData.id) {
        cacheUsers([userData]);
      }

      const token = await StorageService.getAuthToken();
      if (token) {
        const response = await ApiService.get('/user/me', token);
        if (response.success && response.data) {
          setUser(response.data);
          await StorageService.setObject('user_data', response.data);
          cacheUsers([response.data]);
        }
      }

      await Promise.all([loadChats(), loadFriendData(), loadUnreadSummary(true)]);

      // Connect WebSocket
      try {
        const wsService = WebSocketService.getInstance();
        await wsService.connect();
        setIsOnline(true);
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setIsOnline(false);
      }

      PushService.registerForPushNotifications();
    };

    initialize();
  }, [cacheUsers, loadChats, loadFriendData, loadUnreadSummary]);

  // ─────────────────────────────────────────────────────────────
  // WebSocket Status Listener
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // WebSocket Message Listener
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const wsService = WebSocketService.getInstance();

    const handleRealtimeMessage = (message: WebSocketMessage) => {
      if (!message || !message.type) return;

      switch (message.type) {
        case 'friend_request_received':
        case 'friend_request_accepted':
        case 'friend_request_declined':
        case 'friend_removed':
          loadFriendData();
          loadChats();
          break;
        case 'chat_group_created':
        case 'chat_updated':
        case 'chat_members_added':
        case 'chat_members_removed':
        case 'chat_deleted':
        case 'chat_removed':
          loadChats();
          break;
        case 'message_envelope':
        case 'new_message':
        case 'message_status':
          loadUnreadSummary();
          break;
        case 'streak_update': {
          const { chatId, currentStreak, longestStreak, participantsActive, lastActivityDate } = message as any;
          if (chatId) {
            setChatStreaks((prev) => ({
              ...prev,
              [chatId.toString()]: {
                chatId,
                currentStreak,
                longestStreak,
                participantsActive,
                lastActivityDate,
              },
            }));
          }
          break;
        }
        default:
          break;
      }
    };

    const unsubscribe = wsService.addMessageListener(handleRealtimeMessage);
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loadChats, loadFriendData, loadUnreadSummary]);

  // ─────────────────────────────────────────────────────────────
  // Context Value
  // ─────────────────────────────────────────────────────────────
  const contextValue: ChatContextValue = {
    user,
    setUser,
    chats,
    setChats,
    chatsLoading,
    setChatsLoading,
    incomingRequests,
    setIncomingRequests,
    outgoingRequests,
    setOutgoingRequests,
    userStatuses,
    setUserStatuses,
    chatUnreadCounts,
    setChatUnreadCounts,
    totalUnreadChats,
    setTotalUnreadChats,
    chatStreaks,
    setChatStreaks,
    isOnline,
    setIsOnline,
    blockedSet,
    loadChats,
    loadFriendData,
    loadUnreadSummary,
    handleRefresh,
    cacheUsers,
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  const unreadBadge = totalUnreadChats > 0 ? (totalUnreadChats > 99 ? '99+' : String(totalUnreadChats)) : undefined;
  const friendRequestsBadge = incomingRequests.length > 0 ? String(incomingRequests.length) : undefined;

  return (
    <ChatContext.Provider value={contextValue}>
      <NativeTabs
        minimizeBehavior="onScrollDown"
        disableTransparentOnScrollEdge
        {...(Platform.OS === 'ios' && {
          labelStyle: {
            color: DynamicColorIOS({
              dark: 'white',
              light: 'black',
            }),
          },
          tintColor: DynamicColorIOS({
            dark: 'white',
            light: 'black',
          }),
        })}
      >
        <NativeTabs.Trigger name="index">
          <Icon sf={{ default: 'message', selected: 'message.fill' }} drawable="ic_chat" />
          <Label>Chats</Label>
          {unreadBadge && <Badge>{unreadBadge}</Badge>}
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="friends" role="search">
          <Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} drawable="ic_friends" />
          <Label>Friends</Label>
          {friendRequestsBadge && <Badge>{friendRequestsBadge}</Badge>}
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <Icon sf={{ default: 'person.circle', selected: 'person.circle.fill' }} drawable="ic_profile" />
          <Label>Profile</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ChatContext.Provider>
  );
}
