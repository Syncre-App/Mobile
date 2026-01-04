import React, { useCallback } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useChatContext } from './_layout';
import { AppBackground } from '../../components/AppBackground';
import { UserAvatar } from '../../components/UserAvatar';
import { BadgeRow } from '../../components/BadgeIcon';
import { StorageService } from '../../services/StorageService';
import { CryptoService } from '../../services/CryptoService';
import { WebSocketService } from '../../services/WebSocketService';
import { font, palette, radii, spacing } from '../../theme/designSystem';

export default function ProfileTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isOnline } = useChatContext();

  // ─────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────

  const handleEditProfile = useCallback(() => {
    router.push('/settings/edit-profile');
  }, [router]);

  const handleSettings = useCallback(() => {
    router.push('/settings');
  }, [router]);

  const handlePrivacy = useCallback(() => {
    router.push('/settings/privacy');
  }, [router]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Disconnect WebSocket
              WebSocketService.getInstance().disconnect();
              // Clear all local data including SecureStore (identity keys)
              await Promise.all([
                CryptoService.clearLocalIdentity(),
                StorageService.clear(),
              ]);
              // Redirect to login screen (root index shows LoginScreen when no token)
              router.replace('/');
            } catch (error) {
              console.error('Failed to logout:', error);
              // Even if clearing fails, still redirect to login
              router.replace('/');
            }
          },
        },
      ]
    );
  }, [router]);

  // ─────────────────────────────────────────────────────────────
  // Render Menu Item
  // ─────────────────────────────────────────────────────────────

  const renderMenuItem = (
    icon: string,
    title: string,
    subtitle: string,
    onPress: () => void,
    isDestructive = false
  ) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconContainer, isDestructive && styles.menuIconDestructive]}>
        <Ionicons
          name={icon as any}
          size={22}
          color={isDestructive ? palette.error : palette.text}
        />
      </View>
      <View style={styles.menuTextContainer}>
        <Text style={[styles.menuTitle, isDestructive && styles.menuTitleDestructive]}>
          {title}
        </Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.3)" />
    </TouchableOpacity>
  );

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: 'Profile',
          headerTitleStyle: {
            color: palette.text,
            ...font('display'),
            fontSize: 20,
          },
        }}
      />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppBackground />

      <SafeAreaView
        style={[
          styles.safeArea,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 0),
          },
        ]}
        edges={['left', 'right']}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <UserAvatar
              uri={user?.profile_picture}
              name={user?.username || user?.name || user?.email}
              size={100}
              presence={isOnline ? 'online' : 'offline'}
              presencePlacement="overlay"
            />
            <Text style={styles.username}>{user?.username || 'User'}</Text>
            <Text style={styles.email}>{user?.email || ''}</Text>

            {user?.badges && user.badges.length > 0 && (
              <BadgeRow badges={user.badges} size={28} spacing={8} style={styles.badges} />
            )}

            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isOnline ? '#22C55E' : palette.textMuted },
                ]}
              />
              <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
            </View>
          </View>

          {/* Menu Items */}
          <View style={styles.menuSection}>
            {renderMenuItem(
              'person-outline',
              'Edit Profile',
              'Update your profile picture and username',
              handleEditProfile
            )}
            {renderMenuItem(
              'settings-outline',
              'Settings',
              'App preferences and notifications',
              handleSettings
            )}
            {renderMenuItem(
              'shield-checkmark-outline',
              'Privacy',
              'Manage blocked users and security',
              handlePrivacy
            )}
          </View>

          {/* Logout */}
          <View style={styles.menuSection}>
            {renderMenuItem(
              'log-out-outline',
              'Log Out',
              'Sign out of your account',
              handleLogout,
              true
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  scrollView: {
    flex: 1,
    marginTop: 60, // Account for header
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  username: {
    color: palette.text,
    fontSize: 28,
    ...font('bold'),
    marginTop: spacing.md,
  },
  email: {
    color: palette.textMuted,
    fontSize: 16,
    marginTop: spacing.xs,
  },
  badges: {
    marginTop: spacing.md,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    color: palette.textMuted,
    fontSize: 14,
    ...font('medium'),
  },
  menuSection: {
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuIconDestructive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    color: palette.text,
    fontSize: 16,
    ...font('semibold'),
  },
  menuTitleDestructive: {
    color: palette.error,
  },
  menuSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
});
