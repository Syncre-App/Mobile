import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { UserAvatar } from './UserAvatar';
import { BadgeRow } from './BadgeIcon';
import { font, palette, radii, spacing } from '../theme/designSystem';
import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { canUseSwiftUI } from '../utils/swiftUi';

// SwiftUI imports for iOS - only BottomSheet and Host
let Host: any = null;
let BottomSheet: any = null;

if (Platform.OS === 'ios') {
  try {
    const swiftUI = require('@expo/ui/swift-ui');
    Host = swiftUI.Host;
    BottomSheet = swiftUI.BottomSheet;
  } catch (e) {
    console.warn('SwiftUI components not available:', e);
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
  presence?: 'online' | 'idle' | 'offline';
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ProfileCard: React.FC<ProfileCardProps> = ({
  visible,
  user,
  onClose,
  presence = 'offline',
}) => {
  const [spotifyActivity, setSpotifyActivity] = useState<SpotifyActivity | null>(null);
  const [isLoadingSpotify, setIsLoadingSpotify] = useState(false);
  const [hasFetchedSpotify, setHasFetchedSpotify] = useState(false);
  const shouldUseSwiftUI = canUseSwiftUI();
  const canRenderSwiftUI = shouldUseSwiftUI && Host && BottomSheet;

  // Reset state when card closes
  useEffect(() => {
    if (!visible) {
      setSpotifyActivity(null);
      setHasFetchedSpotify(false);
      setIsLoadingSpotify(false);
      return;
    }

    if (!user?.id || hasFetchedSpotify) return;

    const fetchActivity = async () => {
      setIsLoadingSpotify(true);
      try {
        const token = await StorageService.getAuthToken();
        if (!token) return;

        const response = await ApiService.getUserActivity(user.id, token);
        if (response.success && response.data?.activity?.track) {
          setSpotifyActivity(response.data.activity);
        } else {
          setSpotifyActivity(null);
        }
      } catch (err) {
        console.error('Error fetching Spotify activity:', err);
        setSpotifyActivity(null);
      } finally {
        setIsLoadingSpotify(false);
        setHasFetchedSpotify(true);
      }
    };

    fetchActivity();
  }, [visible, user?.id, hasFetchedSpotify]);

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

  // Format milliseconds to mm:ss
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!user && !visible) return null;
  const safeUser: ProfileCardUser = user ?? {
    id: '',
    username: 'Loading...',
  };
  const displayName = safeUser.username || safeUser.email || 'User';

  // ═══════════════════════════════════════════════════════════════
  // Profile View - Main content without actions
  // ═══════════════════════════════════════════════════════════════
  const ProfileView = () => (
    <View style={styles.profileView}>
      {/* Large Avatar */}
      <View style={styles.avatarContainer}>
        <UserAvatar
          uri={safeUser.profile_picture}
          name={displayName}
          size={120}
          presence={presence}
          presencePlacement="overlay"
        />
      </View>

      {/* Username */}
      <RNText style={styles.username}>{displayName}</RNText>

      {/* Badges */}
      {safeUser.badges && safeUser.badges.length > 0 && (
        <View style={styles.badgesContainer}>
          <BadgeRow badges={safeUser.badges} size={24} spacing={8} />
        </View>
      )}

      {/* Status Pill */}
      <View style={styles.statusPill}>
        <View style={[styles.statusDot, { backgroundColor: getPresenceColor() }]} />
        <RNText style={styles.statusText}>{getPresenceText()}</RNText>
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
              name={spotifyActivity.isPlaying ? 'musical-notes' : 'pause'}
              size={14}
              color="#1DB954"
            />
            <RNText style={styles.spotifyLabel}>
              {spotifyActivity.isPlaying ? 'Listening to Spotify' : 'Paused'}
            </RNText>
          </View>
          <View style={styles.spotifyContent}>
            {spotifyActivity.track.albumArt && (
              <Image
                source={{ uri: spotifyActivity.track.albumArt }}
                style={styles.albumArt}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={spotifyActivity.track.id}
                transition={0}
              />
            )}
            <View style={styles.trackInfo}>
              <RNText style={styles.trackName} numberOfLines={1}>
                {spotifyActivity.track.name}
              </RNText>
              <RNText style={styles.trackArtist} numberOfLines={1}>
                {spotifyActivity.track.artist}
              </RNText>
            </View>
          </View>
          {/* Progress Bar */}
          {spotifyActivity.track.duration > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${Math.min(100, (spotifyActivity.track.progress / spotifyActivity.track.duration) * 100)}%` 
                    }
                  ]} 
                />
              </View>
              <View style={styles.progressTimes}>
                <RNText style={styles.progressTime}>
                  {formatTime(spotifyActivity.track.progress)}
                </RNText>
                <RNText style={styles.progressTime}>
                  {formatTime(spotifyActivity.track.duration)}
                </RNText>
              </View>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );

  // ═══════════════════════════════════════════════════════════════
  // Card Content - Just renders Profile View
  // ═══════════════════════════════════════════════════════════════
  const CardContent = ({ isSwiftUISheet = false }: { isSwiftUISheet?: boolean }) => (
    <View style={[styles.cardContent, isSwiftUISheet && styles.swiftUICardContent]}>
      <ProfileView />
    </View>
  );

  // ═══════════════════════════════════════════════════════════════
  // iOS: Native SwiftUI BottomSheet
  // ═══════════════════════════════════════════════════════════════
  if (canRenderSwiftUI) {
    return (
      <Host style={styles.swiftUIHost}>
        <BottomSheet
          isOpened={visible}
          onIsOpenedChange={(isOpened: boolean) => {
            if (!isOpened) {
              onClose();
            }
          }}
          presentationDetents={[0.55, 'large']}
          presentationDragIndicator="visible"
        >
          <ScrollView
            style={styles.swiftUIScrollView}
            contentContainerStyle={styles.swiftUIScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <CardContent isSwiftUISheet />
          </ScrollView>
        </BottomSheet>
      </Host>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Android / Fallback: Modal
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
        <Pressable style={styles.cardContainer} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['rgba(30, 41, 59, 0.98)', 'rgba(15, 23, 42, 0.99)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.card}
          >
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color={palette.textMuted} />
            </Pressable>
            <CardContent />
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // SwiftUI Host styles
  swiftUIHost: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: 0,
  },
  swiftUIScrollView: {
    flex: 1,
  },
  swiftUIScrollContent: {
    flexGrow: 1,
  },
  swiftUICardContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },

  // Modal styles
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    padding: spacing.lg,
    backgroundColor: 'rgba(3, 7, 18, 0.7)',
  },
  cardContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  card: {
    width: '100%',
    borderRadius: radii.xxl,
    paddingVertical: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 24,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Card content
  cardContent: {
    paddingHorizontal: spacing.lg,
    minHeight: 300,
  },

  // Profile View styles
  profileView: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  avatarContainer: {
    marginBottom: spacing.lg,
  },
  username: {
    color: palette.text,
    fontSize: 26,
    ...font('bold'),
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  badgesContainer: {
    marginBottom: spacing.md,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: spacing.lg,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    ...font('medium'),
    color: palette.textMuted,
  },

  // Spotify styles
  spotifyContainer: {
    width: '100%',
    backgroundColor: 'rgba(29, 185, 84, 0.08)',
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.15)',
  },
  spotifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  spotifyLabel: {
    color: '#1DB954',
    fontSize: 11,
    ...font('semibold'),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  spotifyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  albumArt: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    color: palette.text,
    fontSize: 15,
    ...font('semibold'),
  },
  trackArtist: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 2,
  },

  // Progress bar styles
  progressContainer: {
    marginTop: spacing.sm,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 2,
  },
  progressTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  progressTime: {
    color: palette.textMuted,
    fontSize: 10,
    ...font('medium'),
  },
});

export default ProfileCard;
