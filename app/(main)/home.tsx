import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen } from '../../components/Screen';
import { AppBackground } from '../../components/AppBackground';
import { GlassPanel } from '../../components/GlassPanel';
import { Avatar } from '../../components/Avatar';
import { Field } from '../../components/Field';
import { font, spacing, useTheme } from '../../theme/designSystem';
import { ApiService } from '../../services/ApiService';
import { StorageService } from '../../services/StorageService';
import { NotificationService } from '../../services/NotificationService';
import { useAuth } from '../../hooks/useAuth';
import { webSocketService } from '../../services/WebSocketService';

type Chat = {
  id: number;
  isGroup?: boolean;
  name?: string | null;
  displayName?: string | null;
  participants?: any[];
  avatarUrl?: string | null;
  updated_at?: string;
};

type Friend = {
  id: string;
  username?: string;
  profile_picture?: string | null;
  status?: string | null;
  last_seen?: string | null;
};

type Notification = {
  id?: string | number;
  title?: string;
  message?: string;
  read?: boolean;
  timestamp?: string;
};

const TABS = ['chats', 'people', 'alerts'] as const;

export default function HomeScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('chats');
  const [chats, setChats] = useState<Chat[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<Friend[]>([]);
  const [outgoing, setOutgoing] = useState<Friend[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChats = async (token: string) => {
    const response = await ApiService.get('/chat', token);
    if (response.success && Array.isArray(response.data?.chats)) {
      setChats(response.data.chats);
    }
  };

  const loadUnreadSummary = async (token: string) => {
    const response = await ApiService.get('/chat/unread/summary', token);
    if (response.success && response.data?.chats) {
      setUnreadCounts(response.data.chats);
    }
  };

  const loadFriends = async (token: string) => {
    const response = await ApiService.get('/user/friends', token);
    if (response.success) {
      setFriends(response.data?.friends || []);
      setIncoming(response.data?.pending?.incoming || []);
      setOutgoing(response.data?.pending?.outgoing || []);
    }
  };

  const loadNotifications = async (token: string) => {
    const response = await ApiService.get('/user/notifications', token);
    if (response.success && Array.isArray(response.data?.notifications)) {
      setNotifications(response.data.notifications);
    }
  };

  const refreshAll = async () => {
    const token = await StorageService.getAuthToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    await Promise.all([loadChats(token), loadUnreadSummary(token), loadFriends(token), loadNotifications(token)]);
  };

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      await refreshUser();
      await refreshAll();
      webSocketService.connect().catch(() => {});
      setLoading(false);
    };
    bootstrap();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  const handleSearch = async () => {
    const token = await StorageService.getAuthToken();
    if (!token || !search.trim()) return;
    const response = await ApiService.get(`/user/search?q=${encodeURIComponent(search.trim())}`, token);
    if (response.success && Array.isArray(response.data?.users)) {
      setSearchResults(response.data.users);
    }
  };

  const handleAddFriend = async (id: string) => {
    const token = await StorageService.getAuthToken();
    if (!token) return;
    const response = await ApiService.post('/user/add', { friendId: id }, token);
    if (response.success) {
      NotificationService.show('success', 'Friend request sent.');
      await loadFriends(token);
    } else {
      NotificationService.show('error', response.error || 'Request failed.');
    }
  };

  const handleRespond = async (id: string, action: 'accept' | 'reject') => {
    const token = await StorageService.getAuthToken();
    if (!token) return;
    const response = await ApiService.post('/user/respond', { friendId: id, action }, token);
    if (response.success) {
      NotificationService.show('success', action === 'accept' ? 'Friend added.' : 'Request rejected.');
      await loadFriends(token);
    } else {
      NotificationService.show('error', response.error || 'Failed to respond.');
    }
  };

  const renderChatItem = ({ item }: { item: Chat }) => {
    const title = item.displayName || item.name || 'Chat';
    const unread = unreadCounts[item.id?.toString?.() ?? ''] || 0;
    const avatarName = item.isGroup ? title : item.participants?.find((p) => p.id !== user?.id)?.username;
    const avatarUri = item.isGroup
      ? item.avatarUrl
      : item.participants?.find((p) => p.id !== user?.id)?.profile_picture;

    return (
      <Pressable onPress={() => router.push(`/chat/${item.id}` as any)} style={styles.chatRow}>
        <Avatar uri={avatarUri} name={avatarName} size={46} />
        <View style={styles.chatInfo}>
          <Text style={styles.chatTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.chatSubtitle} numberOfLines={1}>
            Tap to continue
          </Text>
        </View>
        {unread > 0 ? (
          <View style={styles.unreadPill}>
            <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const directChatByUserId = useMemo(() => {
    const map = new Map<string, number>();
    chats.forEach((chat) => {
      if (chat.isGroup || !Array.isArray(chat.participants)) return;
      const other = chat.participants.find((p) => p.id?.toString?.() !== user?.id?.toString?.());
      if (other?.id) {
        map.set(other.id.toString(), chat.id);
      }
    });
    return map;
  }, [chats, user?.id]);

  const renderFriendItem = ({ item }: { item: Friend }) => {
    const chatId = directChatByUserId.get(item.id.toString());
    return (
      <View style={styles.friendRow}>
        <Avatar uri={item.profile_picture} name={item.username} size={42} />
        <View style={styles.chatInfo}>
          <Text style={styles.chatTitle}>{item.username || 'User'}</Text>
          <Text style={styles.chatSubtitle}>@{item.id}</Text>
        </View>
        {chatId ? (
          <Pressable onPress={() => router.push(`/chat/${chatId}` as any)} style={styles.iconButton}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.palette.text} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <View style={styles.notificationRow}>
      <Ionicons name="notifications" size={18} color={theme.palette.accent} />
      <View style={styles.chatInfo}>
        <Text style={styles.chatTitle}>{item.title || 'Update'}</Text>
        <Text style={styles.chatSubtitle}>{item.message || 'No details'}</Text>
      </View>
    </View>
  );

  const markAllRead = async () => {
    const token = await StorageService.getAuthToken();
    if (!token) return;
    await ApiService.post('/user/notifications/read', {}, token);
    await loadNotifications(token);
  };

  return (
    <Screen>
      <AppBackground />
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/profile')} style={styles.avatarButton}>
          <Avatar uri={user?.profile_picture} name={user?.username} size={44} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Hi {user?.username || 'there'}</Text>
          <Text style={styles.headerSubtitle}>Your space is ready.</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/group/create')} style={styles.iconButton}>
            <Ionicons name="add" size={20} color={theme.palette.text} />
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} style={styles.iconButton}>
            <Ionicons name="settings-outline" size={20} color={theme.palette.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabButton, active && styles.tabButtonActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab === 'chats' ? 'Chats' : tab === 'people' ? 'People' : 'Alerts'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <GlassPanel style={styles.contentPanel} glassEffectStyle="regular" isInteractive padding={0}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.palette.accent} />
          </View>
        ) : activeTab === 'chats' ? (
          <FlatList
            data={chats}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderChatItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No chats yet. Start a new group or wait for a friend.</Text>
            }
          />
        ) : activeTab === 'people' ? (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderFriendItem}
            ListHeaderComponent={
              <View style={styles.peopleHeader}>
                <Field
                  label="Find friends"
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="none"
                  trailing={
                    <Pressable onPress={handleSearch}>
                      <Ionicons name="search" size={18} color={theme.palette.textSubtle} />
                    </Pressable>
                  }
                />
                {searchResults.length ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Results</Text>
                    {searchResults.map((result) => (
                      <View key={result.id} style={styles.friendRow}>
                        <Avatar uri={result.profile_picture} name={result.username} size={40} />
                        <View style={styles.chatInfo}>
                          <Text style={styles.chatTitle}>{result.username || 'User'}</Text>
                          <Text style={styles.chatSubtitle}>@{result.id}</Text>
                        </View>
                        <Pressable onPress={() => handleAddFriend(result.id)} style={styles.actionPill}>
                          <Text style={styles.actionText}>Add</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
                {incoming.length ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Requests</Text>
                    {incoming.map((request) => (
                      <View key={request.id} style={styles.friendRow}>
                        <Avatar uri={request.profile_picture} name={request.username} size={40} />
                        <View style={styles.chatInfo}>
                          <Text style={styles.chatTitle}>{request.username || 'User'}</Text>
                          <Text style={styles.chatSubtitle}>wants to connect</Text>
                        </View>
                        <Pressable onPress={() => handleRespond(request.id, 'accept')} style={styles.actionPill}>
                          <Text style={styles.actionText}>Accept</Text>
                        </Pressable>
                        <Pressable onPress={() => handleRespond(request.id, 'reject')} style={styles.actionPillMuted}>
                          <Text style={styles.actionTextMuted}>Decline</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
                {outgoing.length ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Pending</Text>
                    {outgoing.map((request) => (
                      <View key={request.id} style={styles.friendRow}>
                        <Avatar uri={request.profile_picture} name={request.username} size={40} />
                        <View style={styles.chatInfo}>
                          <Text style={styles.chatTitle}>{request.username || 'User'}</Text>
                          <Text style={styles.chatSubtitle}>Request sent</Text>
                        </View>
                        <Ionicons name="time-outline" size={18} color={theme.palette.textSubtle} />
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            }
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          />
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item, index) => item.id?.toString?.() ?? `n-${index}`}
            renderItem={renderNotificationItem}
            ListHeaderComponent={
              notifications.length ? (
                <Pressable onPress={markAllRead} style={styles.markReadButton}>
                  <Text style={styles.markReadText}>Mark all read</Text>
                </Pressable>
              ) : null
            }
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          />
        )}
      </GlassPanel>
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      gap: spacing.md,
    },
    avatarButton: {
      borderRadius: theme.radii.full,
    },
    headerText: {
      flex: 1,
    },
    headerTitle: {
      color: theme.palette.text,
      fontSize: 20,
      ...font('semibold'),
    },
    headerSubtitle: {
      color: theme.palette.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceSoft,
    },
    headerActions: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    tabs: {
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.md,
    },
    tabButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.palette.surfaceSoft,
      alignItems: 'center',
    },
    tabButtonActive: {
      backgroundColor: theme.palette.surfaceStrong,
    },
    tabText: {
      color: theme.palette.textMuted,
      fontSize: 13,
      ...font('medium'),
    },
    tabTextActive: {
      color: theme.palette.text,
    },
    contentPanel: {
      marginTop: spacing.md,
      marginHorizontal: spacing.lg,
      flex: 1,
      padding: 0,
    },
    listContent: {
      padding: spacing.md,
      gap: spacing.md,
    },
    chatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.xs,
    },
    chatInfo: {
      flex: 1,
    },
    chatTitle: {
      color: theme.palette.text,
      fontSize: 15,
      ...font('semibold'),
    },
    chatSubtitle: {
      color: theme.palette.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    unreadPill: {
      minWidth: 26,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.palette.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unreadText: {
      color: theme.palette.text,
      fontSize: 12,
      ...font('semibold'),
    },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    notificationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    markReadButton: {
      alignSelf: 'flex-end',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.palette.surfaceSoft,
    },
    markReadText: {
      color: theme.palette.textMuted,
      fontSize: 12,
      ...font('medium'),
    },
    loading: {
      padding: spacing.lg,
      alignItems: 'center',
    },
    emptyText: {
      color: theme.palette.textMuted,
      fontSize: 13,
      textAlign: 'center',
      paddingVertical: spacing.md,
    },
    peopleHeader: {
      gap: spacing.md,
    },
    section: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    sectionTitle: {
      color: theme.palette.textSubtle,
      fontSize: 12,
      letterSpacing: 2,
      textTransform: 'uppercase',
      ...font('displayMedium'),
    },
    actionPill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.palette.accent,
    },
    actionPillMuted: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.palette.surfaceSoft,
    },
    actionText: {
      color: theme.palette.text,
      fontSize: 12,
      ...font('semibold'),
    },
    actionTextMuted: {
      color: theme.palette.textMuted,
      fontSize: 12,
      ...font('semibold'),
    },
  });
