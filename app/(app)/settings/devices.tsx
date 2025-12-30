import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../hooks/useTheme';
import { useAuthStore } from '../../../stores/authStore';
import { keysApi } from '../../../services/api';
import { secureStorage } from '../../../services/storage/secure';
import { LoadingSpinner } from '../../../components/ui';
import { Layout } from '../../../constants/layout';
import { DeviceKey } from '../../../types/api';
import { formatDistanceToNow } from 'date-fns';

export default function DevicesScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  
  const [devices, setDevices] = useState<DeviceKey[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDevices();
    loadCurrentDeviceId();
  }, []);

  const loadCurrentDeviceId = async () => {
    const deviceId = await secureStorage.getDeviceId();
    setCurrentDeviceId(deviceId);
  };

  const loadDevices = async () => {
    if (!user?.id) return;
    
    try {
      const userDevices = await keysApi.getMyDevices(user.id);
      // Sort by lastSeen descending
      const sorted = userDevices.sort((a, b) => {
        const aDate = new Date(a.lastSeen || a.createdAt || 0);
        const bDate = new Date(b.lastSeen || b.createdAt || 0);
        return bDate.getTime() - aDate.getTime();
      });
      setDevices(sorted);
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDevices();
    setRefreshing(false);
  };

  const handleRevokeDevice = (device: DeviceKey) => {
    if (device.deviceId === currentDeviceId) {
      Alert.alert(
        'Cannot Revoke',
        'You cannot revoke your current device. Log out instead.',
      );
      return;
    }

    Alert.alert(
      'Revoke Device',
      'Are you sure you want to revoke this device? It will need to log in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              await keysApi.revokeDeviceKey(device.deviceId);
              await loadDevices();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Failed to revoke device:', error);
              Alert.alert('Error', 'Failed to revoke device');
            }
          },
        },
      ]
    );
  };

  const renderDevice = ({ item }: { item: DeviceKey }) => {
    const isCurrentDevice = item.deviceId === currentDeviceId;
    const lastSeen = item.lastSeen 
      ? formatDistanceToNow(new Date(item.lastSeen), { addSuffix: true })
      : 'Unknown';
    const createdAt = item.createdAt
      ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
      : 'Unknown';

    return (
      <View style={[styles.deviceCard, { backgroundColor: colors.surface }]}>
        <View style={styles.deviceHeader}>
          <View style={[styles.deviceIcon, { backgroundColor: colors.accent + '15' }]}>
            <Ionicons 
              name={isCurrentDevice ? 'phone-portrait' : 'phone-portrait-outline'} 
              size={24} 
              color={colors.accent} 
            />
          </View>
          <View style={styles.deviceInfo}>
            <View style={styles.deviceNameRow}>
              <Text style={[styles.deviceName, { color: colors.text }]}>
                {item.deviceId.slice(0, 20)}...
              </Text>
              {isCurrentDevice && (
                <View style={[styles.currentBadge, { backgroundColor: colors.success + '20' }]}>
                  <Text style={[styles.currentBadgeText, { color: colors.success }]}>
                    Current
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.deviceMeta, { color: colors.textSecondary }]}>
              Last active: {lastSeen}
            </Text>
            <Text style={[styles.deviceMeta, { color: colors.textSecondary }]}>
              Registered: {createdAt}
            </Text>
          </View>
        </View>

        {!isCurrentDevice && (
          <TouchableOpacity
            style={[styles.revokeButton, { borderColor: colors.error }]}
            onPress={() => handleRevokeDevice(item)}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.error} />
            <Text style={[styles.revokeText, { color: colors.error }]}>Revoke</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="phone-portrait-outline" size={48} color={colors.textSecondary} />
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        No devices found
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Active Devices</Text>
        <View style={styles.placeholder} />
      </View>

      {isLoading ? (
        <LoadingSpinner message="Loading devices..." />
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.deviceId}
          renderItem={renderDevice}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
        />
      )}

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Each device has its own encryption keys. Revoking a device will require it to set up encryption again.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: Layout.spacing.xs,
  },
  headerTitle: {
    fontSize: Layout.fontSize.lg,
    fontWeight: Layout.fontWeight.semibold,
  },
  placeholder: {
    width: 40,
  },
  list: {
    padding: Layout.spacing.lg,
    gap: Layout.spacing.md,
  },
  deviceCard: {
    padding: Layout.spacing.lg,
    borderRadius: Layout.radius.lg,
    marginBottom: Layout.spacing.md,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Layout.spacing.md,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    marginBottom: 4,
  },
  deviceName: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.medium,
  },
  currentBadge: {
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical: 2,
    borderRadius: Layout.radius.sm,
  },
  currentBadgeText: {
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
  },
  deviceMeta: {
    fontSize: Layout.fontSize.sm,
    marginTop: 2,
  },
  revokeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.spacing.xs,
    marginTop: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderWidth: 1,
    borderRadius: Layout.radius.md,
  },
  revokeText: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.medium,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Layout.spacing.xxl,
  },
  emptyText: {
    fontSize: Layout.fontSize.md,
    marginTop: Layout.spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.spacing.sm,
    padding: Layout.spacing.lg,
    borderTopWidth: 0.5,
  },
  footerText: {
    flex: 1,
    fontSize: Layout.fontSize.xs,
  },
});
