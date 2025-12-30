import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../hooks/useTheme';
import { useAuthStore } from '../../../stores/authStore';
import { userApi } from '../../../services/api';
import { Avatar, GlassButton } from '../../../components/ui';
import { Layout } from '../../../constants/layout';

export default function EditProfileScreen() {
  const { colors, isDark } = useTheme();
  const { user, refreshUser } = useAuthStore();

  const [profilePicture, setProfilePicture] = useState(user?.profile_picture || null);
  const [isUploading, setIsUploading] = useState(false);

  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const isIOS = Platform.OS === 'ios';

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadProfilePicture(result.assets[0].uri);
    }
  };

  const uploadProfilePicture = async (uri: string) => {
    setIsUploading(true);

    try {
      const response = await userApi.uploadProfilePicture(uri);
      setProfilePicture(response.profile_picture);
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  const renderCloseButton = () => {
    const buttonContent = (
      <View style={styles.closeButtonContent}>
        <Ionicons name="close" size={24} color={colors.text} />
      </View>
    );

    if (useGlass) {
      return (
        <TouchableOpacity onPress={() => router.back()}>
          <GlassView style={styles.glassCloseButton} glassEffectStyle="regular">
            {buttonContent}
          </GlassView>
        </TouchableOpacity>
      );
    }

    if (isIOS) {
      return (
        <TouchableOpacity onPress={() => router.back()}>
          <BlurView style={styles.blurCloseButton} tint={isDark ? 'dark' : 'light'} intensity={60}>
            {buttonContent}
          </BlurView>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity onPress={() => router.back()} style={[styles.closeButton, { backgroundColor: colors.surface }]}>
        {buttonContent}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        {renderCloseButton()}
        <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickImage} disabled={isUploading}>
            <Avatar source={profilePicture} name={user?.username} size="xl" />
            <View style={[styles.editBadge, { backgroundColor: colors.accent }]}>
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonSection}>
          <GlassButton
            title={isUploading ? 'Uploading...' : 'Change Profile Photo'}
            icon="camera-outline"
            onPress={handlePickImage}
            loading={isUploading}
            disabled={isUploading}
            fullWidth
          />
        </View>

        <View style={styles.infoSection}>
          <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
            <View style={styles.infoRow}>
              <Ionicons name="at" size={20} color={colors.textSecondary} style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Username</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{user?.username}</Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Email</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{user?.email}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          Username and email cannot be changed. Contact support if you need to update these.
        </Text>
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
  glassCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonContent: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: Layout.spacing.xl,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoText: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.medium,
    marginTop: Layout.spacing.md,
  },
  buttonSection: {
    marginBottom: Layout.spacing.xl,
  },
  infoSection: {
    marginBottom: Layout.spacing.lg,
  },
  infoCard: {
    borderRadius: Layout.radius.lg,
    paddingHorizontal: Layout.spacing.md,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Layout.spacing.md,
  },
  infoIcon: {
    marginRight: Layout.spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: Layout.fontSize.sm,
    marginBottom: Layout.spacing.xs,
  },
  infoValue: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.medium,
  },
  divider: {
    height: 0.5,
    marginLeft: 36,
  },
  note: {
    fontSize: Layout.fontSize.sm,
    textAlign: 'center',
    paddingHorizontal: Layout.spacing.lg,
  },
});
