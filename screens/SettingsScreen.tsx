import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch as RNSwitch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';
import { UpdateService } from '../services/UpdateService';
import { ApiService } from '../services/ApiService';
import { AppBackground } from '../components/AppBackground';
import { font, palette, radii, spacing } from '../theme/designSystem';
import { SpotifyConnection } from '../components/SpotifyConnection';

const HEADER_BUTTON_DIMENSION = spacing.sm * 2 + 24;

export const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const minTopPadding = spacing.lg;
  const extraTopPadding = Math.max(minTopPadding - insets.top, 0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true);
  const [devWrapUserId, setDevWrapUserId] = useState('');
  const [devWrapLoading, setDevWrapLoading] = useState(false);
  const appVersion = UpdateService.getCurrentVersion();

  const handleBack = () => {
    router.back();
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            try {
              const token = await StorageService.getAuthToken();
              await StorageService.clear();
              if (token) {
                await StorageService.setAuthToken(token);
              }
              NotificationService.show('success', 'Cache cleared successfully');
            } catch (error) {
              NotificationService.show('error', 'Failed to clear cache');
            }
          },
        },
      ]
    );
  };

  const handleBlockedUsers = () => {
    router.push('/settings/blocked-users');
  };

  const handleChangePassword = () => {
    router.push('/settings/change-password');
  };

  const handleReportInfo = () => {
    Alert.alert(
      'How to Report Content',
      'To report objectionable content or users:\n\n- Long-press on any message in a chat\n- Select "Report" from the menu\n- Our team will review the report\n\nYou can also block users to prevent them from contacting you.',
      [{ text: 'Got it', style: 'default' }]
    );
  };

  const handleCommunityGuidelines = () => {
    Linking.openURL('https://syncre.app/terms');
  };

  const handleLanguagePress = () => {
    Alert.alert('Language', 'Multiple languages will be supported in future updates');
  };

  const handleSendDevWrap = async () => {
    if (!devWrapUserId.trim()) {
      NotificationService.show('error', 'Please enter a user ID');
      return;
    }
    setDevWrapLoading(true);
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        NotificationService.show('error', 'Not authenticated');
        return;
      }
      const response = await ApiService.post(
        '/admin/send-wrap',
        { userId: devWrapUserId.trim() },
        token
      );
      if (response.success) {
        NotificationService.show('success', 'Wrap sent successfully');
        setDevWrapUserId('');
      } else {
        NotificationService.show('error', response.error || 'Failed to send wrap');
      }
    } catch (error: any) {
      NotificationService.show('error', error?.message || 'Failed to send wrap');
    } finally {
      setDevWrapLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // Android / Fallback: React Native components
  // ═══════════════════════════════════════════════════════════════

  const renderSettingItem = (
    icon: string | null,
    title: string,
    subtitle?: string,
    onPress?: () => void,
    rightComponent?: React.ReactNode,
    hasTopBorder: boolean = true
  ) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[styles.settingItem, !hasTopBorder && styles.settingItemFirst]}
    >
      <View style={styles.settingLeft}>
        {icon ? (
          <Ionicons name={icon as any} size={24} color="rgba(255, 255, 255, 0.7)" />
        ) : null}
        <View style={[styles.settingTexts, !icon && styles.settingTextsNoIcon]}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>

      {rightComponent && <View style={styles.settingRight}>{rightComponent}</View>}

      {onPress && !rightComponent && (
        <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.3)" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[styles.container, { paddingTop: extraTopPadding }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerCentered} pointerEvents="none">
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Notifications Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderView}>
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>
          {renderSettingItem(
            'notifications',
            'Push Notifications',
            'Receive notifications for new messages',
            undefined,
            <RNSwitch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: palette.accent }}
              thumbColor="white"
            />,
            false
          )}
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderView}>
            <Text style={styles.sectionTitle}>Appearance</Text>
          </View>
          {renderSettingItem(
            'moon',
            'Dark Mode',
            'Currently enabled by default',
            undefined,
            <RNSwitch
              value={darkModeEnabled}
              onValueChange={setDarkModeEnabled}
              disabled={true}
              trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: palette.accent }}
              thumbColor="white"
            />,
            false
          )}
          {renderSettingItem('language', 'Language', 'English', handleLanguagePress)}
        </View>

        {/* Storage Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderView}>
            <Text style={styles.sectionTitle}>Storage</Text>
          </View>
          {renderSettingItem(
            'trash',
            'Clear Cache',
            'Clear cached data to free up space',
            handleClearCache,
            undefined,
            false
          )}
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderView}>
            <Text style={styles.sectionTitle}>Account</Text>
          </View>
          {renderSettingItem(
            'key',
            'Change Password',
            'Update your account password',
            handleChangePassword,
            undefined,
            false
          )}
        </View>

        {/* Safety Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderView}>
            <Text style={styles.sectionTitle}>Safety & Reporting</Text>
          </View>
          {renderSettingItem('ban', 'Blocked Users', 'Manage blocked users', handleBlockedUsers, undefined, false)}
          {renderSettingItem('flag', 'Report Content', 'Long-press any message to report', handleReportInfo)}
          {renderSettingItem('shield-checkmark', 'Community Guidelines', 'View our content policies', handleCommunityGuidelines)}
        </View>

        {/* Integrations Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderView}>
            <Text style={styles.sectionTitle}>Integrations</Text>
          </View>
          <SpotifyConnection />
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderView}>
            <Text style={styles.sectionTitle}>About</Text>
          </View>
          {renderSettingItem(null, 'App Version', appVersion, undefined, undefined, false)}
        </View>

        {/* Developer Tools Section */}
        {__DEV__ && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderView}>
              <Text style={styles.sectionTitle}>Developer Tools</Text>
            </View>
            <View style={styles.devToolItem}>
              <Text style={styles.devToolLabel}>Send Wrap to User ID</Text>
              <View style={styles.devToolRow}>
                <TextInput
                  style={styles.devToolInput}
                  placeholder="User ID"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={devWrapUserId}
                  onChangeText={setDevWrapUserId}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.devToolButton, devWrapLoading && styles.devToolButtonDisabled]}
                  onPress={handleSendDevWrap}
                  disabled={devWrapLoading}
                >
                  <Text style={styles.devToolButtonText}>
                    {devWrapLoading ? 'Sending...' : 'Send'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    position: 'relative',
  },
  headerButton: {
    width: HEADER_BUTTON_DIMENSION,
    height: HEADER_BUTTON_DIMENSION,
    padding: spacing.sm,
    borderRadius: radii.xxl,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPlaceholder: {
    width: HEADER_BUTTON_DIMENSION,
    height: HEADER_BUTTON_DIMENSION,
  },
  headerTitle: {
    color: palette.text,
    fontSize: 20,
    ...font('display'),
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
  content: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'stretch',
  },
  integrationsSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  sectionHeaderView: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    ...font('semibold'),
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
  settingTextsNoIcon: {
    marginLeft: 0,
  },
  settingTitle: {
    color: palette.text,
    fontSize: 16,
    ...font('semibold'),
  },
  settingSubtitle: {
    color: palette.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  settingRight: {
    marginLeft: spacing.md,
  },
  devToolItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  devToolLabel: {
    color: palette.text,
    fontSize: 14,
    ...font('medium'),
    marginBottom: spacing.sm,
  },
  devToolRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  devToolInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: palette.text,
    fontSize: 14,
  },
  devToolButton: {
    backgroundColor: palette.accent,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  devToolButtonDisabled: {
    opacity: 0.5,
  },
  devToolButtonText: {
    color: palette.text,
    fontSize: 14,
    ...font('semibold'),
  },
});
