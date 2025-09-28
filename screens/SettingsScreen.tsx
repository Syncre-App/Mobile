import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
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

import { GlassCard } from '../components/GlassCard';
import { NotificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';

export const SettingsScreen: React.FC = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true); // Always true for now
  const [selectedLanguage, setSelectedLanguage] = useState('English');

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
            await StorageService.removeAuthToken();
            router.replace('/' as any);
          },
          style: 'destructive',
        },
      ]
    );
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={['#03040A', '#071026']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
  <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Notifications Section */}
        <GlassCard style={styles.section}>
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
              trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: '#2C82FF' }}
              thumbColor="white"
            />
          )}
        </GlassCard>

        {/* Appearance Section */}
        <GlassCard style={styles.section}>
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
              trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: '#2C82FF' }}
              thumbColor="white"
            />
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

        {/* Account Section */}
        <GlassCard style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Account</Text>
          </View>
          
          {renderSettingItem(
            'person',
            'Edit Profile',
            'Update your profile information',
            () => router.push('/edit-profile' as any)
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

        {/* Storage Section */}
        <GlassCard style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Storage</Text>
          </View>
          
          {renderSettingItem(
            'trash',
            'Clear Cache',
            'Clear cached data to free up space',
            handleClearCache
          )}
        </GlassCard>

        {/* About Section */}
        <GlassCard style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>About</Text>
          </View>
          
          {renderSettingItem(
            'information-circle',
            'About Syncre',
            'Version 1.0.0',
            () => {
              Alert.alert(
                'About Syncre',
                'Syncre is a modern chat application built with React Native and Expo.\n\nVersion: 1.0.0\nBuilt with ❤️ by the Syncre team'
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
        <GlassCard style={styles.section}>
          {renderSettingItem(
            'log-out',
            'Logout',
            'Sign out of your account',
            handleLogout
          )}
        </GlassCard>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: (StatusBar.currentHeight || 0) + 12,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 16,
    overflow: 'hidden',
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
