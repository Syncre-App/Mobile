import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
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

import { UserAvatar } from '../../../components/UserAvatar';
import { ChatService, UploadableAsset } from '../../../services/ChatService';
import { ApiService } from '../../../services/ApiService';
import { NotificationService } from '../../../services/NotificationService';
import { StorageService } from '../../../services/StorageService';

export default function GroupEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const chatId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [groupName, setGroupName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUpload, setAvatarUpload] = useState<UploadableAsset | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const loadGroupDetails = useCallback(async () => {
    if (!chatId) return;
    setIsLoading(true);
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        throw new Error('Missing auth token');
      }
      const response = await ApiService.get(`/chat/${chatId}`, token);
      if (response.success && response.data?.chat) {
        const chat = response.data.chat;
        setGroupName(chat.name || chat.displayName || 'Group chat');
        setAvatarUrl(chat.avatarUrl || chat.avatar_url || null);
        setOwnerId(chat.ownerId?.toString?.() ?? chat.owner_id?.toString?.() ?? null);
        setParticipants(
          Array.isArray(chat.participants)
            ? chat.participants.map((participant: any) => ({
                ...participant,
                id: participant.id?.toString?.() ?? String(participant.id),
              }))
            : []
        );
      } else {
        NotificationService.show('error', response.error || 'Unable to load group');
        router.back();
      }
    } catch (error) {
      console.error('Failed to load group details', error);
      NotificationService.show('error', 'Failed to load group details');
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [chatId, router]);

  useEffect(() => {
    loadGroupDetails();
  }, [loadGroupDetails]);

  const handleSaveName = useCallback(async () => {
    if (!chatId) return;
    const trimmed = groupName.trim();
    if (!trimmed.length) {
      NotificationService.show('info', 'Group name cannot be empty');
      return;
    }
    setIsSaving(true);
    const response = await ChatService.updateGroupName(chatId, trimmed);
    setIsSaving(false);
    if (response.success && response.data?.chat) {
      NotificationService.show('success', 'Group updated');
      DeviceEventEmitter.emit('chats:refresh');
      loadGroupDetails();
    } else {
      NotificationService.show('error', response.error || 'Failed to update group');
    }
  }, [chatId, groupName, loadGroupDetails]);

  const handlePickAvatar = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      NotificationService.show('info', 'Media permissions are required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length && chatId) {
      const asset = result.assets[0];
      setAvatarUpload({
        uri: asset.uri,
        name: asset.fileName || 'group.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      const response = await ChatService.updateGroupAvatar(chatId, {
        uri: asset.uri,
        name: asset.fileName || 'group.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      if (response.success && response.data?.chat) {
        NotificationService.show('success', 'Avatar updated');
        setAvatarUrl(response.data.chat.avatarUrl || response.data.chat.avatar_url || null);
        DeviceEventEmitter.emit('chats:refresh');
      } else {
        NotificationService.show('error', response.error || 'Failed to update avatar');
      }
    }
  }, [chatId]);

  const handleRemoveMember = useCallback(
    async (memberId: string) => {
      if (!chatId) return;
      setRemovingMemberId(memberId);
      const response = await ChatService.removeMember(chatId, memberId);
      setRemovingMemberId(null);
      if (response.success && response.data?.chat) {
        NotificationService.show('success', 'Member removed');
        setParticipants(
          Array.isArray(response.data.chat.participants)
            ? response.data.chat.participants.map((participant: any) => ({
                ...participant,
                id: participant.id?.toString?.() ?? String(participant.id),
              }))
            : []
        );
        DeviceEventEmitter.emit('chats:refresh');
      } else {
        NotificationService.show('error', response.error || 'Failed to remove member');
      }
    },
    [chatId]
  );

  const handleDeleteGroup = useCallback(async () => {
    if (!chatId) return;
    const response = await ChatService.deleteGroup(chatId);
    if (response.success) {
      NotificationService.show('success', 'Group deleted');
      DeviceEventEmitter.emit('chats:refresh');
      router.replace('/home');
    } else {
      NotificationService.show('error', response.error || 'Failed to delete group');
    }
  }, [chatId, router]);

  if (!chatId) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>No group selected.</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#ffffff" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        {isLoading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <View style={styles.avatarSection}>
              <UserAvatar uri={avatarUpload?.uri || avatarUrl || undefined} name={groupName} size={96} />
              <Pressable style={styles.secondaryButton} onPress={handlePickAvatar}>
                <Text style={styles.secondaryButtonText}>Change photo</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Group name"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={groupName}
              onChangeText={setGroupName}
            />
            <Pressable
              style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
              onPress={handleSaveName}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#0B1630" />
              ) : (
                <Text style={styles.primaryButtonText}>Save changes</Text>
              )}
            </Pressable>

            <Text style={styles.sectionLabel}>Members</Text>
            {participants.map((participant) => {
              const isOwner = participant.id?.toString?.() === ownerId;
              return (
                <View key={participant.id} style={styles.memberRow}>
                  <View style={styles.memberInfo}>
                    <UserAvatar uri={participant.profile_picture} name={participant.username} size={48} />
                    <View style={styles.memberText}>
                      <Text style={styles.memberName}>{participant.username}</Text>
                      <Text style={styles.memberMeta}>{isOwner ? 'Owner' : participant.email || ''}</Text>
                    </View>
                  </View>
                  {!isOwner ? (
                    <Pressable
                      style={styles.removeButton}
                      onPress={() => handleRemoveMember(participant.id)}
                      disabled={removingMemberId === participant.id}
                    >
                      {removingMemberId === participant.id ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Ionicons name="close" size={16} color="#ffffff" />
                      )}
                    </Pressable>
                  ) : (
                    <View style={styles.ownerBadge}>
                      <Text style={styles.ownerBadgeText}>Owner</Text>
                    </View>
                  )}
                </View>
              );
            })}

            <Pressable style={[styles.secondaryButton, styles.dangerButton]} onPress={handleDeleteGroup}>
              <Text style={styles.dangerButtonText}>Delete group</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#03040A',
  },
  content: {
    padding: 24,
    gap: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  backText: {
    color: '#ffffff',
  },
  avatarSection: {
    alignItems: 'center',
    gap: 12,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
  },
  primaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#0B1630',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
  },
  sectionLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memberText: {
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
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  ownerBadgeText: {
    color: '#ffffff',
    fontSize: 12,
  },
  dangerButton: {
    borderColor: 'rgba(255, 107, 107, 0.5)',
    marginTop: 32,
  },
  dangerButtonText: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#03040A',
    padding: 24,
    gap: 12,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 16,
  },
});

