import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ChatListWidget } from '../components/ChatListWidget';
import { FriendSearchWidget } from '../components/FriendSearchWidget';
import { GlassCard } from '../components/GlassCard';
import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { WebSocketService } from '../services/WebSocketService';

export const HomeScreen: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [userStatuses, setUserStatuses] = useState<any>({});
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  
  useEffect(() => {
    validateTokenAndInit();
  }, []);

  const validateTokenAndInit = async () => {
    try {
      console.log('🔍 HomeScreen: Validating token...');
      const token = await StorageService.getAuthToken();
      
      if (!token) {
        console.log('❌ HomeScreen: No token found - redirect to login');
        router.replace('/');
        return;
      }

      // Test token validity
      const response = await ApiService.get('/user/me', token);
      
      if (response.success) {
        console.log('✅ HomeScreen: Token valid - initializing...');
        setIsValidatingToken(false);
        await initializeScreen();
        connectWebSocket();
      } else {
        console.log('❌ HomeScreen: Token invalid - clearing and redirect to login');
        await StorageService.removeAuthToken();
        await StorageService.removeItem('user_data');
        router.replace('/');
      }
    } catch (error) {
      console.error('❌ HomeScreen: Token validation error:', error);
      await StorageService.removeAuthToken();
      await StorageService.removeItem('user_data');
      router.replace('/');
    }
  };

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
      console.log('loadChats: token=', !!token);
      if (token) {
        // Fix API endpoint to match REST API documentation: /chat instead of /chats
        const response = await ApiService.get('/chat', token);
        console.log('loadChats: response=', response);
        if (response.success && response.data) {
          // API returns { chats: [...] } according to documentation
          setChats(response.data.chats || []);
        } else {
          console.warn('loadChats: failed to fetch chats:', response.error);
        }
      } else {
        console.warn('loadChats: no auth token, skipping chats fetch');
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
    await initializeScreen();
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
        colors={['#03040A', '#071026']}
        style={StyleSheet.absoluteFillObject}
      />
      
      {isValidatingToken ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2C82FF" />
          <Text style={styles.loadingText}>Validating session...</Text>
        </View>
      ) : (
        <SafeAreaView style={styles.safeArea}>
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

          {/* Chat List Title */}
          <View style={styles.titleSection}>
            <Text style={styles.sectionTitle}>Chats</Text>
            <TouchableOpacity style={styles.moreButton}>
              <Ionicons name="ellipsis-vertical" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Chat List - Remove ScrollView to fix VirtualizedLists warning */}
          <View style={styles.chatSection}>
            <ChatListWidget 
              chats={chats}
              isLoading={chatsLoading}
              onRefresh={handleChatRefresh}
              userStatuses={userStatuses}
            />
          </View>

          {/* Friend Search - moved to bottom */}
          <View style={styles.section}>
            <FriendSearchWidget onFriendAdded={handleFriendAdded} />
          </View>
        </SafeAreaView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#03040A', // Dark theme to match login
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 16,
    fontSize: 16,
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
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  moreButton: {
    padding: 8,
  },
  chatSection: {
    flex: 1,
    paddingHorizontal: 4,
  },
  section: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
