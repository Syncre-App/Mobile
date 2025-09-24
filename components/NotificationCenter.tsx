import React, { createContext, useContext, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type Notification = { id: string; type: string; title?: string; message: string };

const NotificationContext = createContext<{ push: (n: Notification) => void } | null>(null);

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
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
          <Animated.View key={n.id} style={[styles.toast, (styles as any)[n.type] || styles.info]}>
            {n.title ? <Text style={styles.title}>{n.title}</Text> : null}
            <Text style={styles.message}>{n.message}</Text>
          </Animated.View>
        ))}
      </View>
    </NotificationContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 50, left: 12, right: 12, zIndex: 9999 },
  toast: { marginBottom: 8, padding: 12, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  title: { color: '#fff', fontWeight: '700', marginBottom: 4 },
  message: { color: '#fff' },
  success: { backgroundColor: '#2ecc71' },
  error: { backgroundColor: '#e74c3c' },
  warning: { backgroundColor: '#f39c12' },
  info: { backgroundColor: '#3498db' },
});

export default NotificationProvider;
