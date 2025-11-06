import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { StorageService } from '../services/StorageService';
import { UserStatus } from '../services/WebSocketService';

interface User {
  id: string;
  username: string;
  email: string;
  [key: string]: any;
}

interface ProfileHeaderWidgetProps {
  user: User;
  userStatuses?: UserStatus;
}

export const ProfileHeaderWidget: React.FC<ProfileHeaderWidgetProps> = ({
  user,
  userStatuses = {},
}) => {
  const handleMenuPress = () => {
    Alert.alert(
      'Menu',
      'Select an option',
      [
        {
          text: 'Edit Profile',
          onPress: () => router.push('/edit-profile' as any),
        },
        {
          text: 'Settings',
          onPress: () => router.push('/settings' as any),
        },
        {
          text: 'Logout',
          onPress: handleLogout,
          style: 'destructive',
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleLogout = async () => {
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chats</Text>
      
      <TouchableOpacity
        onPress={handleMenuPress}
        style={styles.menuButton}
      >
        <Ionicons
          name="ellipsis-vertical"
          size={24}
          color="rgba(255, 255, 255, 0.7)"
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  menuButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
