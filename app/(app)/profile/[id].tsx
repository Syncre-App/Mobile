import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../hooks/useTheme';
import { useAuthStore } from '../../../stores/authStore';
import { useFriendStore } from '../../../stores/friendStore';
import { userApi } from '../../../services/api';
import { Avatar, Button, LoadingSpinner } from '../../../components/ui';
import { Layout } from '../../../constants/layout';
import { AuthUser } from '../../../types/user';

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user: currentUser } = useAuthStore();
  const { friends, addFriend, removeFriend } = useFriendStore();

  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const isOwnProfile = id === currentUser?.id;
  const isFriend = friends.some(f => f.id === id);

  useEffect(() => {
    loadProfile();
  }, [id]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const userData = await userApi.getUser(id);
      setProfile(userData);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFriend = async () => {
    setActionLoading(true);
    const result = await addFriend(id);
    setActionLoading(false);
    
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('Error', result.error || 'Failed to send friend request');
    }
  };

  const handleRemoveFriend = async () => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove @${profile?.username} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const result = await removeFriend(id);
            setActionLoading(false);
            
            if (result.success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ]
    );
  };

  const handleBlock = async () => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block @${profile?.username}? They won't be able to message you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await userApi.blockUser(id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to block user');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>User not found</Text>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileHeader}>
          <Avatar
            source={profile.profile_picture}
            name={profile.username}
            size="xl"
          />
          <Text style={[styles.username, { color: colors.text }]}>@{profile.username}</Text>
          {!isOwnProfile && (
            <View style={styles.actions}>
              {isFriend ? (
                <>
                  <Button
                    title="Message"
                    onPress={() => {
                      // Find existing chat or create new one
                      router.back();
                    }}
                    style={styles.actionButton}
                  />
                  <Button
                    title="Remove"
                    variant="outline"
                    onPress={handleRemoveFriend}
                    loading={actionLoading}
                    style={styles.actionButton}
                  />
                </>
              ) : (
                <Button
                  title="Add Friend"
                  onPress={handleAddFriend}
                  loading={actionLoading}
                  style={styles.actionButton}
                />
              )}
            </View>
          )}
        </View>

        {!isOwnProfile && (
          <TouchableOpacity
            style={[styles.blockButton, { borderColor: colors.error }]}
            onPress={handleBlock}
          >
            <Ionicons name="ban-outline" size={20} color={colors.error} />
            <Text style={[styles.blockText, { color: colors.error }]}>Block User</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
  closeButton: {
    padding: Layout.spacing.xs,
  },
  headerTitle: {
    fontSize: Layout.fontSize.lg,
    fontWeight: Layout.fontWeight.semibold,
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: Layout.spacing.lg,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: Layout.spacing.xl,
  },
  username: {
    fontSize: Layout.fontSize.xl,
    fontWeight: Layout.fontWeight.bold,
    marginTop: Layout.spacing.md,
  },
  actions: {
    flexDirection: 'row',
    marginTop: Layout.spacing.lg,
    gap: Layout.spacing.md,
  },
  actionButton: {
    minWidth: 120,
  },
  blockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Layout.spacing.md,
    borderWidth: 1,
    borderRadius: Layout.radius.md,
  },
  blockText: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.medium,
    marginLeft: Layout.spacing.sm,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: Layout.fontSize.lg,
    marginBottom: Layout.spacing.lg,
  },
});
