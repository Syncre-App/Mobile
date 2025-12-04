import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { AppBackground } from '../components/AppBackground';
import { palette, radii, spacing } from '../theme/designSystem';

const HEADER_BUTTON_DIMENSION = spacing.sm * 2 + 24;

export const PrivacyScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const minTopPadding = spacing.lg;
  const extraTopPadding = Math.max(minTopPadding - insets.top, 0);
  
  const [contentFilter, setContentFilter] = useState<'standard' | 'none'>('standard');
  const [readReceipts, setReadReceipts] = useState(true);
  const [lastSeen, setLastSeen] = useState(true);
  const [typingIndicator, setTypingIndicator] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      const filter = await StorageService.getContentFilter();
      setContentFilter(filter);
      
      // Load other privacy settings
      const receipts = await StorageService.getReadReceipts();
      setReadReceipts(receipts);
      const seen = await StorageService.getLastSeen();
      setLastSeen(seen);
      const typing = await StorageService.getTypingIndicator();
      setTypingIndicator(typing);
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

  const handleReadReceiptsChange = async (value: boolean) => {
    setReadReceipts(value);
    await StorageService.setReadReceipts(value);
    NotificationService.show('success', value ? 'Read receipts enabled' : 'Read receipts disabled');
  };

  const handleLastSeenChange = async (value: boolean) => {
    setLastSeen(value);
    await StorageService.setLastSeen(value);
    NotificationService.show('success', value ? 'Last seen visible' : 'Last seen hidden');
  };

  const handleTypingIndicatorChange = async (value: boolean) => {
    setTypingIndicator(value);
    await StorageService.setTypingIndicator(value);
    NotificationService.show('success', value ? 'Typing indicator enabled' : 'Typing indicator disabled');
  };

  const handleBlockedUsers = () => {
    router.push('/blocked-users' as any);
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
            contentFilter === 'standard' ? 'Standard (blur offensive content)' : 'None (no filtering)',
            handleContentFilterChange,
            undefined,
            false
          )}
        </GlassCard>

        {/* Activity Status Section */}
        <GlassCard width="100%" style={styles.section} variant="subtle">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Activity Status</Text>
          </View>
          
          {renderSettingItem(
            'checkmark-done-outline',
            'Read Receipts',
            'Let others know when you\'ve read their messages',
            undefined,
            <Switch
              value={readReceipts}
              onValueChange={handleReadReceiptsChange}
              trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: palette.accent }}
              thumbColor="white"
            />,
            false
          )}

          {renderSettingItem(
            'time-outline',
            'Last Seen',
            'Show when you were last active',
            undefined,
            <Switch
              value={lastSeen}
              onValueChange={handleLastSeenChange}
              trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: palette.accent }}
              thumbColor="white"
            />,
            true
          )}

          {renderSettingItem(
            'ellipsis-horizontal',
            'Typing Indicator',
            'Show when you\'re typing a message',
            undefined,
            <Switch
              value={typingIndicator}
              onValueChange={handleTypingIndicatorChange}
              trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: palette.accent }}
              thumbColor="white"
            />,
            true
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
