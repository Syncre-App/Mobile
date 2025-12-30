import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../../../hooks/useTheme';
import { useChatStore } from '../../../stores/chatStore';
import { useFriendStore } from '../../../stores/friendStore';
import { Layout } from '../../../constants/layout';

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const { unreadSummary } = useChatStore();
  const { pending } = useFriendStore();

  const totalUnread = unreadSummary?.total || 0;
  const pendingRequests = pending.incoming.length;

  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const isIOS = Platform.OS === 'ios';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: useGlass || isIOS ? 'transparent' : colors.tabBar,
          borderTopColor: useGlass ? 'transparent' : colors.tabBarBorder,
          borderTopWidth: useGlass ? 0 : 0.5,
          height: Layout.heights.tabBar,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarBackground: () => {
          if (useGlass) {
            return (
              <GlassView 
                style={StyleSheet.absoluteFill} 
                glassEffectStyle="regular"
              />
            );
          }
          if (isIOS) {
            return (
              <BlurView
                style={StyleSheet.absoluteFill}
                tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
                intensity={100}
              />
            );
          }
          return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]} />;
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={size}
              color={color}
            />
          ),
          tabBarBadge: totalUnread > 0 ? (totalUnread > 99 ? '99+' : totalUnread) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.accent,
            fontSize: 10,
            minWidth: 18,
            height: 18,
          },
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={size}
              color={color}
            />
          ),
          tabBarBadge: pendingRequests > 0 ? pendingRequests : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.accent,
            fontSize: 10,
            minWidth: 18,
            height: 18,
          },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
