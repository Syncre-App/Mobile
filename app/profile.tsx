import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBackground } from '../components/AppBackground';
import { UpdateService } from '../services/UpdateService';
import { font, palette, spacing, radii } from '../theme/designSystem';

const HEADER_BUTTON_DIMENSION = spacing.sm * 2 + 24;

export default function ProfileScreen() {
  const router = useRouter();
  const appVersion = UpdateService.getCurrentVersion();
  const insets = useSafeAreaInsets();
  const minTopPadding = spacing.lg;
  const extraTopPadding = Math.max(minTopPadding - insets.top, 0);

  const handleBack = () => {
    router.back();
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          onPress: async () => {
            const [{ StorageService }, { CryptoService }, { PinService }] = await Promise.all([
              import('../services/StorageService'),
              import('../services/CryptoService'),
              import('../services/PinService'),
            ]);
            await Promise.all([
              CryptoService.resetIdentity(),
              PinService.clearPin(),
              StorageService.removeAuthToken(),
            ]);
            router.replace('/' as any);
          },
          style: 'destructive',
        },
      ]
    );
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    subtitle?: string,
    onPress?: () => void,
    rightComponent?: React.ReactNode
  ) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={styles.settingItem}
    >
      <View style={styles.settingLeft}>
        <Ionicons name={icon as any} size={24} color="rgba(255, 255, 255, 0.7)" />
        <View style={styles.settingTexts}>
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
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentColumn}>
        {/* Account Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Account</Text>
          </View>
          
          {renderSettingItem(
            'person',
            'Edit Profile',
            'Update your profile information',
            () => {
              router.push('/settings/edit-profile' as any);
            }
          )}
          
          {renderSettingItem(
            'settings',
            'Settings',
            'App settings',
            () => {
              router.push('/settings' as any);
            }
          )}

          {renderSettingItem(
            'lock-closed',
            'Privacy',
            'Manage your privacy settings',
            () => {
              router.push('/settings/privacy' as any);
            }
          )}
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>About</Text>
          </View>
          
          {renderSettingItem(
            'information-circle',
            'About Syncre',
            `Version ${appVersion}`,
            () => {
              Alert.alert(
                'About Syncre',
                `Syncre is a modern chat application built with React Native and Expo.\n\nVersion: ${appVersion}\nBuilt with ❤️ by the Syncre team`
              );
            }
          )}
          
          {renderSettingItem(
            'help-circle',
            'Help & Support',
            'Get help and contact support',
            () => {
              Alert.alert('Help & Support', 'Support will be available in future updates');
            }
          )}
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          {renderSettingItem(
            'log-out',
            'Logout',
            'Sign out of your account',
            handleLogout
          )}
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
  headerPlaceholder: {
    width: HEADER_BUTTON_DIMENSION,
    height: HEADER_BUTTON_DIMENSION,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    ...font('display'),
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
    alignItems: 'stretch',
  },
  contentColumn: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  section: {
    marginBottom: spacing.md,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    ...font('semibold'),
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
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
    color: 'white',
    fontSize: 16,
    ...font('medium'),
  },
  settingSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 2,
    ...font('regular'),
  },
  settingRight: {
    marginLeft: spacing.md,
  },
});
