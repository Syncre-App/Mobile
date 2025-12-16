import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { palette, radii, spacing } from '../theme/designSystem';
import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { NotificationService } from '../services/NotificationService';
import { GlassCard } from './GlassCard';

interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArt: string | null;
  duration: number;
  progress: number;
}

interface SpotifyConnectionProps {
  compact?: boolean;
}

export const SpotifyConnection: React.FC<SpotifyConnectionProps> = ({
  compact = false,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<SpotifyTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const token = await StorageService.getAuthToken();
      if (!token) return;

      const response = await ApiService.getSpotifyStatus(token);
      if (response.success && response.data) {
        setIsConnected(response.data.connected);
        setIsEnabled(response.data.enabled);

        if (response.data.connected) {
          const npResponse = await ApiService.getSpotifyNowPlaying(token);
          if (npResponse.success && npResponse.data?.nowPlaying) {
            setNowPlaying(npResponse.data.nowPlaying.track);
            setIsPlaying(npResponse.data.nowPlaying.isPlaying);
          } else {
            setNowPlaying(null);
            setIsPlaying(false);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching Spotify status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Poll for now playing every 15 seconds
    const interval = setInterval(() => {
      if (isConnected) {
        fetchStatus();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchStatus, isConnected]);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await ApiService.getSpotifyAuthUrl(token);
      if (response.success && response.data?.url) {
        await Linking.openURL(response.data.url);
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (err: any) {
      console.error('Error connecting to Spotify:', err);
      NotificationService.show('error', err.message || 'Nem sikerült csatlakozni');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      'Spotify lecsatlakoztatása',
      'Biztosan le szeretnéd csatlakoztatni a Spotify fiókodat?',
      [
        { text: 'Mégse', style: 'cancel' },
        {
          text: 'Lecsatlakoztatás',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await StorageService.getAuthToken();
              if (!token) return;

              await ApiService.disconnectSpotify(token);
              setIsConnected(false);
              setIsEnabled(false);
              setNowPlaying(null);
              NotificationService.show('success', 'Spotify lecsatlakoztatva');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
              NotificationService.show('error', 'Nem sikerült lecsatlakoztatni');
            }
          },
        },
      ]
    );
  }, []);

  if (isLoading) {
    return (
      <GlassCard width="100%" variant="default" padding={spacing.md}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={palette.accent} />
        </View>
      </GlassCard>
    );
  }

  if (compact) {
    return (
      <Pressable
        style={styles.compactContainer}
        onPress={isConnected ? handleDisconnect : handleConnect}
        disabled={isConnecting}
      >
        <View style={[styles.spotifyIcon, isConnected && styles.spotifyIconConnected]}>
          <Ionicons name="musical-notes" size={20} color="#1DB954" />
        </View>
        <View style={styles.compactContent}>
          <Text style={styles.compactTitle}>Spotify</Text>
          <Text style={styles.compactSubtitle}>
            {isConnected ? 'Csatlakoztatva' : 'Nincs csatlakoztatva'}
          </Text>
        </View>
        {isConnecting ? (
          <ActivityIndicator size="small" color={palette.accent} />
        ) : (
          <Ionicons
            name={isConnected ? 'checkmark-circle' : 'chevron-forward'}
            size={20}
            color={isConnected ? '#1DB954' : palette.textMuted}
          />
        )}
      </Pressable>
    );
  }

  return (
    <GlassCard width="100%" variant="default" padding={0}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.spotifyBadge, isConnected && styles.spotifyBadgeConnected]}>
              <Ionicons name="musical-notes" size={24} color="#1DB954" />
            </View>
            <View>
              <Text style={styles.title}>Spotify</Text>
              <Text style={styles.subtitle}>
                {isConnected ? 'Csatlakoztatva' : 'Csatlakoztasd a Spotify fiókodat'}
              </Text>
            </View>
          </View>
          <Pressable
            style={[
              styles.actionButton,
              isConnected ? styles.disconnectButton : styles.connectButton,
            ]}
            onPress={isConnected ? handleDisconnect : handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.actionButtonText}>
                {isConnected ? 'Lecsatlakozás' : 'Csatlakozás'}
              </Text>
            )}
          </Pressable>
        </View>

        {isConnected && nowPlaying && (
          <View style={styles.nowPlayingContainer}>
            <View style={styles.nowPlayingHeader}>
              <Ionicons
                name={isPlaying ? 'play-circle' : 'pause-circle'}
                size={14}
                color="#1DB954"
              />
              <Text style={styles.nowPlayingLabel}>
                {isPlaying ? 'Most játszik' : 'Szünetel'}
              </Text>
            </View>
            <View style={styles.nowPlayingContent}>
              {nowPlaying.albumArt && (
                <Image
                  source={{ uri: nowPlaying.albumArt }}
                  style={styles.albumArt}
                  contentFit="cover"
                />
              )}
              <View style={styles.trackInfo}>
                <Text style={styles.trackName} numberOfLines={1}>
                  {nowPlaying.name}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {nowPlaying.artist}
                </Text>
              </View>
            </View>
          </View>
        )}

        {isConnected && !nowPlaying && (
          <View style={styles.noPlayingContainer}>
            <Ionicons name="musical-note-outline" size={20} color={palette.textMuted} />
            <Text style={styles.noPlayingText}>Jelenleg nem játszik zene</Text>
          </View>
        )}
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  container: {},
  loadingContainer: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  spotifyBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyBadgeConnected: {
    backgroundColor: 'rgba(29, 185, 84, 0.25)',
  },
  title: {
    color: palette.text,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    minWidth: 100,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#1DB954',
  },
  disconnectButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Medium',
  },
  nowPlayingContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    padding: spacing.md,
  },
  nowPlayingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  nowPlayingLabel: {
    color: '#1DB954',
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nowPlayingContent: {
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
    fontFamily: 'PlusJakartaSans-Medium',
  },
  trackArtist: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  noPlayingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  noPlayingText: {
    color: palette.textMuted,
    fontSize: 13,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  spotifyIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyIconConnected: {
    backgroundColor: 'rgba(29, 185, 84, 0.25)',
  },
  compactContent: {
    flex: 1,
  },
  compactTitle: {
    color: palette.text,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-Medium',
  },
  compactSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
});

export default SpotifyConnection;
