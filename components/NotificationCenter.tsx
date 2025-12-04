import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

type Notification = { id: string; type: NotificationType; title?: string; message: string };

const NotificationContext = createContext<{ push: (n: Notification) => void } | null>(null);

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};

const ICON_MAP: Record<NotificationType, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { name: 'checkmark-circle', color: '#4ADE80' },
  error: { name: 'close-circle', color: '#F87171' },
  warning: { name: 'warning', color: '#FBBF24' },
  info: { name: 'information-circle', color: '#60A5FA' },
};

const BORDER_COLORS: Record<NotificationType, string> = {
  success: 'rgba(74, 222, 128, 0.3)',
  error: 'rgba(248, 113, 113, 0.3)',
  warning: 'rgba(251, 191, 36, 0.3)',
  info: 'rgba(96, 165, 250, 0.3)',
};

const ToastItem: React.FC<{ notification: Notification }> = ({ notification }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const icon = ICON_MAP[notification.type] || ICON_MAP.info;
  const borderColor = BORDER_COLORS[notification.type] || BORDER_COLORS.info;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY }],
          borderColor,
        },
      ]}
    >
      <BlurView intensity={60} tint="dark" style={styles.blurView}>
        <View style={styles.toastContent}>
          <Ionicons name={icon.name} size={22} color={icon.color} style={styles.icon} />
          <View style={styles.textContainer}>
            {notification.title ? (
              <Text style={styles.title}>{notification.title}</Text>
            ) : null}
            <Text style={styles.message} numberOfLines={3}>{notification.message}</Text>
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [list, setList] = useState<Notification[]>([]);

  const push = (n: Notification) => {
    setList((s) => [n, ...s]);
    setTimeout(() => {
      setList((s) => s.filter((x) => x.id !== n.id));
    }, 3500);
  };

  return (
    <NotificationContext.Provider value={{ push }}>
      {children}
      <View pointerEvents="box-none" style={styles.container}>
        {list.map((n) => (
          <ToastItem key={n.id} notification={n} />
        ))}
      </View>
    </NotificationContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toastContainer: {
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  blurView: {
    overflow: 'hidden',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    lineHeight: 18,
  },
});

export default NotificationProvider;
