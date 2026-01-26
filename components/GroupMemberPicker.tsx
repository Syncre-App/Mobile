import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { UserAvatar } from './UserAvatar';
import { font, palette, radii, spacing } from '../theme/designSystem';
import { canUseSwiftUI } from '../utils/swiftUi';

let SwiftUIHost: any = null;
let SwiftUIBottomSheet: any = null;

if (Platform.OS === 'ios') {
  try {
    const swiftUI = require('@expo/ui/swift-ui');
    SwiftUIHost = swiftUI.Host;
    SwiftUIBottomSheet = swiftUI.BottomSheet;
  } catch (e) {
    console.warn('SwiftUI components not available:', e);
  }
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Friend {
  id: string;
  username: string;
  profile_picture?: string | null;
  status?: string | null;
  last_seen?: string | null;
}

interface GroupMemberPickerProps {
  visible: boolean;
  title: string;
  friends: Friend[];
  lockedIds?: string[];
  excludedIds?: string[];
  minimumTotal?: number;
  maxTotal?: number;
  isLoading?: boolean;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  mode: 'create' | 'add';
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
}

export const GroupMemberPicker: React.FC<GroupMemberPickerProps> = ({
  visible,
  title,
  friends,
  lockedIds = [],
  excludedIds = [],
  minimumTotal = 3,
  maxTotal = 10,
  isLoading = false,
  isSubmitting = false,
  errorMessage,
  mode,
  onClose,
  onConfirm,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const lockedSet = useMemo(() => new Set(lockedIds.map((id) => id.toString())), [lockedIds]);
  const excludedSet = useMemo(
    () => new Set(excludedIds.filter(Boolean).map((id) => id.toString())),
    [excludedIds]
  );

  const friendsById = useMemo(() => {
    const map = new Map<string, Friend>();
    friends.forEach((friend) => {
      if (!friend?.id) return;
      map.set(friend.id.toString(), friend);
    });
    return map;
  }, [friends]);

  const lockedKey = useMemo(() => lockedIds.join(','), [lockedIds]);
  const excludedKey = useMemo(() => excludedIds.join(','), [excludedIds]);

  useEffect(() => {
    if (!visible) return;
    setSelectedIds(new Set());
    setSearch('');
  }, [visible, lockedKey, excludedKey]);

  const filteredFriends = useMemo(() => {
    const query = search.trim().toLowerCase();
    return friends.filter((friend) => {
      const id = friend.id?.toString?.() ?? String(friend.id);
      if (lockedSet.has(id) || excludedSet.has(id)) return false;
      if (!query) return true;
      return friend.username?.toLowerCase().includes(query);
    });
  }, [friends, search, lockedSet, excludedSet]);

  const totalSelected = lockedSet.size + selectedIds.size;
  const totalWithOwner = totalSelected + 1;
  const minSatisfied = totalWithOwner >= minimumTotal;
  const maxReached = totalWithOwner >= maxTotal;

  const toggleSelection = (friendId: string) => {
    if (!friendId || lockedSet.has(friendId)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) {
        next.delete(friendId);
      } else if (!maxReached) {
        next.add(friendId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
  };

  const lockedParticipants = useMemo(() => {
    return lockedIds.map((lockedId) => {
      const friend = friendsById.get(lockedId);
      return friend || { id: lockedId, username: 'Member', profile_picture: null };
    });
  }, [friendsById, lockedIds]);

  const getPresenceLabel = (friend: Friend): string => {
    const lastSeen = friend.last_seen;
    if (friend.status === 'online') return 'online';
    if (friend.status === 'idle') return 'idle';
    if (lastSeen) {
      const diff = Date.now() - Date.parse(lastSeen);
      const minutes = Math.floor(diff / 60000);
      if (minutes < 3) return 'idle';
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }
    return 'offline';
  };

  const renderFriend = ({ item }: { item: Friend }) => {
    const id = item.id?.toString?.() ?? String(item.id);
    const isSelected = selectedIds.has(id);
    const presenceLabel = getPresenceLabel(item);
    const isDisabled = maxReached && !isSelected;

    return (
      <TouchableOpacity
        style={[styles.friendItem, isSelected && styles.friendItemSelected]}
        onPress={() => !isDisabled && toggleSelection(id)}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        <View style={styles.friendInfo}>
          <UserAvatar
            uri={item.profile_picture}
            name={item.username}
            size={44}
            presence={item.status === 'online' ? 'online' : item.status === 'idle' ? 'idle' : 'offline'}
          />
          <View style={styles.friendTextContainer}>
            <Text style={[styles.friendName, isDisabled && styles.friendNameDisabled]}>
              {item.username}
            </Text>
            <Text style={styles.friendStatus}>{presenceLabel}</Text>
          </View>
        </View>
        <View
          style={[
            styles.checkCircle,
            isSelected && styles.checkCircleSelected,
            isDisabled && styles.checkCircleDisabled,
          ]}
        >
          {isSelected && <Ionicons name="checkmark" size={16} color="#0B1630" />}
        </View>
      </TouchableOpacity>
    );
  };

  const shouldUseSwiftUI = canUseSwiftUI();
  const canRenderSwiftUI = shouldUseSwiftUI && SwiftUIHost && SwiftUIBottomSheet;

  const content = (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="people" size={18} color={palette.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{totalWithOwner}/{maxTotal} members</Text>
        </View>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={20} color={palette.textMuted} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="rgba(255,255,255,0.5)" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends"
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Error */}
      {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

      {/* Locked participants */}
      {lockedParticipants.length > 0 && (
        <View style={styles.lockedSection}>
          <Text style={styles.lockedLabel}>Already included</Text>
          {lockedParticipants.map((participant) => (
            <View key={participant.id} style={styles.lockedChip}>
              <UserAvatar
                uri={participant.profile_picture || undefined}
                name={participant.username}
                size={28}
              />
              <Text style={styles.lockedName}>{participant.username}</Text>
              <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.4)" />
            </View>
          ))}
        </View>
      )}

      {/* Friends List */}
      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#FFFFFF" size="large" />
          <Text style={styles.loadingText}>Loading friends...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredFriends}
          keyExtractor={(item) => item.id?.toString?.() ?? String(item.id)}
          renderItem={renderFriend}
          contentContainerStyle={styles.friendList}
          style={styles.friendListContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>No friends available</Text>
            </View>
          }
        />
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.counterText}>{totalWithOwner}/{maxTotal} people selected</Text>
        <Pressable
          style={[
            styles.confirmButton,
            (!minSatisfied || isSubmitting) && styles.confirmButtonDisabled,
          ]}
          disabled={!minSatisfied || isSubmitting}
          onPress={handleConfirm}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#0B1630" size="small" />
          ) : (
            <Text style={styles.confirmButtonText}>
              {mode === 'create' ? 'Continue' : 'Add Members'}
            </Text>
          )}
        </Pressable>
      </View>
    </>
  );

  // Shared content component
  const sheetContent = canRenderSwiftUI ? (
    <View style={styles.swiftUISheetContent}>
      {content}
    </View>
  ) : (
    <View style={styles.container}>
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={styles.dragIndicator} />
      {content}
    </View>
  );

  // ═══════════════════════════════════════════════════════════════
  // iOS: Native SwiftUI BottomSheet
  // ═══════════════════════════════════════════════════════════════
  if (canRenderSwiftUI) {
    return (
      <SwiftUIHost style={styles.swiftUIHost}>
        <SwiftUIBottomSheet
          isOpened={visible}
          onIsOpenedChange={(isOpened: boolean) => {
            if (!isOpened) {
              onClose();
            }
          }}
          presentationDetents={[0.85, 'large']}
          presentationDragIndicator="visible"
        >
          {sheetContent}
        </SwiftUIBottomSheet>
      </SwiftUIHost>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Android / Fallback: React Native Modal
  // ═══════════════════════════════════════════════════════════════
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {sheetContent}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
  },
  dragIndicator: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 132, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    ...font('semibold'),
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radii.lg,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  lockedSection: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  lockedLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lockedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 8,
    marginBottom: 6,
    gap: 10,
  },
  lockedName: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    ...font('medium'),
  },
  friendListContainer: {
    flex: 1,
    marginHorizontal: 20,
  },
  friendList: {
    paddingBottom: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  friendItemSelected: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  friendTextContainer: {
    flex: 1,
  },
  friendName: {
    color: '#ffffff',
    fontSize: 16,
    ...font('medium'),
  },
  friendNameDisabled: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  friendStatus: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  checkCircleDisabled: {
    opacity: 0.3,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 15,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  counterText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  confirmButton: {
    backgroundColor: palette.accent,
    borderRadius: radii.full,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    color: '#ffffff',
    ...font('semibold'),
    fontSize: 15,
  },
  swiftUIHost: {
    width: 0,
    height: 0,
  },
  swiftUISheetContent: {
    flex: 1,
    paddingTop: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
});
