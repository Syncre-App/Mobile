import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { UserAvatar } from './UserAvatar';
import { BadgeRow } from './BadgeIcon';
import { font, palette, radii, spacing } from '../theme/designSystem';
import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { GlassySheet } from './GlassySheet';
import { canUseSwiftUI } from '../utils/swiftUi';

// SwiftUI imports for iOS BottomSheet
let SwiftUIBottomSheet: any = null;
let SwiftUIHost: any = null;

if (Platform.OS === 'ios') {
  try {
    const swiftUI = require('@expo/ui/swift-ui');
    SwiftUIBottomSheet = swiftUI.BottomSheet;
    SwiftUIHost = swiftUI.Host;
  } catch (e) {
    console.warn('SwiftUI BottomSheet not available:', e);
  }
}

interface SpotifyActivity {
  isPlaying: boolean;
  track: {
    id: string;
    name: string;
    artist: string;
    album: string;
    albumArt: string | null;
    duration: number;
    progress: number;
  } | null;
}

interface ProfileCardUser {
  id: string;
  username: string;
  email?: string;
  profile_picture?: string | null;
  status?: string | null;
  last_seen?: string | null;
  badges?: string[];
}

interface ProfileCardProps {
  visible: boolean;
  user: ProfileCardUser | null;
  onClose: () => void;
  onRemoveFriend: (userId: string) => void;
  onBlockUser: (userId: string) => void;
  onReportUser: (userId: string) => void;
  isBlocked?: boolean;
  presence?: 'online' | 'idle' | 'offline';
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ProfileCard: React.FC<ProfileCardProps> = ({
  visible,
  user,
  onClose,
  onRemoveFriend,
  onBlockUser,
  onReportUser,
  isBlocked = false,
  presence = 'offline',
}) => {
  const [spotifyActivity, setSpotifyActivity] = useState<SpotifyActivity | null>(null);
  const [isLoadingSpotify, setIsLoadingSpotify] = useState(false);
  const shouldUseSwiftUI = canUseSwiftUI();

  const fetchSpotifyActivity = useCallback(async () => {
    if (!user?.id) return;

    setIsLoadingSpotify(true);
    try {
      const token = await StorageService.getAuthToken();
      if (!token) return;

      const response = await ApiService.getUserActivity(user.id, token);
      if (response.success && response.data?.activity) {
        setSpotifyActivity(response.data.activity);
      } else {
        setSpotifyActivity(null);
      }
    } catch (err) {
      console.error('Error fetching Spotify activity:', err);
      setSpotifyActivity(null);
    } finally {
      setIsLoadingSpotify(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (visible && user?.id) {
      fetchSpotifyActivity();
    } else {
      setSpotifyActivity(null);
    }
  }, [visible, user?.id, fetchSpotifyActivity]);

  const handleAction = (action: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    action();
    onClose();
  };

  const formatLastSeen = (lastSeen?: string | null): string => {
    if (!lastSeen) return 'Unknown';
    const parsed = Date.parse(lastSeen);
    if (Number.isNaN(parsed)) return 'Unknown';

    const diffMs = Date.now() - parsed;
    const minutes = Math.floor(diffMs / 60000);

    if (minutes < 1) return 'Active now';
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const getPresenceColor = () => {
    switch (presence) {
      case 'online':
        return '#22C55E';
      case 'idle':
        return '#FBBF24';
      default:
        return palette.textMuted;
    }
  };

  const getPresenceText = () => {
    switch (presence) {
      case 'online':
        return 'Online';
      case 'idle':
        return 'Idle';
      default:
        return formatLastSeen(user?.last_seen);
    }
  };

  if (!user) return null;

  // Shared content component
  const CardContent = () => (
    <>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <UserAvatar
          uri={user.profile_picture}
          name={user.username}
          size={100}
          presence={presence}
          presencePlacement="overlay"
        />

        <View style={styles.nameContainer}>
          <Text style={styles.username}>{user.username}</Text>
          {user.badges && user.badges.length > 0 && (
            <BadgeRow badges={user.badges} size={24} spacing={6} style={styles.badges} />
          )}
        </View>

        {/* Status */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: getPresenceColor() }]} />
          <Text style={[styles.statusText, { color: getPresenceColor() }]}>
            {getPresenceText()}
          </Text>
        </View>
      </View>

      {/* Spotify Activity */}
      {isLoadingSpotify ? (
        <View style={styles.spotifyContainer}>
          <ActivityIndicator size="small" color="#1DB954" />
        </View>
      ) : spotifyActivity?.track ? (
        <View style={styles.spotifyContainer}>
          <View style={styles.spotifyHeader}>
            <Ionicons
              name={spotifyActivity.isPlaying ? 'play-circle' : 'pause-circle'}
              size={16}
              color="#1DB954"
            />
            <Text style={styles.spotifyLabel}>
              {spotifyActivity.isPlaying ? 'Listening on Spotify' : 'Spotify paused'}
            </Text>
          </View>
          <View style={styles.spotifyContent}>
            {spotifyActivity.track.albumArt && (
              <Image
                source={{ uri: spotifyActivity.track.albumArt }}
                style={styles.albumArt}
                contentFit="cover"
              />
            )}
            <View style={styles.trackInfo}>
              <Text style={styles.trackName} numberOfLines={1}>
                {spotifyActivity.track.name}
              </Text>
              <Text style={styles.trackArtist} numberOfLines={1}>
                {spotifyActivity.track.artist}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <Pressable
          style={styles.actionButton}
          onPress={() => handleAction(() => onRemoveFriend(user.id))}
        >
          <Ionicons name="person-remove-outline" size={20} color={palette.error} />
          <Text style={[styles.actionText, { color: palette.error }]}>
            Remove friend
          </Text>
        </Pressable>

        <Pressable
          style={styles.actionButton}
          onPress={() => handleAction(() => onBlockUser(user.id))}
        >
          <Ionicons
            name={isBlocked ? 'lock-open-outline' : 'ban-outline'}
            size={20}
            color={palette.warning}
          />
          <Text style={[styles.actionText, { color: palette.warning }]}>
            {isBlocked ? 'Unblock' : 'Block'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.actionButton}
          onPress={() => handleAction(() => onReportUser(user.id))}
        >
          <Ionicons name="flag-outline" size={20} color={palette.textMuted} />
          <Text style={[styles.actionText, { color: palette.textMuted }]}>
            Report
          </Text>
        </Pressable>
      </View>
    </>
  );

  // ═══════════════════════════════════════════════════════════════
  // iOS: Native BottomSheet
  // ═══════════════════════════════════════════════════════════════
  if (shouldUseSwiftUI && SwiftUIBottomSheet && SwiftUIHost) {
    return (
      <SwiftUIHost style={styles.swiftUIHost}>
        <SwiftUIBottomSheet
          isOpened={visible}
          onIsOpenedChange={(isOpened: boolean) => {
            if (!isOpened) {
              onClose();
            }
          }}
          presentationDetents={['medium']}
          presentationDragIndicator="visible"
        >
          <GlassySheet variant="subtle">
            <View style={styles.sheetContent}>
              <CardContent />
            </View>
          </GlassySheet>
        </SwiftUIBottomSheet>
      </SwiftUIHost>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Android / Fallback: Modal with blur overlay
  // ═══════════════════════════════════════════════════════════════
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.blurOverlay}>
          <Pressable style={styles.cardContainer} onPress={(e) => e.stopPropagation()}>
            <LinearGradient
              colors={['rgba(30, 41, 59, 0.95)', 'rgba(15, 23, 42, 0.98)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.card}
            >
              {/* Close Button */}
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={palette.textMuted} />
              </Pressable>

              <CardContent />
            </LinearGradient>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurOverlay: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  swiftUIHost: {
    width: 0,
    height: 0,
  },
  cardContainer: {
    width: SCREEN_WIDTH - spacing.xl * 2,
    maxWidth: 380,
  },
  card: {
    borderRadius: radii.xxl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 24,
  },
  sheetContent: {
    padding: spacing.xl,
    paddingTop: spacing.md,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  nameContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  username: {
    color: palette.text,
    fontSize: 24,
    ...font('bold'),
    textAlign: 'center',
  },
  badges: {
    marginTop: spacing.sm,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    ...font('medium'),
  },
  spotifyContainer: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.2)',
  },
  spotifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  spotifyLabel: {
    color: '#1DB954',
    fontSize: 12,
    ...font('semibold'),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  spotifyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  albumArt: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    color: palette.text,
    fontSize: 14,
    ...font('semibold'),
  },
  trackArtist: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  actionsContainer: {
    gap: spacing.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionText: {
    fontSize: 15,
    ...font('medium'),
  },
});

export default ProfileCard;
