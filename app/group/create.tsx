import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserAvatar } from '../../components/UserAvatar';
import { ChatService, UploadableAsset } from '../../services/ChatService';
import { ApiService } from '../../services/ApiService';
import { NotificationService } from '../../services/NotificationService';
import { StorageService } from '../../services/StorageService';
import { UserCacheService } from '../../services/UserCacheService';

const MIN_GROUP_MEMBERS = 3;

export default function CreateGroupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ members?: string }>();
  const memberParam = Array.isArray(params.members) ? params.members[0] : params.members;
  const memberIds = useMemo<string[]>(() => {
    if (!memberParam) return [];
    try {
      const parsed = JSON.parse(memberParam);
      if (Array.isArray(parsed)) {
        return parsed.map((id) => id?.toString?.() ?? String(id));
      }
      return [];
    } catch (error) {
      console.warn('[group/create] Failed to parse members', error);
      return [];
    }
  }, [memberParam]);

  const [groupName, setGroupName] = useState('');
  const [avatar, setAvatar] = useState<UploadableAsset | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberProfiles, setMemberProfiles] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const hydrateMembers = useCallback(async () => {
    if (!memberIds.length) {
      setMemberProfiles([]);
      return;
    }
    setLoadingMembers(true);
    try {
      const token = await StorageService.getAuthToken();
      const profiles: any[] = [];
      for (const memberId of memberIds) {
        const cached = UserCacheService.getUser(memberId);
        if (cached) {
          profiles.push(cached);
          continue;
        }
        if (!token) continue;
        const response = await ApiService.getUserById(memberId, token);
        if (response.success && response.data) {
          profiles.push(response.data);
          UserCacheService.addUser({
            ...response.data,
            id: response.data.id?.toString?.() ?? String(response.data.id),
          });
        }
      }
      setMemberProfiles(profiles);
    } catch (error) {
      console.error('Failed to hydrate member profiles', error);
    } finally {
      setLoadingMembers(false);
    }
  }, [memberIds]);

  useEffect(() => {
    hydrateMembers();
  }, [hydrateMembers]);

  const handlePickAvatar = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      NotificationService.show('info', 'Media permissions are required to choose a photo');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setAvatar({
        uri: asset.uri,
        name: asset.fileName || 'group.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
    }
  }, []);

  const handleCreateGroup = useCallback(async () => {
    if (memberIds.length + 1 < MIN_GROUP_MEMBERS) {
      NotificationService.show('error', 'Select at least two friends to start a group');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await ChatService.createGroupChat(
        {
          name: groupName.trim(),
          members: memberIds,
          avatar,
        },
      );

      if (response.success && response.data?.chat) {
        NotificationService.show('success', 'Group created');
        DeviceEventEmitter.emit('chats:refresh');
        router.replace({
          pathname: '/chat/[id]',
          params: { id: response.data.chat.id?.toString?.() ?? String(response.data.chat.id) },
        } as any);
        return;
      }

      NotificationService.show('error', response.error || 'Failed to create group');
    } catch (error) {
      console.error('Failed to create group', error);
      NotificationService.show('error', 'Unexpected error creating group');
    } finally {
      setIsSubmitting(false);
    }
  }, [avatar, groupName, memberIds, router]);

  if (!memberIds.length) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Select friends before creating a group.</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Create a group chat</Text>
        <Text style={styles.subtitle}>Give your group a name and avatar. You can change this later.</Text>

        <Pressable style={styles.avatarPicker} onPress={handlePickAvatar}>
          {avatar ? (
            <UserAvatar uri={avatar.uri} name={groupName || 'Group'} size={96} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="image-outline" size={28} color="#FFFFFF" />
              <Text style={styles.avatarPlaceholderText}>Add photo</Text>
            </View>
          )}
        </Pressable>

        <TextInput
          style={styles.input}
          placeholder="Group name"
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          value={groupName}
          onChangeText={setGroupName}
          maxLength={60}
        />

        <Text style={styles.sectionLabel}>Members ({memberIds.length + 1})</Text>
        {loadingMembers ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          memberProfiles.map((member) => (
            <View key={member.id} style={styles.memberRow}>
              <UserAvatar uri={member.profile_picture} name={member.username} size={48} />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.username}</Text>
                <Text style={styles.memberMeta}>{member.email || member.status || ''}</Text>
              </View>
            </View>
          ))
        )}

        <Pressable
          style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
          onPress={handleCreateGroup}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#0B1630" />
          ) : (
            <Text style={styles.primaryButtonText}>Create group</Text>
          )}
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#03040A',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#03040A',
    padding: 24,
  },
  content: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  avatarPicker: {
    alignSelf: 'center',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    color: '#ffffff',
    marginTop: 4,
    fontSize: 12,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
  },
  sectionLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  memberMeta: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#0B1630',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
});

