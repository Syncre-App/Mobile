import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '../components/GlassCard';
import { NotificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';
import { ApiService } from '../services/ApiService';
import { CryptoService } from '../services/CryptoService';
import { IdentityService } from '../services/IdentityService';
import { AppBackground } from '../components/AppBackground';
import { palette, radii, spacing } from '../theme/designSystem';

const HEADER_BUTTON_DIMENSION = spacing.sm * 2 + 24;

export const PrivacyScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const minTopPadding = spacing.lg;
  const extraTopPadding = Math.max(minTopPadding - insets.top, 0);
  
  const [contentFilter, setContentFilter] = useState<'standard' | 'none'>('standard');
  const [isRotatingKeys, setIsRotatingKeys] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [botStatus, setBotStatus] = useState<'pending' | 'approved' | null>(null);
  const [isLoadingBotStatus, setIsLoadingBotStatus] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      const filter = await StorageService.getContentFilter();
      setContentFilter(filter);
      
      // Load bot status
      try {
        const token = await StorageService.getAuthToken();
        if (token) {
          const response = await ApiService.get('/user/bot-status', token) as { success: boolean; bot_status?: 'pending' | 'approved' | null };
          if (response.success) {
            setBotStatus(response.bot_status ?? null);
          }
        }
      } catch (error) {
        console.error('Failed to load bot status:', error);
      } finally {
        setIsLoadingBotStatus(false);
      }
    };
    loadSettings();
  }, []);

  const handleContentFilterChange = async () => {
    const options = [
      { text: 'Standard', value: 'standard' as const },
      { text: 'None (No filtering)', value: 'none' as const },
    ];
    Alert.alert(
      'Content Filter',
      'Standard mode blurs potentially offensive messages. Tap to reveal them.\n\nNone disables all filtering.',
      [
        ...options.map((opt) => ({
          text: opt.value === contentFilter ? `✓ ${opt.text}` : opt.text,
          onPress: async () => {
            setContentFilter(opt.value);
            await StorageService.setContentFilter(opt.value);
            NotificationService.show('success', `Content filter set to ${opt.text}`);
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  const handleBotAccountPress = () => {
    if (botStatus === 'approved') {
      Alert.alert(
        'Bot Account',
        'This account is a verified bot account. Bot accounts can be used for automated services and integrations.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (botStatus === 'pending') {
      Alert.alert(
        'Verification Pending',
        'Your bot account request is being reviewed. This usually takes 1-2 business days.',
        [
          { text: 'OK' },
          {
            text: 'Cancel Request',
            style: 'destructive',
            onPress: handleCancelBotRequest,
          },
        ]
      );
      return;
    }

    // No bot status - show request dialog
    Alert.alert(
      'Bot Account',
      'Mark this account as a bot account for SDK/API integrations.\n\nBot accounts:\n• Can use the Syncre SDK\n• Are marked with a Bot badge\n• Cannot be used for regular messaging\n\nThis requires manual verification.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Bot Status',
          onPress: () => {
            Alert.prompt(
              'Bot Request Reason',
              'Please describe why you need a bot account (e.g., what service/integration you\'re building):',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Submit',
                  onPress: (reason: string | undefined) => handleRequestBotAccount(reason || ''),
                },
              ],
              'plain-text'
            );
          },
        },
      ]
    );
  };

  const handleRequestBotAccount = async (reason: string) => {
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        NotificationService.show('error', 'Please log in again');
        return;
      }

      const response = await ApiService.post('/user/request-bot', { reason }, token);
      if (response.success) {
        setBotStatus('pending');
        NotificationService.show('success', 'Bot account request submitted');
      } else {
        NotificationService.show('error', response.error || 'Failed to submit request');
      }
    } catch (error) {
      console.error('Failed to request bot account:', error);
      NotificationService.show('error', 'Failed to submit request');
    }
  };

  const handleCancelBotRequest = async () => {
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        NotificationService.show('error', 'Please log in again');
        return;
      }

      const response = await ApiService.post('/user/cancel-bot-request', {}, token);
      if (response.success) {
        setBotStatus(null);
        NotificationService.show('success', 'Bot request cancelled');
      } else {
        NotificationService.show('error', response.error || 'Failed to cancel request');
      }
    } catch (error) {
      console.error('Failed to cancel bot request:', error);
      NotificationService.show('error', 'Failed to cancel request');
    }
  };

  const handleBlockedUsers = () => {
    router.push('/settings/blocked-users' as any);
  };

  const handleRotateKeys = async () => {
    if (isRotatingKeys || isBootstrapping) {
      return;
    }

    Alert.alert(
      'Rotate encryption keys',
      'This will revoke the current device keys, request history re-encrypt from others, and restart your secure identity.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rotate',
          style: 'destructive',
          onPress: async () => {
            setIsRotatingKeys(true);
            try {
              await CryptoService.rotateDeviceIdentity();
              NotificationService.show('success', 'Keys rotated. Rebooting identity…');
              setIsBootstrapping(true);
              const needsBootstrap = await IdentityService.requiresBootstrap();
              if (needsBootstrap) {
                router.push('/identity');
                IdentityService.startBootstrapWatcher({
                  onComplete: () => setIsBootstrapping(false),
                });
              } else {
                NotificationService.show('info', 'Identity already initialized. You may need to relaunch.');
                setIsBootstrapping(false);
              }
            } catch (error) {
              NotificationService.show('error', 'Failed to rotate keys. Please try again.');
            } finally {
              setIsRotatingKeys(false);
              setIsBootstrapping(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenTerms = () => {
    Linking.openURL('https://syncre.xyz/terms').catch(() => {
      NotificationService.show('error', 'Could not open the terms page');
    });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'We will log you out and schedule deletion in 24 hours. Signing back in during that window will cancel it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Schedule deletion',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await StorageService.getAuthToken();
              if (!token) {
                NotificationService.show('error', 'Please log in again to manage your account');
                router.replace('/' as any);
                return;
              }
              const response = await ApiService.post('/user/delete-account', {}, token);
              if (response.success) {
                NotificationService.show('success', 'Deletion scheduled. We logged you out.');
                await StorageService.clear();
                router.replace('/' as any);
              } else {
                NotificationService.show('error', response.error || 'Failed to schedule deletion');
              }
            } catch (error: any) {
              NotificationService.show('error', error?.message || 'Failed to schedule deletion');
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    router.back();
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
      disabled={!onPress && !rightComponent}
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

        <View style={styles.headerCentered} pointerEvents="none">
          <Text style={styles.headerTitle}>Privacy</Text>
        </View>

        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Content Filter Section */}
        <GlassCard width="100%" style={styles.section} variant="subtle">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Content</Text>
          </View>
          
          {renderSettingItem(
            'shield-checkmark-outline',
            'Content Filter',
            contentFilter === 'standard' ? 'Standard (blur offensive)' : 'None',
            handleContentFilterChange,
            undefined,
            false
          )}
        </GlassCard>

        {/* Blocked Users Section */}
        <GlassCard width="100%" style={styles.section} variant="subtle">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Blocked</Text>
          </View>
          
          {renderSettingItem(
            'ban-outline',
            'Blocked Users',
            'Manage your blocked users list',
            handleBlockedUsers,
            undefined,
            false
          )}
        </GlassCard>

        {/* Account Section */}
        <GlassCard width="100%" style={styles.section} variant="subtle">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Account</Text>
          </View>
          
          {renderSettingItem(
            'key-outline',
            'Rotate encryption keys',
            isRotatingKeys
              ? 'Rotating…'
              : isBootstrapping
                ? 'Bootstrapping…'
                : 'Refresh device keys',
            handleRotateKeys,
            (isRotatingKeys || isBootstrapping) ? (
              <ActivityIndicator size="small" color={palette.accent} />
            ) : undefined,
            false
          )}

          {renderSettingItem(
            'document-text-outline',
            'Terms of Service',
            'Read the Syncre EULA',
            handleOpenTerms,
            undefined,
            true
          )}

          {renderSettingItem(
            'trash-bin-outline',
            'Delete account',
            'Permanently delete your account',
            handleDeleteAccount,
            undefined,
            true
          )}
        </GlassCard>

        {/* Developer Section */}
        <GlassCard width="100%" style={styles.section} variant="subtle">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Developer</Text>
          </View>
          
          {renderSettingItem(
            'hardware-chip-outline',
            'Bot Account',
            isLoadingBotStatus
              ? 'Loading...'
              : botStatus === 'approved'
                ? 'Verified bot account'
                : botStatus === 'pending'
                  ? 'Verification pending...'
                  : 'Request bot status for SDK integrations',
            handleBotAccountPress,
            isLoadingBotStatus ? (
              <ActivityIndicator size="small" color={palette.accent} />
            ) : botStatus === 'approved' ? (
              <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
            ) : botStatus === 'pending' ? (
              <Ionicons name="time" size={20} color="#f59e0b" />
            ) : undefined,
            false
          )}
        </GlassCard>

        {/* Info Section */}
        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={18} color={palette.textMuted} />
          <Text style={styles.infoText}>
            Your privacy settings are stored locally on this device and synced securely with your account.
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
    borderRadius: radii.md,
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
    paddingTop: spacing.md,
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
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: 440,
    alignSelf: 'center',
  },
  infoText: {
    color: palette.textMuted,
    fontSize: 13,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
});
