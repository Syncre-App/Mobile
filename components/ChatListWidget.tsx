import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { UserCacheService } from '../services/UserCacheService';
import { UserStatus } from '../services/WebSocketService';
import { font, palette, radii, spacing } from '../theme/designSystem';
import { UserAvatar } from './UserAvatar';
import BadgeIcon from './BadgeIcon';
import { ProfileCard } from './ProfileCard';
import { NativeContextMenu, ContextMenuAction } from './NativeContextMenu';

interface Chat {
  id: number;
  users: string;
  created_at: string;
  updated_at: string;
  isGroup?: boolean;
  name?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  ownerId?: string | null;
  participants?: User[];
  lastMessage?: {
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
  };
  unreadCount?: number;
}

interface StreakData {
  chatId: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  participantsActive: Record<string, boolean>;
}

interface User {
  id: string;
  username: string;
  email: string;
  profile_picture?: string | null;
  status?: string | null;
  last_seen?: string | null;
  [key: string]: any;
}

interface ChatListWidgetProps {
  chats: Chat[];
  isLoading: boolean;
  onRefresh: () => void;
  userStatuses: UserStatus;
  onRemoveFriend: (friendId: string) => void;
  onReportUser: (userId: string) => void;
  onToggleBlock: (userId: string, isBlocked: boolean) => void;
  blockedUserIds?: Set<string>;
  removingFriendId?: string | null;
  unreadCounts?: Record<string, number>;
  streaks?: Record<string, StreakData>;
  onEditGroup?: (chat: Chat) => void;
  onDeleteGroup?: (chat: Chat) => void;
  onLeaveGroup?: (chat: Chat) => void;
  onMarkRead?: (chatId: string) => void;
}

export const ChatListWidget: React.FC<ChatListWidgetProps> = ({
  chats,
  isLoading,
  onRefresh,
  userStatuses,
  onRemoveFriend,
  onReportUser,
  onToggleBlock,
  blockedUserIds,
  removingFriendId = null,
  unreadCounts = {},
  streaks = {},
  onEditGroup = () => {},
  onDeleteGroup = () => {},
  onLeaveGroup = () => {},
  onMarkRead = () => {},
}) => {
  const insets = useSafeAreaInsets();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userDetails, setUserDetails] = useState<{ [key: string]: User }>({});
  const [profileCardUser, setProfileCardUser] = useState<User | null>(null);
  const [profileCardVisible, setProfileCardVisible] = useState(false);
  
  // Debug: log received chats
  useEffect(() => {
    console.log(`[ChatListWidget] Received ${chats.length} chats:`, chats.map(c => ({
      id: c.id,
      isGroup: c.isGroup,
      participantCount: c.participants?.length,
      userIds: (() => { try { return JSON.parse(c.users); } catch { return c.users; } })(),
    })));
  }, [chats]);
  
  // Ref to track userDetails for async operations
  const userDetailsRef = useRef<{ [key: string]: User }>({});
  
  // Keep ref in sync with state
  useEffect(() => {
    userDetailsRef.current = userDetails;
  }, [userDetails]);
  
  // Double-tap detection for DM chats
  const lastTapRef = useRef<{ chatId: string; timestamp: number } | null>(null);
  const pendingNavigationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DOUBLE_TAP_DELAY = 300; // ms
  
  const getCurrentUserId = async () => {
    try {
      const token = await StorageService.getAuthToken();
      if (token) {
        const response = await ApiService.get('/user/me', token);
        if (response.success && response.data) {
          setCurrentUserId(String(response.data.id));
        }
      }
    } catch (error) {
      console.log('❌ Error getting current user ID:', error);
    }
  };

  const fetchUserDetails = useCallback(async () => {
    try {
      const token = await StorageService.getAuthToken();
      if (!token || !currentUserId) return;

      // First, extract users directly from chat.participants (already hydrated by backend)
      const usersFromParticipants: { [key: string]: User } = {};
      const userIdsNeeded = new Set<string>();

      chats.forEach(chat => {
        // Get userIds from chat.users
        let chatUserIds: string[] = [];
        try {
          chatUserIds = JSON.parse(chat.users).map((id: string | number) => String(id));
        } catch (error) {
          console.log('Error parsing chat users:', error);
          return;
        }

        // If participants are available, use them directly
        if (Array.isArray(chat.participants) && chat.participants.length > 0) {
          chat.participants.forEach((participant) => {
            const participantId = String(participant.id);
            if (participantId !== currentUserId) {
              // Find the matching userIds entry for this participant
              // The participant.id might be padded (e.g., '0759724098076751')
              // but chatUserIds might have it without padding ('759724098076751')
              const matchingUserId = chatUserIds.find(uid => 
                uid === participantId || 
                uid === participantId.replace(/^0+/, '') ||
                participantId === uid.padStart(16, '0')
              );
              
              if (matchingUserId) {
                // Store under the userIds key (what we'll look up by)
                usersFromParticipants[matchingUserId] = {
                  ...participant,
                  id: matchingUserId, // Use the ID format from userIds
                } as User;
              } else {
                // Fallback: store under participant's own ID
                usersFromParticipants[participantId] = participant as User;
              }
            }
          });
        } else {
          // No participants, need to fetch these users
          chatUserIds.forEach(id => {
            if (id !== currentUserId) {
              userIdsNeeded.add(id);
            }
          });
        }
      });

      // Add users from participants to cache and state
      if (Object.keys(usersFromParticipants).length > 0) {
        UserCacheService.addUsers(Object.values(usersFromParticipants));
        setUserDetails(prev => ({ ...prev, ...usersFromParticipants }));
        userDetailsRef.current = { ...userDetailsRef.current, ...usersFromParticipants };
      }

      // Check which users still need to be fetched
      const currentDetails = userDetailsRef.current;
      const userIdsToFetch: string[] = [];
      
      for (const userId of userIdsNeeded) {
        const existing = currentDetails[userId];
        if (!existing || existing.username === 'Loading...') {
          userIdsToFetch.push(userId);
        }
      }

      if (userIdsToFetch.length === 0) return;

      console.log(`[ChatListWidget] Fetching ${userIdsToFetch.length} users:`, userIdsToFetch);

      // Fetch remaining users in parallel
      const fetchPromises = userIdsToFetch.map(async (userId) => {
        try {
          const response = await ApiService.getUserById(userId, token);
          if (response.success && response.data) {
            const userData: User = {
              ...response.data,
              id: userId, // Use the requested ID, not the DB ID
            };
            UserCacheService.addUser(userData);
            return { userId, userData };
          }
        } catch (error) {
          console.log(`Error fetching user ${userId}:`, error);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      
      // Collect successful fetches
      const fetchedUsers: { [key: string]: User } = {};
      for (const result of results) {
        if (result) {
          fetchedUsers[result.userId] = result.userData;
        }
      }

      // Update state with all fetched users at once
      if (Object.keys(fetchedUsers).length > 0) {
        console.log(`[ChatListWidget] Fetched ${Object.keys(fetchedUsers).length} users successfully`);
        setUserDetails(prev => ({ ...prev, ...fetchedUsers }));
      }
    } catch (error) {
      console.log('❌ Error fetching user details:', error);
    }
  }, [chats, currentUserId]);

  useEffect(() => {
    getCurrentUserId();
  }, []);

  useEffect(() => {
    if (chats.length > 0 && currentUserId) {
      fetchUserDetails();
    }
  }, [chats, currentUserId, fetchUserDetails]);

  useEffect(() => {
    if (!profileCardVisible || !profileCardUser?.id) return;
    const updatedUser = userDetails[profileCardUser.id];
    if (updatedUser && updatedUser !== profileCardUser) {
      setProfileCardUser(updatedUser);
    }
  }, [profileCardVisible, profileCardUser, userDetails]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const getOtherUserId = (chat: Chat): string | null => {
    if (!currentUserId) return null;
    try {
      const userIds = JSON.parse(chat.users);
      const otherUserId = userIds.find((id: string | number) => String(id) !== currentUserId);
      return otherUserId ? String(otherUserId) : null;
    } catch (error) {
      console.log('Error parsing chat users:', error);
      return null;
    }
  };

  const getChatDisplayName = (chat: Chat): string => {
    if (!currentUserId) return 'Loading...';
    
    const otherUserId = getOtherUserId(chat);
    if (!otherUserId) return 'Unknown User';

    // First try to get user from chat.participants (already hydrated by backend)
    const participantUser = chat.participants?.find(p => {
      const pId = String(p.id);
      return pId === otherUserId || 
             pId.replace(/^0+/, '') === otherUserId.replace(/^0+/, '');
    });
    
    if (participantUser) {
      return participantUser.username || 'Loading...';
    }

    // Fallback to userDetails state
    const user = userDetails[otherUserId];
    if (user) {
      return user.username || user.email || 'Loading...';
    }

    return 'Loading...';
  };

  const formatLastSeenLabel = (user?: User | null): string => {
    if (!user) return '';
    const lastSeen = user.last_seen;
    if (!lastSeen) return '';
    const parsed = Date.parse(lastSeen);
    if (Number.isNaN(parsed)) return '';
    const diffMs = Date.now() - parsed;
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return '';
    if (minutes < 3) return '';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  const getGroupDisplayName = (chat: Chat): string => {
    return chat.name || chat.displayName || 'Group chat';
  };

  const getGroupSubtitle = (chat: Chat): string => {
    if (!Array.isArray(chat.participants) || !chat.participants.length) {
      return '';
    }

    const names = chat.participants
      .filter((participant) => participant.id?.toString?.() !== currentUserId)
      .map((participant) => participant.username || participant.email || 'Member');

    const visible = names.slice(0, 3);
    let label = visible.join(', ');
    const remaining = names.length - visible.length;
    if (remaining > 0) {
      label = `${label} +${remaining}`;
    }
    return label;
  };

  const handleChatPress = (chat: Chat) => {
    const chatIdKey = chat.id?.toString?.() ?? String(chat.id);
    const now = Date.now();
    
    // For DM chats, check for double-tap to show ProfileCard
    if (!chat.isGroup) {
      const lastTap = lastTapRef.current;
      
      // Check if this is a double-tap
      if (lastTap && lastTap.chatId === chatIdKey && now - lastTap.timestamp < DOUBLE_TAP_DELAY) {
        // Double-tap detected - cancel pending navigation and show ProfileCard
        if (pendingNavigationRef.current) {
          clearTimeout(pendingNavigationRef.current);
          pendingNavigationRef.current = null;
        }
        lastTapRef.current = null;
        
        const otherUserId = getOtherUserId(chat);
        if (otherUserId) {
          const cachedUser = userDetails[otherUserId];
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setProfileCardUser(cachedUser || { id: otherUserId, username: 'Loading...', email: '' });
          setProfileCardVisible(true);
        }
        return;
      }
      
      // First tap - record it and schedule navigation after delay
      lastTapRef.current = { chatId: chatIdKey, timestamp: now };
      
      // Cancel any existing pending navigation
      if (pendingNavigationRef.current) {
        clearTimeout(pendingNavigationRef.current);
      }
      
      // Schedule navigation - will be cancelled if double-tap occurs
      pendingNavigationRef.current = setTimeout(() => {
        pendingNavigationRef.current = null;
        router.push({
          pathname: '/chat/[id]',
          params: { id: chatIdKey },
        } as any);
      }, DOUBLE_TAP_DELAY);
      
      return;
    }
    
    // For group chats, navigate immediately
    router.push({
      pathname: '/chat/[id]',
      params: { id: chatIdKey },
    } as any);
  };

  const handleChatLongPress = (chat: Chat) => {
    // Only handle long press for group chats
    // DM chats use NativeContextMenu instead
    if (!chat.isGroup) return;
    
    const chatIdKey = chat.id?.toString?.() ?? String(chat.id);
    const unread = unreadCounts[chatIdKey] || 0;
    const commonActions = [
      unread > 0 ? { text: 'Mark as read', onPress: () => onMarkRead(chatIdKey) } : null,
      { text: 'Cancel', style: 'cancel' as const },
    ].filter(Boolean) as { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[];

    const actions: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [];
    actions.push({ text: 'Leave group', style: 'destructive', onPress: () => onLeaveGroup(chat) });
    actions.push(...commonActions);

    Alert.alert('Group Options', getGroupDisplayName(chat), actions);
  };

  const handleProfileCardClose = () => {
    setProfileCardVisible(false);
    setProfileCardUser(null);
  };

  // Get context menu actions for DM chats
  const getDMContextMenuActions = (otherUserId: string, chatIdKey: string): ContextMenuAction[] => {
    const unread = unreadCounts[chatIdKey] || 0;
    const isUserBlocked = blockedUserIds?.has(otherUserId) ?? false;
    
    const actions: ContextMenuAction[] = [];
    
    if (unread > 0) {
      actions.push({
        title: 'Mark as read',
        systemIcon: 'checkmark.circle',
        onPress: () => onMarkRead(chatIdKey),
      });
    }
    
    actions.push({
      title: 'Remove friend',
      systemIcon: 'person.badge.minus',
      destructive: true,
      onPress: () => onRemoveFriend(otherUserId),
    });
    
    actions.push({
      title: isUserBlocked ? 'Unblock' : 'Block',
      systemIcon: isUserBlocked ? 'hand.raised.slash' : 'hand.raised',
      destructive: !isUserBlocked,
      onPress: () => onToggleBlock(otherUserId, isUserBlocked),
    });
    
    actions.push({
      title: 'Report',
      systemIcon: 'flag',
      onPress: () => onReportUser(otherUserId),
    });
    
    return actions;
  };

  const getPresenceForUser = (userId: string): 'online' | 'idle' | 'offline' => {
    const statusValue = userStatuses[userId] || userDetails[userId]?.status;
    const normalized = statusValue ? String(statusValue).toLowerCase() : 'offline';
    if (normalized === 'online') return 'online';
    if (normalized === 'idle') return 'idle';
    return 'offline';
  };

  const renderChatItem = ({ item: chat }: { item: Chat }) => {
    const isGroupChat = Boolean(chat.isGroup);
    const displayName = isGroupChat ? getGroupDisplayName(chat) : getChatDisplayName(chat);
    const otherUserId = isGroupChat ? null : getOtherUserId(chat);
    
    // Try to get user from chat.participants first (already hydrated by backend),
    // then fallback to userDetails state
    const cachedUser = otherUserId 
      ? (chat.participants?.find(p => {
          const pId = String(p.id);
          // Match with or without leading zeros
          return pId === otherUserId || 
                 pId.replace(/^0+/, '') === otherUserId.replace(/^0+/, '');
        }) || userDetails[otherUserId])
      : null;

    // Debug log for DM chats
    if (!isGroupChat) {
      console.log(`[ChatListWidget] Chat ${chat.id} DM:`, {
        otherUserId,
        displayName,
        cachedUserName: cachedUser?.username,
        cachedUserBadges: cachedUser?.badges,
        participantsCount: chat.participants?.length,
      });
    }
    const statusValueRaw =
      otherUserId && userStatuses[otherUserId]
        ? userStatuses[otherUserId]
        : cachedUser?.status;
    const normalizedStatus = statusValueRaw
      ? String(statusValueRaw).toLowerCase()
      : 'offline';
    const isUserOnline = !isGroupChat && normalizedStatus === 'online';
    const lastSeenLabel = !isGroupChat ? formatLastSeenLabel(cachedUser) : '';
    const isRemoving = !isGroupChat && removingFriendId === otherUserId;
    const chatIdKey = chat.id?.toString?.() ?? String(chat.id);
    const unread = unreadCounts[chatIdKey] || 0;
    const hasUnread = unread > 0;
    const avatarUri = isGroupChat
      ? chat.avatarUrl || undefined
      : (cachedUser as User | undefined)?.profile_picture || undefined;
    const groupSubtitle = isGroupChat ? getGroupSubtitle(chat) : null;
    const presenceValue = isGroupChat
      ? undefined
      : isUserOnline
        ? 'online'
        : normalizedStatus === 'idle'
          ? 'idle'
          : 'offline';
    const userBadges = !isGroupChat && cachedUser?.badges
      ? (Array.isArray(cachedUser.badges) ? cachedUser.badges : [])
      : [];
    const chatStreak = streaks[chatIdKey];
    const streakCount = chatStreak?.currentStreak || 0;

    const chatCardContent = (
      <View style={[styles.chatCard, hasUnread && styles.chatCardUnread]}>
        <UserAvatar
          uri={avatarUri}
          name={displayName}
          size={56}
          presence={presenceValue}
          presencePlacement="overlay"
          style={styles.avatarContainer}
        />

        <View style={styles.chatContent}>
          <View style={styles.chatTitleRow}>
            <Text style={styles.chatName} numberOfLines={1}>
              {displayName}
            </Text>
            {userBadges.length > 0 && (
              <View style={styles.badgeContainer}>
                {userBadges.slice(0, 3).map((badge: string, idx: number) => (
                  <View key={`${chat.id}-badge-${badge}-${idx}`} style={styles.badgeWrapper}>
                    <BadgeIcon
                      type={badge as any}
                      size={22}
                    />
                  </View>
                ))}
              </View>
            )}
            {hasUnread && (
              <View style={styles.chatUnreadPill}>
                <Text style={styles.chatUnreadText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
            {streakCount > 0 && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakText}>{streakCount}</Text>
              </View>
            )}
          </View>
          {groupSubtitle ? (
            <Text style={styles.chatSubtitle} numberOfLines={1}>
              {groupSubtitle}
            </Text>
          ) : (
            !isGroupChat && lastSeenLabel ? (
              <Text style={styles.chatSubtitle} numberOfLines={1}>
                {lastSeenLabel}
              </Text>
            ) : null
          )}
        </View>

        <View style={styles.rightColumn}>
          {isRemoving ? (
            <ActivityIndicator size="small" color={palette.error} />
          ) : (
            <Ionicons name="chevron-forward" size={16} color="rgba(255, 255, 255, 0.4)" />
          )}
        </View>
      </View>
    );

    // For DM chats, wrap with NativeContextMenu
    if (!isGroupChat && otherUserId) {
      const contextMenuActions = getDMContextMenuActions(otherUserId, chatIdKey);
      
      return (
        <NativeContextMenu
          actions={contextMenuActions}
          title={displayName}
          disabled={isRemoving}
        >
          <TouchableOpacity
            onPress={() => !isRemoving && handleChatPress(chat)}
            style={styles.chatItem}
            activeOpacity={0.75}
            disabled={isRemoving}
          >
            {chatCardContent}
          </TouchableOpacity>
        </NativeContextMenu>
      );
    }

    // For group chats, use regular long press
    return (
      <TouchableOpacity
        onPress={() => !isRemoving && handleChatPress(chat)}
        onLongPress={() => !isRemoving && handleChatLongPress(chat)}
        style={styles.chatItem}
        activeOpacity={0.75}
        disabled={isRemoving}
      >
        {chatCardContent}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color="rgba(255, 255, 255, 0.3)" />
      <Text style={styles.emptyStateTitle}>No chats yet</Text>
      <Text style={styles.emptyStateMessage}>
        Start by adding friends and begin conversations!
      </Text>
    </View>
  );

  if (isLoading && chats.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        {[0, 1, 2, 3].map((key) => (
          <View key={key} style={styles.skeletonCard}>
            <View style={styles.skeletonAvatar} />
            <View style={styles.skeletonBody}>
              <View style={styles.skeletonLineWide} />
              <View style={styles.skeletonLineNarrow} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  const renderHeaderActions = () => (
    <View style={styles.headerActionsRow}>
      <TouchableOpacity
        style={styles.createGroupButton}
        onPress={() => router.push('/group/create' as any)}
        activeOpacity={0.85}
      >
        <Ionicons name="people-outline" size={18} color={palette.text} />
        <Text style={styles.createGroupLabel}>New group</Text>
      </TouchableOpacity>
    </View>
  );

  // Tab bar height (approximate) + extra spacing
  const TAB_BAR_HEIGHT = 80;
  const bottomPadding = insets.bottom + TAB_BAR_HEIGHT + spacing.lg;

  return (
    <View style={styles.container}>
      <FlatList
        data={chats}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderChatItem}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.accent}
            colors={[palette.accent]}
          />
        }
        contentContainerStyle={[styles.listContainer, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      <ProfileCard
        visible={profileCardVisible}
        user={profileCardUser}
        onClose={handleProfileCardClose}
        presence={profileCardUser ? getPresenceForUser(profileCardUser.id) : 'offline'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.sm,
    // paddingBottom is set dynamically in the component
  },
  chatItem: {
    marginBottom: spacing.sm,
  },
  headerActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  createGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  createGroupLabel: {
    color: palette.text,
    fontSize: 14,
    ...font('semibold'),
  },
  chatCard: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#010103',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  chatCardUnread: {
    borderColor: 'rgba(37, 99, 235, 0.35)',
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
  },
  avatarContainer: {
    marginRight: spacing.md,
  },
  chatContent: {
    flex: 1,
  },
  chatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chatName: {
    color: palette.text,
    fontSize: 17,
    ...font('semibold'),
    marginBottom: 2,
    flexShrink: 1,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 1,
  },
  badgeWrapper: {
    shadowColor: '#ffffff',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  chatSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
  },
  chatUnreadPill: {
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
  },
  chatUnreadText: {
    color: palette.text,
    fontSize: 12,
    ...font('bold'),
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 146, 60, 0.2)',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.4)',
  },
  streakText: {
    color: '#FB923C',
    fontSize: 12,
    ...font('bold'),
  },
  rightColumn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyStateTitle: {
    color: palette.text,
    fontSize: 20,
    ...font('semibold'),
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyStateMessage: {
    color: palette.textMuted,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'stretch',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: 16,
    marginTop: spacing.sm,
  },
  skeletonCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  skeletonAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginRight: spacing.md,
  },
  skeletonBody: {
    flex: 1,
    gap: spacing.xs,
  },
  skeletonLineWide: {
    height: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    width: '72%',
  },
  skeletonLineNarrow: {
    height: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    width: '50%',
  },
});
