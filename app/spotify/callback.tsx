import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBackground } from '../../components/AppBackground';
import { GlassCard } from '../../components/GlassCard';
import { font, palette, radii, spacing } from '../../theme/designSystem';

const AUTO_RETURN_MS = 1400;

const SpotifyCallbackScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  const isSuccess = useMemo(() => {
    const success = params?.success;
    return success === 'true' || success === '1';
  }, [params]);

  const errorMessage = useMemo(() => {
    const error = params?.error;
    if (!error) {
      return '';
    }
    return Array.isArray(error) ? error[0] : String(error);
  }, [params]);

  useEffect(() => {
    if (!isSuccess) return;
    const timeout = setTimeout(() => {
      router.replace('/settings');
    }, AUTO_RETURN_MS);
    return () => clearTimeout(timeout);
  }, [isSuccess, router]);

  const title = isSuccess ? 'Spotify connected' : 'Spotify connection failed';
  const subtitle = isSuccess
    ? 'You can return to Settings now.'
    : errorMessage
    ? `Error: ${errorMessage}`
    : 'Something went wrong. Please try again.';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppBackground />

      <View style={styles.content}>
        <GlassCard width={340} variant="hero" padding={spacing.lg}>
          <View style={styles.cardContent}>
            <View style={[styles.iconWrap, isSuccess ? styles.iconSuccess : styles.iconError]}>
              <Ionicons
                name={isSuccess ? 'checkmark' : 'close'}
                size={28}
                color={isSuccess ? '#16A34A' : '#EF4444'}
              />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            {isSuccess ? (
              <View style={styles.progressRow}>
                <ActivityIndicator color={palette.textMuted} />
                <Text style={styles.progressText}>Returning to Settings...</Text>
              </View>
            ) : (
              <Pressable style={styles.actionButton} onPress={() => router.replace('/settings')}>
                <Text style={styles.actionButtonText}>Back to Settings</Text>
              </Pressable>
            )}
          </View>
        </GlassCard>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  cardContent: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  iconError: {
    backgroundColor: 'rgba(248, 113, 113, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.4)',
  },
  title: {
    color: palette.text,
    fontSize: 20,
    textAlign: 'center',
    ...font('semibold'),
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 14,
    textAlign: 'center',
    ...font('regular'),
  },
  progressRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  progressText: {
    color: palette.textMuted,
    fontSize: 13,
    ...font('medium'),
  },
  actionButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: palette.accent,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    ...font('semibold'),
  },
});

export default SpotifyCallbackScreen;
