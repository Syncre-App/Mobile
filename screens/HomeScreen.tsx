import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { ChatListWidget } from '../components/ChatListWidget';
import { FriendSearchWidget } from '../components/FriendSearchWidget';
import { GlassCard } from '../components/GlassCard';
import { ProfileHeaderWidget } from '../components/ProfileHeaderWidget';
import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { WebSocketService } from '../services/WebSocketService';

export const HomeScreen: React.FC = () => {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [userStatuses, setUserStatuses] = useState<any>({});
  
  useEffect(() => {
    initializeScreen();
    connectWebSocket();
  }, []);

  const initializeScreen = async () => {
    try {
      const userData = await StorageService.getObject('user_data');
      setUser(userData);
      await loadChats();
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  const loadChats = async () => {
    setChatsLoading(true);
    try {
      const token = await StorageService.getAuthToken();
      if (token) {
        const response = await ApiService.get('/chats', token);
        if (response.success) {
          setChats(response.data || []);
        }
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setChatsLoading(false);
    }
  };

  const connectWebSocket = async () => {
    try {
      const wsService = WebSocketService.getInstance();
      await wsService.connect();
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await initializeScreen();
    setRefreshing(false);
  };

  const handleSettingsPress = () => {
    router.push('/settings' as any);
  };

  const handleProfilePress = () => {
    router.push('/edit-profile' as any);
  };

  const handleFriendAdded = () => {
    // Refresh chat list when new friend is added
    handleRefresh();
  };

  const handleChatRefresh = () => {
    loadChats();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={StyleSheet.absoluteFillObject}
      />
      
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <GlassCard style={styles.headerCard}>
              <View style={styles.headerContent}>
                <View style={styles.titleContainer}>
                  <Text style={styles.appName}>Syncre</Text>
                  <Text style={styles.subtitle}>Chat & Connect</Text>
                </View>
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    style={styles.headerButton}
                    onPress={handleProfilePress}
                  >
                    <Ionicons name="person" size={24} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.headerButton}
                    onPress={handleSettingsPress}
                  >
                    <Ionicons name="settings" size={24} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>
          </View>

          {/* Profile Header */}
          <View style={styles.section}>
            {user && (
              <ProfileHeaderWidget 
                user={user}
                userStatuses={userStatuses}
              />
            )}
          </View>

          {/* Friend Search */}
          <View style={styles.section}>
            <FriendSearchWidget onFriendAdded={handleFriendAdded} />
          </View>

          {/* Chat List */}
          <View style={styles.section}>
            <ChatListWidget 
              chats={chats}
              isLoading={chatsLoading}
              onRefresh={handleChatRefresh}
              userStatuses={userStatuses}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerCard: {
    padding: 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  titleContainer: {
    flex: 1,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
