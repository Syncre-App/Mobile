import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { useFriendStore } from '../../stores/friendStore';
import { chatApi } from '../../services/api';
import { Avatar, Button, Input } from '../../components/ui';
import { Layout } from '../../constants/layout';
import { Friend } from '../../types/user';

export default function NewGroupScreen() {
  const { colors } = useTheme();
  const { friends, fetchFriends } = useFriendStore();

  const [step, setStep] = useState<'select' | 'details'>('select');
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchFriends();
  }, []);

  const toggleFriend = (friend: Friend) => {
    const isSelected = selectedFriends.some(f => f.id === friend.id);
    if (isSelected) {
      setSelectedFriends(prev => prev.filter(f => f.id !== friend.id));
    } else {
      setSelectedFriends(prev => [...prev, friend]);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleNext = () => {
    if (selectedFriends.length < 2) {
      Alert.alert('Select Members', 'Please select at least 2 friends for a group chat.');
      return;
    }
    setStep('details');
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Group Name', 'Please enter a name for the group.');
      return;
    }

    setIsCreating(true);

    try {
      const memberIds = selectedFriends.map(f => f.id);
      const newChat = await chatApi.createGroup(memberIds, groupName.trim());
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/(app)/chat/${newChat.id}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const renderFriend = ({ item }: { item: Friend }) => {
    const isSelected = selectedFriends.some(f => f.id === item.id);

    return (
      <TouchableOpacity
        style={[styles.friendItem, { backgroundColor: colors.background }]}
        onPress={() => toggleFriend(item)}
      >
        <Avatar source={item.profile_picture} name={item.username} size="md" />
        <View style={styles.friendInfo}>
          <Text style={[styles.friendName, { color: colors.text }]}>@{item.username}</Text>
        </View>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: isSelected ? colors.accent : colors.border,
              backgroundColor: isSelected ? colors.accent : 'transparent',
            },
          ]}
        >
          {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSelectStep = () => (
    <>
      <FlatList
        data={friends}
        keyExtractor={item => item.id}
        renderItem={renderFriend}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          selectedFriends.length > 0 ? (
            <View style={[styles.selectedContainer, { borderBottomColor: colors.border }]}>
              <Text style={[styles.selectedLabel, { color: colors.textSecondary }]}>
                Selected ({selectedFriends.length})
              </Text>
              <FlatList
                horizontal
                data={selectedFriends}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.selectedItem}
                    onPress={() => toggleFriend(item)}
                  >
                    <Avatar source={item.profile_picture} name={item.username} size="sm" />
                    <View style={[styles.removeButton, { backgroundColor: colors.error }]}>
                      <Ionicons name="close" size={12} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                )}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.selectedList}
              />
            </View>
          ) : null
        }
      />

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Button
          title={`Next (${selectedFriends.length} selected)`}
          onPress={handleNext}
          disabled={selectedFriends.length < 2}
          fullWidth
        />
      </View>
    </>
  );

  const renderDetailsStep = () => (
    <View style={styles.detailsContainer}>
      <View style={styles.groupPreview}>
        <View style={[styles.groupAvatarPlaceholder, { backgroundColor: colors.surface }]}>
          <Ionicons name="people" size={40} color={colors.textSecondary} />
        </View>
        <Text style={[styles.membersText, { color: colors.textSecondary }]}>
          {selectedFriends.length + 1} members
        </Text>
      </View>

      <Input
        label="Group Name"
        placeholder="Enter group name"
        value={groupName}
        onChangeText={setGroupName}
        autoCapitalize="words"
      />

      <View style={styles.membersList}>
        <Text style={[styles.membersLabel, { color: colors.textSecondary }]}>Members</Text>
        {selectedFriends.map(friend => (
          <View key={friend.id} style={styles.memberItem}>
            <Avatar source={friend.profile_picture} name={friend.username} size="sm" />
            <Text style={[styles.memberName, { color: colors.text }]}>@{friend.username}</Text>
          </View>
        ))}
      </View>

      <View style={styles.detailsFooter}>
        <Button
          title="Create Group"
          onPress={handleCreateGroup}
          loading={isCreating}
          fullWidth
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            if (step === 'details') {
              setStep('select');
            } else {
              router.back();
            }
          }}
          style={styles.backButton}
        >
          <Ionicons name={step === 'details' ? 'arrow-back' : 'close'} size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {step === 'select' ? 'New Group' : 'Group Details'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {step === 'select' ? renderSelectStep() : renderDetailsStep()}
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
    paddingBottom: 100,
  },
  selectedContainer: {
    paddingVertical: Layout.spacing.md,
    borderBottomWidth: 0.5,
  },
  selectedLabel: {
    fontSize: Layout.fontSize.sm,
    marginLeft: Layout.spacing.lg,
    marginBottom: Layout.spacing.sm,
  },
  selectedList: {
    paddingHorizontal: Layout.spacing.lg,
  },
  selectedItem: {
    marginRight: Layout.spacing.md,
    position: 'relative',
  },
  removeButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
  },
  friendInfo: {
    flex: 1,
    marginLeft: Layout.spacing.md,
  },
  friendName: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.medium,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Layout.spacing.lg,
    borderTopWidth: 0.5,
  },
  detailsContainer: {
    flex: 1,
    padding: Layout.spacing.lg,
  },
  groupPreview: {
    alignItems: 'center',
    marginBottom: Layout.spacing.xl,
  },
  groupAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Layout.spacing.sm,
  },
  membersText: {
    fontSize: Layout.fontSize.sm,
  },
  membersList: {
    marginTop: Layout.spacing.lg,
  },
  membersLabel: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.semibold,
    marginBottom: Layout.spacing.sm,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Layout.spacing.sm,
  },
  memberName: {
    fontSize: Layout.fontSize.md,
    marginLeft: Layout.spacing.md,
  },
  detailsFooter: {
    marginTop: 'auto',
    paddingTop: Layout.spacing.lg,
  },
});
