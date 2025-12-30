import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
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

  // isLiquidGlassSupported is a boolean constant, not a function
  const useNativeLiquidGlass = Platform.OS === 'ios' && isLiquidGlassSupported;
  const isIOS = Platform.OS === 'ios';

  // Floating pill tab bar dimensions
  const TAB_BAR_HEIGHT = 56;
  const TAB_BAR_MARGIN_HORIZONTAL = 60;
  const TAB_BAR_MARGIN_BOTTOM = 30;
  const TAB_BAR_BORDER_RADIUS = 28;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarShowLabel: false,
        tabBarStyle: useNativeLiquidGlass ? {
          // Floating pill style for Liquid Glass
          position: 'absolute',
          bottom: TAB_BAR_MARGIN_BOTTOM,
          left: TAB_BAR_MARGIN_HORIZONTAL,
          right: TAB_BAR_MARGIN_HORIZONTAL,
          height: TAB_BAR_HEIGHT,
          borderRadius: TAB_BAR_BORDER_RADIUS,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          overflow: 'hidden',
        } : {
          // Standard tab bar for non-liquid glass
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: isIOS ? 0 : 0.5,
          height: Layout.heights.tabBar,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarBackground: () => {
          if (useNativeLiquidGlass) {
            return (
              <LiquidGlassView 
                style={[StyleSheet.absoluteFill, styles.liquidGlassContainer]}
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
        tabBarItemStyle: useNativeLiquidGlass ? {
          paddingVertical: 8,
        } : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={useNativeLiquidGlass ? 26 : 24}
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
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={useNativeLiquidGlass ? 26 : 24}
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
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={useNativeLiquidGlass ? 26 : 24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  liquidGlassContainer: {
    borderRadius: 28,
    overflow: 'hidden',
  },
});
