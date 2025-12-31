import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { font, palette, radii, spacing } from '../theme/designSystem';
import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { NotificationService } from '../services/NotificationService';

WebBrowser.maybeCompleteAuthSession();

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
  const router = useRouter();
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
        const redirectUrl = Linking.createURL('spotify/callback');
        const result = await WebBrowser.openAuthSessionAsync(
          response.data.url,
          redirectUrl
        );
        if (result.type === 'success' && result.url) {
          const parsed = Linking.parse(result.url);
          const params = parsed?.queryParams || {};
          const success = params.success === 'true' || params.success === '1';
          const error = params.error ? String(params.error) : '';
          const userId = params.userId ? String(params.userId) : '';
          router.replace({
            pathname: '/spotify/callback',
            params: {
              success: success ? 'true' : 'false',
              error,
              userId,
            },
          } as any);
          fetchStatus();
        }
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (err: any) {
      console.error('Error connecting to Spotify:', err);
      NotificationService.show('error', err.message || 'Failed to connect to Spotify');
    } finally {
      setIsConnecting(false);
    }
  }, [fetchStatus, router]);

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      'Disconnect Spotify',
      'Are you sure you want to disconnect your Spotify account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await StorageService.getAuthToken();
              if (!token) return;

              await ApiService.disconnectSpotify(token);
              setIsConnected(false);
              setIsEnabled(false);
              setNowPlaying(null);
              NotificationService.show('success', 'Spotify disconnected');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
              NotificationService.show('error', 'Failed to disconnect Spotify');
            }
          },
        },
      ]
    );
  }, []);

  if (isLoading) {
    return (
      <View style={styles.cardContainer}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={palette.accent} />
        </View>
      </View>
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
            {isConnected ? 'Connected' : 'Not connected'}
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
    <View style={styles.cardContainer}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.spotifyBadge, isConnected && styles.spotifyBadgeConnected]}>
              <Ionicons name="musical-notes" size={24} color="#1DB954" />
            </View>
            <View>
              <Text style={styles.title}>Spotify</Text>
              <Text style={styles.subtitle}>
                {isConnected ? 'Connected' : 'Connect your Spotify account'}
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
                {isConnected ? 'Disconnect' : 'Connect'}
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
                {isPlaying ? 'Now playing' : 'Paused'}
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
            <Text style={styles.noPlayingText}>No music playing right now</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
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
    ...font('semibold'),
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
    ...font('medium'),
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
    ...font('medium'),
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
    ...font('medium'),
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
    ...font('medium'),
  },
  compactSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
});

export default SpotifyConnection;
