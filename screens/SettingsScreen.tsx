import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '../components/GlassCard';
import { NotificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';
import { UpdateService } from '../services/UpdateService';
import { AppBackground } from '../components/AppBackground';
import { palette, radii, spacing } from '../theme/designSystem';

const HEADER_BUTTON_DIMENSION = spacing.sm * 2 + 24;

export const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const minTopPadding = spacing.lg;
  const extraTopPadding = Math.max(minTopPadding - insets.top, 0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true); // Always true for now
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [updateInProgress, setUpdateInProgress] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const appVersion = UpdateService.getCurrentVersion();

  const handleBack = () => {
    router.back();
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data. Are you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          onPress: async () => {
            try {
              // Clear cache but keep auth token
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

  const handleInstallApkUpdate = async () => {
    if (updateInProgress) return;
    setUpdateInProgress(true);
    setUpdateProgress(0);
    setUpdateStatus('Frissítés ellenőrzése...');

    try {
      await UpdateService.downloadAndInstallLatest((progress) => {
        setUpdateProgress(progress);
        setUpdateStatus(`Letöltés: ${Math.round(progress * 100)}%`);
      });
      setUpdateStatus('Letöltés kész, telepítő indítása...');
    } catch (error: any) {
      NotificationService.show('error', error?.message || 'Frissítés sikertelen');
      setUpdateStatus(null);
    } finally {
      setUpdateInProgress(false);
      setTimeout(() => setUpdateProgress(0), 800);
    }
  };

  const renderSettingItem = (
    icon: string | null,
    title: string,
    subtitle?: string,
    onPress?: () => void,
    rightComponent?: React.ReactNode,
    hasTopBorder: boolean = true,
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
      
      {rightComponent && (
        <View style={styles.settingRight}>
          {rightComponent}
        </View>
      )}
      
      {onPress && !rightComponent && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color="rgba(255, 255, 255, 0.3)"
        />
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

        {/* Absolutely centered title so it aligns with centered cards */}
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
        <GlassCard width="100%" style={styles.section} variant="subtle">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>
          
          {renderSettingItem(
            'notifications',
            'Push Notifications',
            'Receive notifications for new messages',
            undefined,
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: palette.accent }}
              thumbColor="white"
            />,
            false
          )}
        </GlassCard>

        {/* Appearance Section */}
        <GlassCard width="100%" style={styles.section} variant="subtle">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Appearance</Text>
          </View>
          
          {renderSettingItem(
            'moon',
            'Dark Mode',
            'Currently enabled by default',
            undefined,
            <Switch
              value={darkModeEnabled}
              onValueChange={setDarkModeEnabled}
              disabled={true} // Disabled for now
              trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: palette.accent }}
              thumbColor="white"
            />,
            false
          )}
          
          {renderSettingItem(
            'language',
            'Language',
            selectedLanguage,
            () => {
              Alert.alert('Language', 'Multiple languages will be supported in future updates');
            }
          )}
        </GlassCard>

        {/* Storage Section */}
        <GlassCard width="100%" style={styles.section} variant="subtle">
          <View style={styles.sectionHeader}>
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
        </GlassCard>

        {/* Safety & Reporting Section */}
        <GlassCard width="100%" style={styles.section} variant="subtle">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Safety & Reporting</Text>
          </View>
          
          {renderSettingItem(
            'ban',
            'Blocked Users',
            'Manage blocked users',
            () => router.push('/settings/blocked-users'),
            undefined,
            false
          )}

          {renderSettingItem(
            'flag',
            'Report Content',
            'Long-press any message to report',
            () => {
              Alert.alert(
                'How to Report Content',
                'To report objectionable content or users:\n\n• Long-press on any message in a chat\n• Select "Report" from the menu\n• Our team will review the report\n\nYou can also block users to prevent them from contacting you.',
                [{ text: 'Got it', style: 'default' }]
              );
            }
          )}

          {renderSettingItem(
            'shield-checkmark',
            'Community Guidelines',
            'View our content policies',
            () => Linking.openURL('https://syncre.app/terms')
          )}
        </GlassCard>

        {/* Updates Section */}
        <GlassCard width="100%" style={styles.section} variant="subtle">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Updates</Text>
          </View>

          {renderSettingItem(
            'cloud-download',
            'Android APK frissítés',
            updateStatus || 'Letöltés és telepítés közvetlenül GitHubról',
            handleInstallApkUpdate,
            updateInProgress ? (
              <View style={styles.progressRow}>
                <ActivityIndicator color={palette.text} />
                <Text style={styles.progressText}>
                  {`${Math.round(updateProgress * 100)}%`}
                </Text>
              </View>
            ) : (
              <View style={styles.pillButton}>
                <Text style={styles.pillButtonText}>Frissítés</Text>
              </View>
            ),
            false
          )}
        </GlassCard>

        {/* About Section */}
        <GlassCard width="100%" style={styles.section} variant="subtle">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>About</Text>
          </View>

          {renderSettingItem(
            null,
            'App Version',
            appVersion,
            undefined,
            undefined,
            false
          )}
        </GlassCard>

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
    fontFamily: 'SpaceGrotesk-SemiBold',
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'stretch',
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
  headerCentered: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressText: {
    color: palette.text,
    fontSize: 14,
    marginLeft: spacing.xs,
  },
  pillButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.xl,
    backgroundColor: palette.accent,
  },
  pillButtonText: {
    color: 'white',
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
  },
});
