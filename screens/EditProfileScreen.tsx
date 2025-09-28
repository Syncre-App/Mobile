import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { GlassCard } from '../components/GlassCard';
import { TransparentField } from '../components/TransparentField';
import { ApiService } from '../services/ApiService';
import { NotificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';

interface User {
  id: string;
  username: string;
  email: string;
  bio?: string;
  [key: string]: any;
}

export const EditProfileScreen: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setInitialLoading(true);
      const token = await StorageService.getAuthToken();
      
      if (!token) {
        router.replace('/' as any);
        return;
      }

      const response = await ApiService.get('/user/me', token);
      
      if (response.success && response.data) {
        const userData = response.data;
        setUser(userData);
        setUsername(userData.username || '');
        setEmail(userData.email || '');
        setBio(userData.bio || '');
      } else {
        NotificationService.show('error', response.error || 'Failed to load profile');
        router.back();
      }
    } catch (error: any) {
      console.log('❌ Error loading user profile:', error);
      NotificationService.show('error', 'Failed to load profile');
      router.back();
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    if (!username.trim() || !email.trim()) {
      NotificationService.show('warning', 'Username and email are required');
      return;
    }

    setLoading(true);

    try {
      const token = await StorageService.getAuthToken();
      
      if (!token) {
        router.replace('/' as any);
        return;
      }

      const response = await ApiService.put('/user/profile', {
        username: username.trim(),
        email: email.trim(),
        bio: bio.trim(),
      }, token);

      if (response.success) {
        NotificationService.show('success', 'Profile updated successfully!');
        router.back();
      } else {
        NotificationService.show('error', response.error || 'Failed to update profile');
      }
    } catch (error: any) {
      console.log('❌ Error updating profile:', error);
      NotificationService.show('error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Changes',
      'Are you sure you want to cancel? Your changes will be lost.',
      [
        {
          text: 'Keep Editing',
          style: 'cancel',
        },
        {
          text: 'Cancel',
          onPress: () => router.back(),
          style: 'destructive',
        },
      ]
    );
  };

  if (initialLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#03040A', '#071026']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2C82FF" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

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
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
  <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity 
          onPress={handleSave} 
          disabled={loading}
          style={styles.headerButton}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#2C82FF" />
          ) : (
            <Ionicons name="checkmark" size={24} color="#2C82FF" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.formCard}>
          <View style={styles.formContainer}>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Username</Text>
              <TransparentField
                placeholder="Enter your username"
                value={username}
                onChangeText={setUsername}
                prefixIcon={
                  <Ionicons name="person" size={18} color="rgba(255, 255, 255, 0.7)" />
                }
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TransparentField
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                prefixIcon={
                  <Ionicons name="mail" size={18} color="rgba(255, 255, 255, 0.7)" />
                }
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Bio</Text>
              <TransparentField
                placeholder="Tell us about yourself..."
                value={bio}
                onChangeText={setBio}
                prefixIcon={
                  <Ionicons name="document-text" size={18} color="rgba(255, 255, 255, 0.7)" />
                }
                style={styles.bioField}
              />
            </View>
          </View>
        </GlassCard>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            style={styles.saveButton}
          >
            <LinearGradient
              colors={['#2C82FF', '#0EA5FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveButtonGradient}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    marginTop: 16,
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
  },
  formCard: {
    width: '100%',
    marginBottom: 24,
  },
  formContainer: {
    padding: 20,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  bioField: {
    minHeight: 80,
  },
  buttonContainer: {
    alignItems: 'center',
  },
  saveButton: {
    width: '100%',
    marginBottom: 12,
  },
  saveButtonGradient: {
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
});
