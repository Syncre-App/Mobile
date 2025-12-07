import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground } from '../components/AppBackground';
import { GlassCard } from '../components/GlassCard';
import { ApiService } from '../services/ApiService';
import { NotificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';
import { UserCacheService } from '../services/UserCacheService';
import { palette, spacing, radii } from '../theme/designSystem';

const HEADER_BUTTON_DIMENSION = spacing.sm * 2 + 24;
const MAX_PROFILE_SIZE_BYTES = 5 * 1024 * 1024;

interface User {
  id: string;
  username: string;
  email: string;
  profile_picture?: string | null;
  [key: string]: any;
}

const resolveExtension = (fileName?: string | null, mimeType?: string | null) => {
  const fromName = fileName?.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  const fromMime = mimeType?.split('/').pop()?.toLowerCase();
  if (fromMime && fromMime.length <= 5) return fromMime;
  return 'jpg';
};

export const EditProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const extraTopPadding = Math.max(spacing.lg - insets.top, 0);

  const [user, setUser] = useState<User | null>(null);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ uri: string; mimeType: string; fileName?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const token = await StorageService.getAuthToken();
      if (!token) {
        router.replace('/' as any);
        return;
      }

      const response = await ApiService.get('/user/me', token);
      if (response.success && response.data) {
        setUser(response.data);
        setProfilePicture(response.data.profile_picture || null);
      } else {
        NotificationService.show('error', response.error || 'Failed to load profile');
        router.back();
      }
    } catch (error) {
      NotificationService.show('error', 'Failed to load profile');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (selectedImage) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        NotificationService.show('error', 'Media access required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
        aspect: [1, 1],
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      let normalizedUri = asset.uri;
      let fileSize = asset.fileSize ?? null;

      if (!fileSize) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(asset.uri);
          if (fileInfo.exists && typeof fileInfo.size === 'number') {
            fileSize = fileInfo.size;
          }
        } catch {}
      }

      if (fileSize && fileSize > MAX_PROFILE_SIZE_BYTES) {
        NotificationService.show('error', 'Image must be smaller than 5 MB');
        return;
      }

      if (Platform.OS === 'android' && normalizedUri.startsWith('content://')) {
        try {
          const tempExt = resolveExtension(asset.fileName, asset.mimeType);
          const fsCacheDir = (FileSystem as any).cacheDirectory ?? '';
          const tempUri = `${fsCacheDir}profile-upload-${Date.now()}.${tempExt}`;
          await FileSystem.copyAsync({ from: normalizedUri, to: tempUri });
          normalizedUri = tempUri;
        } catch {}
      }

      setSelectedImage({
        uri: normalizedUri,
        mimeType: asset.mimeType || 'image/jpeg',
        fileName: asset.fileName ?? undefined,
      });
    } catch (error) {
      NotificationService.show('error', 'Failed to pick image');
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(selectedImage.mimeType)) {
      NotificationService.show('error', 'Unsupported image format');
      return;
    }

    try {
      setUploading(true);
      const token = await StorageService.getAuthToken();
      if (!token) {
        router.replace('/' as any);
        return;
      }

      const formData = new FormData();
      const ext = resolveExtension(selectedImage.fileName, selectedImage.mimeType);
      const fileName = selectedImage.fileName || `profile-${Date.now()}.${ext}`;

      formData.append('profilePicture', {
        uri: selectedImage.uri,
        name: fileName,
        type: selectedImage.mimeType || 'image/jpeg',
      } as any);

      const response = await ApiService.upload('/user/profile-picture', formData, token);

      if (response.success && response.data?.profile_picture) {
        const newUrl = response.data.profile_picture;
        setProfilePicture(newUrl);
        setSelectedImage(null);

        if (user) {
          const updatedUser = { ...user, profile_picture: newUrl };
          setUser(updatedUser);
          await StorageService.setObject('user_data', updatedUser);
          UserCacheService.addUser({ ...updatedUser, id: String(updatedUser.id) } as any);
        }

        NotificationService.show('success', 'Profile picture updated');
        router.back();
      } else {
        NotificationService.show('error', response.error || 'Upload failed');
      }
    } catch (error) {
      NotificationService.show('error', 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    subtitle: string,
    onPress?: () => void,
    rightComponent?: React.ReactNode,
    isFirst = false
  ) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[styles.settingItem, isFirst && styles.settingItemFirst]}
    >
      <View style={styles.settingLeft}>
        <Ionicons name={icon as any} size={24} color="rgba(255, 255, 255, 0.7)" />
        <View style={styles.settingTexts}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {rightComponent ? (
        <View style={styles.settingRight}>{rightComponent}</View>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.3)" />
      ) : null}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: extraTopPadding }]} edges={['top', 'left', 'right']}>
        <AppBackground />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayImage = selectedImage?.uri || profilePicture;

  return (
    <SafeAreaView style={[styles.container, { paddingTop: extraTopPadding }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <View style={styles.headerCentered} pointerEvents="none">
          <Text style={styles.headerTitle}>Edit Profile</Text>
        </View>

        <TouchableOpacity
          onPress={handleUpload}
          disabled={!selectedImage || uploading}
          style={[styles.headerButton, (!selectedImage || uploading) && styles.headerButtonDisabled]}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="checkmark" size={24} color={selectedImage ? palette.accent : 'rgba(255,255,255,0.3)'} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture Section */}
        <GlassCard width="100%" style={styles.section} variant="subtle">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Profile Picture</Text>
          </View>

          <TouchableOpacity style={styles.avatarRow} onPress={handlePickImage} activeOpacity={0.8}>
            <View style={styles.avatarContainer}>
              {displayImage ? (
                <Image source={{ uri: displayImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color="rgba(255, 255, 255, 0.5)" />
                </View>
              )}
              {selectedImage && (
                <View style={styles.avatarBadge}>
                  <Ionicons name="ellipse" size={12} color={palette.accent} />
                </View>
              )}
            </View>
            <View style={styles.avatarTexts}>
              <Text style={styles.avatarTitle}>Change Photo</Text>
              <Text style={styles.avatarSubtitle}>
                {selectedImage ? 'New photo selected' : 'Tap to select a new photo'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.3)" />
          </TouchableOpacity>
        </GlassCard>

        {/* Account Info Section */}
        <GlassCard width="100%" style={styles.section} variant="subtle">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Account Info</Text>
          </View>

          {renderSettingItem(
            'person-outline',
            'Username',
            user?.username || '—',
            undefined,
            undefined,
            true
          )}

          {renderSettingItem(
            'mail-outline',
            'Email',
            user?.email || '—',
            undefined,
            undefined
          )}
        </GlassCard>

        {/* Hint */}
        <View style={styles.hintContainer}>
          <Ionicons name="information-circle-outline" size={16} color={palette.textMuted} />
          <Text style={styles.hintText}>
            Username and email cannot be changed here. Contact support if you need to update them.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: 16,
    marginTop: spacing.md,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  header: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerCentered: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButton: {
    width: HEADER_BUTTON_DIMENSION,
    height: HEADER_BUTTON_DIMENSION,
    borderRadius: radii.xxl,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontFamily: 'SpaceGrotesk-SemiBold',
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginBottom: spacing.md,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: palette.background,
    borderRadius: 8,
    padding: 2,
  },
  avatarTexts: {
    flex: 1,
    marginLeft: spacing.md,
  },
  avatarTitle: {
    color: palette.text,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  avatarSubtitle: {
    color: palette.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  settingItemFirst: {
    borderTopWidth: 0,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTexts: {
    marginLeft: spacing.md,
    flex: 1,
  },
  settingTitle: {
    color: palette.text,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  settingSubtitle: {
    color: palette.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  settingRight: {
    marginLeft: spacing.md,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: 440,
    alignSelf: 'center',
  },
  hintText: {
    color: palette.textMuted,
    fontSize: 13,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
});
