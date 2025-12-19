import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/designSystem';
import { NativeBlur } from './NativeBlur';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

type Notification = {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
};

const NotificationContext = createContext<{ push: (n: Notification) => void } | null>(null);

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return ctx;
};

const ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'close-circle',
  warning: 'warning',
  info: 'information-circle',
};

const ToastItem: React.FC<{ notification: Notification }> = ({ notification }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start();
  }, [fade, translate]);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          opacity: fade,
          transform: [{ translateY: translate }],
        },
      ]}
    >
      <NativeBlur intensity={theme.tokens.blur.toast} style={styles.toastBlur}>
        <View style={styles.toastContent}>
          <Ionicons name={ICONS[notification.type]} size={20} color={theme.palette.accent} />
          <View style={styles.toastText}>
            {notification.title ? <Text style={styles.toastTitle}>{notification.title}</Text> : null}
            <Text style={styles.toastMessage}>{notification.message}</Text>
          </View>
        </View>
      </NativeBlur>
    </Animated.View>
  );
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [list, setList] = useState<Notification[]>([]);

  const push = (notification: Notification) => {
    setList((prev) => [notification, ...prev]);
    setTimeout(() => {
      setList((prev) => prev.filter((item) => item.id !== notification.id));
    }, 3200);
  };

  return (
    <NotificationContext.Provider value={{ push }}>
      {children}
      <View pointerEvents="box-none" style={styles.container}>
        {list.map((item) => (
          <ToastItem key={item.id} notification={item} />
        ))}
      </View>
    </NotificationContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
});

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    toast: {
      borderRadius: theme.radii.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.palette.border,
      marginBottom: 10,
      backgroundColor: theme.palette.surfaceSoft,
      ...theme.shadows.card,
    },
    toastBlur: {
      borderRadius: theme.radii.lg,
    },
    toastContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 10,
      backgroundColor: theme.palette.surfaceInverse,
    },
    toastText: {
      flex: 1,
    },
    toastTitle: {
      color: theme.palette.text,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 2,
    },
    toastMessage: {
      color: theme.palette.textMuted,
      fontSize: 12,
    },
  });

export default NotificationProvider;
