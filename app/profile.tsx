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
import { GlassCard } from '../components/GlassCard';
import { AppBackground } from '../components/AppBackground';
import { UpdateService } from '../services/UpdateService';
import { palette } from '../theme/designSystem';

export default function ProfileScreen() {
  const router = useRouter();
  const appVersion = UpdateService.getCurrentVersion();
  const insets = useSafeAreaInsets();
  const minimumTopPadding = 12;
  const safeExtraTop = Math.max(minimumTopPadding - insets.top, 0);

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
      style={[
        styles.container,
        {
          paddingTop: safeExtraTop,
        },
      ]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentColumn}>
        {/* Account Section */}
        <GlassCard width="100%" style={styles.section} variant="subtle">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Account</Text>
          </View>
          
          {renderSettingItem(
            'person',
            'Edit Profile',
            'Update your profile information',
            () => {
              router.push('/edit-profile' as any);
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
              Alert.alert('Privacy', 'Privacy settings will be available in future updates');
            }
          )}
        </GlassCard>

        {/* About Section */}
        <GlassCard width="100%" style={styles.section} variant="subtle">
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
        </GlassCard>

        {/* Logout Section */}
        <GlassCard width="100%" style={styles.section} variant="subtle">
          {renderSettingItem(
            'log-out',
            'Logout',
            'Sign out of your account',
            handleLogout
          )}
        </GlassCard>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPlaceholder: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 32,
    paddingHorizontal: 16,
    alignItems: 'stretch',
  },
  contentColumn: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  section: {
    marginBottom: 16,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTexts: {
    marginLeft: 16,
    flex: 1,
  },
  settingTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 2,
  },
  settingRight: {
    marginLeft: 16,
  },
});
