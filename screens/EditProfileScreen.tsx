import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
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

interface User {
  id: string;
  username: string;
  email: string;
  profile_picture?: string | null;
  [key: string]: any;
}

const MAX_PROFILE_SIZE_BYTES = 5 * 1024 * 1024;

const resolveExtension = (fileName?: string | null, mimeType?: string | null) => {
  const fromName = fileName?.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) {
    return fromName;
  }
  const fromMime = mimeType?.split('/').pop()?.toLowerCase();
  if (fromMime && fromMime.length <= 5) {
    return fromMime;
  }
  return 'jpg';
};

export const EditProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const topInset = insets.top;
  const minTopPadding = spacing.lg;
  const extraTopPadding = Math.max(minTopPadding - topInset, 0);
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ uri: string; mimeType: string; fileName?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setInitialLoading(true);
      const token = await StorageService.getAuthToken();
      
      if (!token) {
        router.replace('/' as any);
        return;
      }

      const response = await ApiService.get('/user/me', token);
      
      if (response.success && response.data) {
        const userData = response.data;
        setUser(userData);
        setUsername(userData.username || '');
        setEmail(userData.email || '');
        setProfilePicture(userData.profile_picture || null);
      } else {
        NotificationService.show('error', response.error || 'Failed to load profile');
        router.back();
      }
    } catch (error: any) {
      console.log('❌ Error loading user profile:', error);
      NotificationService.show('error', 'Failed to load profile');
      router.back();
    } finally {
      setInitialLoading(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        NotificationService.show('error', 'Media access is required to pick a profile photo');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
        aspect: [1, 1],
      });

      if (result.canceled || !result.assets || !result.assets.length) {
        return;
      }

      const asset = result.assets[0];
      let normalizedUri = asset.uri;
      let fileSize = asset.fileSize ?? null;

      if (!fileSize) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(asset.uri);
          if (fileInfo.exists && typeof fileInfo.size === 'number') {
            fileSize = fileInfo.size;
          }
        } catch (infoError) {
          console.warn('Failed to inspect selected image info', infoError);
        }
      }

      if (fileSize && fileSize > MAX_PROFILE_SIZE_BYTES) {
        NotificationService.show('error', 'Image must be smaller than 5 MB');
        return;
      }

      if (Platform.OS === 'android' && normalizedUri.startsWith('content://')) {
        try {
          const tempExt = resolveExtension(asset.fileName, asset.mimeType);
          const fsCacheDir = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory ?? '';
          const tempUri = `${fsCacheDir}profile-upload-${Date.now()}.${tempExt}`;
          await FileSystem.copyAsync({ from: normalizedUri, to: tempUri });
          normalizedUri = tempUri;
        } catch (copyError) {
          console.warn('Failed to copy Android content URI for upload', copyError);
        }
      }

      setSelectedImage({
        uri: normalizedUri,
        mimeType: asset.mimeType || 'image/jpeg',
        fileName: asset.fileName ?? undefined,
      });
    } catch (error) {
      console.error('Failed to pick image:', error);
      NotificationService.show('error', 'Image picker failed');
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) {
      NotificationService.show('warning', 'Select a profile picture to upload');
      return;
    }

    try {
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

      if (!allowedMimeTypes.includes(selectedImage.mimeType)) {
        NotificationService.show('error', 'Unsupported image format');
        return;
      }

      setUploading(true);
      const token = await StorageService.getAuthToken();
      if (!token) {
        router.replace('/' as any);
        return;
      }

      const formData = new FormData();
      const safeExtension = resolveExtension(selectedImage.fileName, selectedImage.mimeType);
      const fileName = selectedImage.fileName || `profile-${Date.now()}.${safeExtension}`;

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
          UserCacheService.addUser({ ...updatedUser, id: updatedUser.id?.toString?.() || updatedUser.id } as any);
        }
        NotificationService.show('success', 'Profile picture updated!');
        Alert.alert(
          'Profile Updated',
          'Your new profile photo is live.',
          [
            {
              text: 'Awesome!',
              onPress: () => router.back(),
            },
          ],
          { cancelable: false }
        );
        return;
      } else {
        NotificationService.show('error', response.error || 'Failed to upload profile picture');
      }
    } catch (error) {
      console.error('Failed to upload profile picture:', error);
      NotificationService.show('error', 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Changes',
      'Are you sure you want to cancel? Your changes will be lost.',
      [
        {
          text: 'Keep Editing',
          style: 'cancel',
        },
        {
          text: 'Cancel',
          onPress: () => router.back(),
          style: 'destructive',
        },
      ]
    );
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: extraTopPadding }]} edges={['top', 'left', 'right']}>
        <AppBackground />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2C82FF" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: extraTopPadding }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <View style={styles.headerCentered} pointerEvents="none">
          <Text style={styles.headerTitle}>Edit Profile</Text>
        </View>

        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentColumn}>
        <GlassCard style={[styles.card, styles.photoCard]} variant="subtle" padding={spacing.lg}>
          <View style={styles.photoPickerWrapper}>
            <TouchableOpacity
              style={[
                styles.photoPicker,
                (selectedImage || profilePicture) && styles.photoPickerWithImage
              ]}
              onPress={handlePickImage}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
            >
              {selectedImage ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: selectedImage.uri }} style={styles.profileImage} resizeMode="cover" />
                </View>
              ) : profilePicture ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: profilePicture }} style={styles.profileImage} resizeMode="cover" />
                </View>
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Ionicons name="person" size={42} color="rgba(255, 255, 255, 0.7)" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editBadge}
              onPress={handlePickImage}
              activeOpacity={0.85}
            >
              <Ionicons name="pencil" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </GlassCard>

        <GlassCard width="100%" style={[styles.card, styles.infoCard]} variant="subtle">
          <View style={[styles.infoRow, styles.infoRowFirst]}>
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>{username || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{email || '—'}</Text>
          </View>
        </GlassCard>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleUpload}
            disabled={uploading || !selectedImage}
            style={[styles.saveButton, (!selectedImage || uploading) && styles.saveButtonDisabled]}
          >
            <LinearGradient
              colors={['#2C82FF', '#0EA5FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveButtonGradient}
            >
              {uploading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>UPLOAD PHOTO</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
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
    color: 'rgba(255, 255, 255, 0.7)',
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
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerPlaceholder: {
    width: HEADER_BUTTON_DIMENSION,
    height: HEADER_BUTTON_DIMENSION,
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
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  contentColumn: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  photoCard: {
    marginBottom: spacing.lg + spacing.xs,
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl + spacing.xs,
  },
  photoPickerWrapper: {
    position: 'relative',
  },
  photoPicker: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  photoPickerWithImage: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  imageContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
  },
  profileImage: {
    width: 150,
    height: 150,
  },
  profilePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(20, 30, 50, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  photoHint: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    textAlign: 'center',
  },
  infoCard: {
    marginBottom: spacing.lg + spacing.xs,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  infoRowFirst: {
    borderTopWidth: 0,
  },
  infoLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  buttonContainer: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'stretch',
  },
  saveButton: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    letterSpacing: 1.1,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  cancelButton: {
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
});
