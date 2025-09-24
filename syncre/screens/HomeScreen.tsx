import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { NotificationService } from '../services/NotificationService';
import { WebSocketService, UserStatus } from '../services/WebSocketService';
import { ProfileHeaderWidget } from '../components/ProfileHeaderWidget';
import { FriendSearchWidget } from '../components/FriendSearchWidget';
import { ChatListWidget } from '../components/ChatListWidget';

interface User {
  id: string;
  username: string;
  email: string;
  [key: string]: any;
}

interface Chat {
  id: string;
  [key: string]: any;
}

export const HomeScreen: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [userStatuses, setUserStatuses] = useState<UserStatus>({});
  const [refreshing, setRefreshing] = useState(false);

  const wsService = WebSocketService.getInstance();

  useEffect(() => {
    loadMe();
    initializeWebSocket();

    return () => {
      wsService.disconnect();
    };
  }, []);

  const initializeWebSocket = async () => {
    console.log('🌐 Initializing WebSocket connection...');
    
    // Listen to status changes
    const unsubscribe = wsService.addStatusListener((statuses) => {
      setUserStatuses(statuses);
      console.log('👤 User statuses updated:', Object.keys(statuses).length, 'users');
    });

    // Connect to WebSocket
    await wsService.connect();

    return unsubscribe;
  };

  const loadMe = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🏠 Loading user data...');
      const token = await StorageService.getAuthToken();
      console.log('🏠 Token found:', token ? '✅ Yes' : '❌ No');
      
      if (!token) {
        console.log('❌ No auth token found');
        setError('No auth token found. Please log in.');
        router.replace('/');
        return;
      }

      const response = await ApiService.get('/user/me', token);
      console.log('🏠 Me response:', response);
      
      if (response.success && response.data) {
        console.log('🏠 User data loaded successfully');
        setUser(response.data);
        loadChats();
      } else {
        console.log('❌ Failed to load user data');
        setError(response.error || 'Failed to load user data');
        if (response.statusCode === 401) {
          // Token might be expired
          await StorageService.removeAuthToken();
          router.replace('/');
        }
      }
    } catch (error: any) {
      console.log('❌ Exception loading user data:', error);
      setError(`Error: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const loadChats = async () => {
    try {
      setLoadingChats(true);
      
      console.log('💬 Loading chats...');
      const token = await StorageService.getAuthToken();
      
      if (!token) {
        console.log('❌ No auth token for chats');
        return;
      }
      
      const response = await ApiService.get('/chat/', token);
      console.log('💬 Chats response:', response);
      
      if (response.success) {
        let chatsData: Chat[];
        
        // Handle both array response and object with chats property
        if (Array.isArray(response.data)) {
          chatsData = response.data;
        } else if (response.data && Array.isArray(response.data.chats)) {
          chatsData = response.data.chats;
        } else {
          chatsData = [];
        }
        
        setChats(chatsData);
        
        if (chatsData.length === 0) {
          console.log('💬 No chats found - user has no conversations yet');
        } else {
          console.log('💬 Loaded', chatsData.length, 'chats successfully');
        }
      } else {
        console.log('❌ Failed to load chats:', response.error);
        NotificationService.show('error', response.error || 'Failed to load chats');
      }
    } catch (error: any) {
      console.log('❌ Network error loading chats:', error);
      
      const msg = error.toString();
      if (msg.includes('timeout')) {
        console.log('⏰ Chat loading timed out - this might be normal if server is slow');
      } else if (msg.includes('Connection refused') || msg.includes('Network Error')) {
        NotificationService.show('error', 'Server unavailable - please try again later');
      } else {
        NotificationService.show('error', 'Unable to load chats');
      }
    } finally {
      setLoadingChats(false);
    }
  };

  const handleFriendAdded = useCallback(() => {
    // Add a small delay to ensure server has processed the friend addition
    setTimeout(() => {
      loadChats(); // Reload chats when friend is added
      wsService.refreshFriendsStatus(); // Refresh friends status
    }, 500);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadMe(), loadChats()]);
    setRefreshing(false);
  }, []);

  if (loading) {
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
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#03040A', '#071026']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadMe} style={styles.retryButton}>
            <LinearGradient
              colors={['#2C82FF', '#0EA5FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.retryButtonGradient}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </LinearGradient>
          </TouchableOpacity>
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2C82FF"
            colors={['#2C82FF']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        {user && (
          <ProfileHeaderWidget
            user={user}
            userStatuses={userStatuses}
          />
        )}
        
        {/* Friend Search Widget */}
        <FriendSearchWidget
          onFriendAdded={handleFriendAdded}
        />
        
        {/* Chat List */}
        <ChatListWidget
          chats={chats}
          isLoading={loadingChats}
          onRefresh={loadChats}
          userStatuses={userStatuses}
        />
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    marginTop: 16,
  },
  retryButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: StatusBar.currentHeight || 0,
  },
});
