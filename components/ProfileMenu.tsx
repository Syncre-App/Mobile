import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Link, useRouter } from 'expo-router';
import React from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { UserAvatar } from './UserAvatar';

interface ProfileMenuProps {
  visible: boolean;
  onClose: () => void;
  user: any;
  isOnline: boolean;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({
  visible,
  onClose,
  user,
  isOnline,
}) => {
  const router = useRouter();
  // Ref to ignore immediate overlay presses right after the modal opens
  const openedAtRef = React.useRef<number | null>(null);

  const handleLogout = async () => {
    onClose();
    // Clear storage and redirect to login
    const { StorageService } = await import('../services/StorageService');
    await StorageService.removeAuthToken();
    await StorageService.removeItem('user_data');
    router.replace('/');
  };

  const handleHelp = () => {
    onClose();
    // TODO: Implement help screen
  };

  React.useEffect(() => {
    if (visible) {
      // mark the time the modal opened; used to ignore the tap that opened it
      openedAtRef.current = Date.now();
      // clear after a short window
      const t = setTimeout(() => {
        openedAtRef.current = null;
      }, 300);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const handleOverlayPress = () => {
    const now = Date.now();
    if (openedAtRef.current && now - openedAtRef.current < 300) {
      return;
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <Pressable style={styles.overlay} onPress={handleOverlayPress}>
        <View style={styles.menuContainer}>
          <View style={styles.menuPanel}>
            <BlurView intensity={50} tint="dark" style={styles.blurView}>
              <View style={styles.menuContent}>
                {/* User Info Header */}
                <View style={styles.userHeader}>
                  <UserAvatar
                    uri={user?.profile_picture}
                    name={user?.username || user?.name || user?.email}
                    size={56}
                    presence={isOnline ? 'online' : 'offline'}
                    presencePlacement="overlay"
                    style={styles.avatarContainer}
                  />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {user?.username || user?.name || user?.email || 'User'}
                    </Text>
                    <View style={styles.statusContainer}>
                      <View style={[styles.statusIndicator, { backgroundColor: isOnline ? '#4CAF50' : '#757575' }]} />
                      <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
                    </View>
                  </View>
                </View>

                {/* Menu Items */}
                <View style={styles.separator} />
                <Link href="/edit-profile" asChild>
                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={'person-outline'}
                      size={20}
                      color={'rgba(255, 255, 255, 0.8)'}
                    />
                    <Text style={styles.menuItemText}>
                      {'Edit Profile'}
                    </Text>
                  </TouchableOpacity>
                </Link>
                <Link href="/settings" asChild>
                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={'settings-outline'}
                      size={20}
                      color={'rgba(255, 255, 255, 0.8)'}
                    />
                    <Text style={styles.menuItemText}>
                      {'Settings'}
                    </Text>
                  </TouchableOpacity>
                </Link>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleHelp}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={'help-circle-outline'}
                    size={20}
                    color={'rgba(255, 255, 255, 0.8)'}
                  />
                  <Text style={styles.menuItemText}>
                    {'Help & Support'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleLogout}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={'log-out-outline'}
                    size={20}
                    color={'#FF6B6B'}
                  />
                  <Text style={[styles.menuItemText, styles.destructiveText]}>
                    {'Logout'}
                  </Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 12,
  },
  menuContainer: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  menuPanel: {
    minWidth: 250,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  blurView: {
    overflow: 'hidden',
  },
  menuContent: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  debugText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 12,
  },
  debugBox: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    padding: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FF4D4F',
    backgroundColor: 'rgba(255, 77, 79, 0.08)',
    zIndex: 9999,
    alignItems: 'center',
  },
  fullscreenDebug: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: 'rgba(255,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  fullscreenDebugText: {
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 1,
  },
  menu: {
  padding: 0,
  overflow: 'hidden',
  backgroundColor: 'transparent',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarContainer: {
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
  },
  menuItemText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginLeft: 12,
  },
  destructiveText: {
    color: '#FF6B6B',
  },
});
