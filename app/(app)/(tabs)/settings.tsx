import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../hooks/useTheme';
import { ThemeMode } from '../../../stores/themeStore';
import { useAuthStore } from '../../../stores/authStore';
import { useChatStore } from '../../../stores/chatStore';
import { useFriendStore } from '../../../stores/friendStore';
import { secureStorage } from '../../../services/storage/secure';
import { Avatar } from '../../../components/ui';
import { Layout } from '../../../constants/layout';
import { EXTERNAL_URLS, APP_CONFIG } from '../../../constants/config';

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  danger?: boolean;
}

function SettingItem({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  showChevron = true,
  danger = false,
}: SettingItemProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.settingItem, { backgroundColor: colors.background }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.settingIcon, { backgroundColor: danger ? colors.error + '15' : colors.surface }]}>
        <Ionicons name={icon} size={20} color={danger ? colors.error : colors.accent} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: danger ? colors.error : colors.text }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {rightElement}
      {showChevron && onPress && !rightElement && (
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      )}
    </TouchableOpacity>
  );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const { user, logout } = useAuthStore();
  const chatStore = useChatStore();
  const friendStore = useFriendStore();

  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const biometric = await secureStorage.isBiometricEnabled();
    setBiometricEnabled(biometric);
  };

  const getThemeModeLabel = (themeMode: ThemeMode): string => {
    switch (themeMode) {
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      case 'system': return 'System';
    }
  };

  const getThemeModeIcon = (themeMode: ThemeMode): keyof typeof Ionicons.glyphMap => {
    switch (themeMode) {
      case 'light': return 'sunny';
      case 'dark': return 'moon';
      case 'system': return 'phone-portrait-outline';
    }
  };

  const handleThemeChange = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Cycle through: dark -> light -> system -> dark
    const nextMode: ThemeMode = mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'dark';
    setMode(nextMode);
  };

  const handleBiometricToggle = async (value: boolean) => {
    await secureStorage.setBiometricEnabled(value);
    setBiometricEnabled(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            // Reset all stores
            chatStore.reset();
            friendStore.reset();
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone. Your account will be permanently deleted after 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: Call delete account API
            Alert.alert(
              'Account Scheduled for Deletion',
              'Your account will be deleted in 24 hours. Log in again to cancel.'
            );
          },
        },
      ]
    );
  };

  const renderHeader = () => {
    return (
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      {renderHeader()}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: colors.surface }]}
          onPress={() => router.push('/(app)/settings/edit-profile')}
        >
          <Avatar
            source={user?.profile_picture}
            name={user?.username}
            size="xl"
          />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>
              @{user?.username}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
              {user?.email}
            </Text>
            <View style={styles.editProfileButton}>
              <Text style={[styles.editProfileText, { color: colors.accent }]}>
                Edit Profile
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.accent} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Appearance Section */}
        <SettingSection title="Appearance">
          <SettingItem
            icon={getThemeModeIcon(mode)}
            title="Theme"
            subtitle={`Current: ${getThemeModeLabel(mode)}`}
            onPress={handleThemeChange}
            rightElement={
              <View style={[styles.themeBadge, { backgroundColor: colors.surface }]}>
                <Ionicons name={getThemeModeIcon(mode)} size={16} color={colors.accent} />
                <Text style={[styles.themeBadgeText, { color: colors.text }]}>
                  {getThemeModeLabel(mode)}
                </Text>
              </View>
            }
            showChevron={false}
          />
        </SettingSection>

        {/* Account Section */}
        <SettingSection title="Account">
          <SettingItem
            icon="key-outline"
            title="Change Password"
            onPress={() => router.push('/(auth)/forgot-password')}
          />
          <SettingItem
            icon="ban-outline"
            title="Blocked Users"
            onPress={() => router.push('/(app)/settings/blocked')}
          />
          <SettingItem
            icon="phone-portrait-outline"
            title="Active Devices"
            onPress={() => router.push('/(app)/settings/devices')}
          />
        </SettingSection>

        {/* Security Section */}
        <SettingSection title="Security">
          <SettingItem
            icon="finger-print"
            title={Platform.OS === 'ios' ? 'Face ID / Touch ID' : 'Biometric Lock'}
            subtitle="Use biometrics to unlock the app"
            rightElement={
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#FFFFFF"
              />
            }
            showChevron={false}
          />
          <SettingItem
            icon="shield-checkmark-outline"
            title="Security Settings"
            onPress={() => router.push('/(app)/settings/security')}
          />
        </SettingSection>

        {/* Notifications Section */}
        <SettingSection title="Notifications">
          <SettingItem
            icon="notifications-outline"
            title="Push Notifications"
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#FFFFFF"
              />
            }
            showChevron={false}
          />
        </SettingSection>

        {/* About Section */}
        <SettingSection title="About">
          <SettingItem
            icon="document-text-outline"
            title="Terms of Service"
            onPress={() => WebBrowser.openBrowserAsync(EXTERNAL_URLS.TERMS_OF_SERVICE)}
          />
          <SettingItem
            icon="shield-outline"
            title="Privacy Policy"
            onPress={() => WebBrowser.openBrowserAsync(EXTERNAL_URLS.PRIVACY_POLICY)}
          />
          <SettingItem
            icon="help-circle-outline"
            title="Support"
            onPress={() => WebBrowser.openBrowserAsync(EXTERNAL_URLS.SUPPORT)}
          />
          <SettingItem
            icon="information-circle-outline"
            title="Version"
            subtitle={APP_CONFIG.APP_VERSION}
            showChevron={false}
          />
        </SettingSection>

        {/* Danger Zone */}
        <SettingSection title="Danger Zone">
          <SettingItem
            icon="log-out-outline"
            title="Log Out"
            onPress={handleLogout}
            danger
          />
          <SettingItem
            icon="trash-outline"
            title="Delete Account"
            subtitle="Permanently delete your account"
            onPress={handleDeleteAccount}
            danger
          />
        </SettingSection>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            {APP_CONFIG.APP_NAME} v{APP_CONFIG.APP_VERSION}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
  },
  headerGlass: {
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
  },
  headerTitle: {
    fontSize: Layout.fontSize.largeTitle,
    fontWeight: Layout.fontWeight.bold,
  },
  scrollContent: {
    paddingBottom: Layout.spacing.xxl,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Layout.spacing.lg,
    marginTop: Layout.spacing.md,
    marginBottom: Layout.spacing.lg,
    padding: Layout.spacing.lg,
    borderRadius: Layout.radius.lg,
  },
  profileInfo: {
    marginLeft: Layout.spacing.lg,
    flex: 1,
  },
  profileName: {
    fontSize: Layout.fontSize.xl,
    fontWeight: Layout.fontWeight.bold,
  },
  profileEmail: {
    fontSize: Layout.fontSize.sm,
    marginTop: 2,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Layout.spacing.sm,
  },
  editProfileText: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.medium,
  },
  section: {
    marginBottom: Layout.spacing.lg,
  },
  sectionTitle: {
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
    textTransform: 'uppercase',
    marginLeft: Layout.spacing.lg,
    marginBottom: Layout.spacing.sm,
  },
  sectionContent: {
    marginHorizontal: Layout.spacing.lg,
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Layout.spacing.md,
    paddingHorizontal: Layout.spacing.md,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
    marginLeft: Layout.spacing.md,
  },
  settingTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.medium,
  },
  settingSubtitle: {
    fontSize: Layout.fontSize.xs,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Layout.spacing.lg,
  },
  footerText: {
    fontSize: Layout.fontSize.xs,
  },
  themeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical: Layout.spacing.xs,
    borderRadius: Layout.radius.sm,
    gap: 4,
  },
  themeBadgeText: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.medium,
  },
});
