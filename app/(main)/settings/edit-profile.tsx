import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '../../../components/Screen';
import { AppBackground } from '../../../components/AppBackground';
import { GlassPanel } from '../../../components/GlassPanel';
import { Avatar } from '../../../components/Avatar';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { font, spacing, useTheme } from '../../../theme/designSystem';
import { ApiService } from '../../../services/ApiService';
import { StorageService } from '../../../services/StorageService';
import { NotificationService } from '../../../services/NotificationService';
import { useAuth } from '../../../hooks/useAuth';

export default function EditProfileScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { user, refreshUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const handlePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];
    setIsUploading(true);
    try {
      const token = await StorageService.getAuthToken();
      if (!token) return;

      const formData = new FormData();
      formData.append('profilePicture', {
        uri: asset.uri,
        name: asset.fileName || `profile-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      } as any);

      const response = await ApiService.upload('/user/profile-picture', formData, token);
      if (!response.success) {
        NotificationService.show('error', response.error || 'Upload failed.');
        return;
      }
      NotificationService.show('success', 'Profile picture updated.');
      await refreshUser();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Screen>
      <AppBackground />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.navButton}>
          <Ionicons name="chevron-back" size={20} color={theme.palette.text} />
        </Pressable>
        <Text style={styles.title}>Edit Profile</Text>
        <View style={styles.navButton} />
      </View>

      <GlassPanel style={styles.panel} glassEffectStyle="regular" isInteractive>
        <View style={styles.profileRow}>
          <Avatar uri={user?.profile_picture} name={user?.username} size={96} />
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{user?.username || 'User'}</Text>
            <Text style={styles.subtitle}>Tap below to update your avatar.</Text>
          </View>
        </View>
        <PrimaryButton title="Choose new photo" onPress={handlePick} loading={isUploading} />
      </GlassPanel>
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    navButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceSoft,
    },
    title: {
      flex: 1,
      color: theme.palette.text,
      fontSize: 18,
      ...font('semibold'),
    },
    panel: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      gap: spacing.md,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    profileInfo: {
      flex: 1,
    },
    name: {
      color: theme.palette.text,
      fontSize: 20,
      ...font('semibold'),
    },
    subtitle: {
      color: theme.palette.textMuted,
      fontSize: 13,
      marginTop: 6,
    },
  });
