import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserAvatar } from './UserAvatar';

interface Friend {
  id: string;
  username: string;
  profile_picture?: string | null;
  status?: string | null;
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
    () =>
      new Set(
        excludedIds
          .filter(Boolean)
          .map((id) => id.toString())
      ),
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

  useEffect(() => {
    if (!visible) {
      return;
    }
    setSelectedIds(new Set());
    setSearch('');
  }, [visible, lockedIds.join(','), excludedIds.join(',')]);

  const filteredFriends = useMemo(() => {
    const query = search.trim().toLowerCase();
    return friends.filter((friend) => {
      const id = friend.id?.toString?.() ?? String(friend.id);
      if (lockedSet.has(id) || excludedSet.has(id)) {
        return false;
      }
      if (!query) return true;
      return friend.username?.toLowerCase().includes(query);
    });
  }, [friends, search, lockedSet, excludedSet]);

  const totalSelected = lockedSet.size + selectedIds.size;
  const totalWithOwner = totalSelected + 1;
  const minSatisfied = totalWithOwner >= minimumTotal;
  const maxReached = totalWithOwner >= maxTotal;

  const toggleSelection = (friendId: string) => {
    if (!friendId || lockedSet.has(friendId)) {
      return;
    }
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
      return (
        friend || {
          id: lockedId,
          username: 'Member',
          profile_picture: null,
        }
      );
    });
  }, [friendsById, lockedIds]);

  const renderFriend = ({ item }: { item: Friend }) => {
    const id = item.id?.toString?.() ?? String(item.id);
    const isSelected = selectedIds.has(id);
    return (
      <TouchableOpacity style={styles.friendItem} onPress={() => toggleSelection(id)}>
        <View style={styles.friendInfo}>
          <UserAvatar uri={item.profile_picture} name={item.username} size={44} />
          <View>
            <Text style={styles.friendName}>{item.username}</Text>
            {item.status ? <Text style={styles.friendStatus}>{item.status}</Text> : null}
          </View>
        </View>
        <View
          style={[
            styles.checkCircle,
            isSelected && styles.checkCircleSelected,
            maxReached && !isSelected ? styles.checkCircleDisabled : null,
          ]}
        >
          {isSelected ? <Ionicons name="checkmark" size={16} color="#0B1630" /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button">
              <Ionicons name="close" size={18} color="#ffffff" />
            </Pressable>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search friends"
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            value={search}
            onChangeText={setSearch}
          />

          {lockedParticipants.length ? (
            <View style={styles.lockedSection}>
              <Text style={styles.lockedLabel}>Already included</Text>
              {lockedParticipants.map((participant) => (
                <View key={participant.id} style={styles.lockedChip}>
                  <UserAvatar
                    uri={participant.profile_picture || undefined}
                    name={participant.username}
                    size={28}
                    style={styles.lockedAvatar}
                  />
                  <Text style={styles.lockedName}>{participant.username}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : (
            <FlatList
              data={filteredFriends}
              keyExtractor={(item) => item.id?.toString?.() ?? String(item.id)}
              renderItem={renderFriend}
              contentContainerStyle={styles.friendList}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No friends available for this action.</Text>
              }
            />
          )}

          <View style={styles.sheetFooter}>
            <Text style={styles.counterText}>
              {totalWithOwner}/{maxTotal} people
            </Text>
            <Pressable
              style={[
                styles.confirmButton,
                (!minSatisfied || isSubmitting) && styles.confirmButtonDisabled,
              ]}
              disabled={!minSatisfied || isSubmitting}
              onPress={handleConfirm}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#0B1630" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  {mode === 'create' ? 'Continue' : 'Add'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#060A16',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#ffffff',
    marginBottom: 12,
  },
  lockedSection: {
    marginBottom: 12,
  },
  lockedLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginBottom: 6,
  },
  lockedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 8,
    marginBottom: 6,
  },
  lockedAvatar: {
    marginRight: 8,
  },
  lockedName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  friendList: {
    paddingBottom: 12,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  friendName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  friendStatus: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
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
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.5)',
    paddingVertical: 30,
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  counterText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
  },
  confirmButton: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    color: '#0B1630',
    fontWeight: '600',
    fontSize: 15,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    marginBottom: 6,
  },
  loadingState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
});
