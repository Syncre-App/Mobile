import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '../components/GlassCard';
import { UpdateService, ReleaseInfo } from '../services/UpdateService';

export default function UpdateScreen() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const currentVersion = UpdateService.getCurrentVersion();

  useEffect(() => {
    const hydrate = async () => {
      const cached = UpdateService.consumePendingUpdate();
      if (cached) {
        setRelease(cached);
        setIsLoading(false);
        return;
      }
      const latest = await UpdateService.fetchLatestRelease();
      setRelease(latest);
      setIsLoading(false);
    };

    hydrate();
  }, []);

  const handleOpenRelease = () => {
    if (release?.url) {
      Linking.openURL(release.url).catch(() => {});
    }
  };

  const handleRetry = async () => {
    setIsLoading(true);
    const latest = await UpdateService.fetchLatestRelease();
    setRelease(latest);
    setIsLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#03040A', '#071026']} style={StyleSheet.absoluteFillObject} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard width="100%" style={styles.card}>
          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#2C82FF" />
              <Text style={styles.loadingText}>Checking for updates…</Text>
            </View>
          ) : release ? (
            <>
              <Text style={styles.title}>Update Required</Text>
              <Text style={styles.subtitle}>
                A newer version ({release.version}) is available. Please update to continue using Syncre.
              </Text>

              <View style={styles.versionRow}>
                <Text style={styles.versionLabel}>Current version</Text>
                <Text style={styles.versionValue}>{currentVersion}</Text>
              </View>
              <View style={styles.versionRow}>
                <Text style={styles.versionLabel}>Latest version</Text>
                <Text style={styles.versionHighlight}>{release.version}</Text>
              </View>

              <View style={styles.notes}>
                <Text style={styles.notesTitle}>Release notes</Text>
                <Text style={styles.notesBody}>{release.notes.trim() || 'No details provided.'}</Text>
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleOpenRelease}>
                <Text style={styles.primaryButtonText}>Update Now</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={handleRetry}>
                <Text style={styles.secondaryButtonText}>Refresh Release Info</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.loading}>
              <Text style={styles.subtitleCenter}>
                We couldn’t fetch the latest release information. Please check your connection and try again.
              </Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleRetry}>
                <Text style={styles.secondaryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#03040A',
  },
  content: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 16,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginBottom: 16,
  },
  subtitleCenter: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  versionLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  versionValue: {
    color: '#ffffff',
    fontWeight: '600',
  },
  versionHighlight: {
    color: '#2C82FF',
    fontWeight: '700',
  },
  notes: {
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  notesTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  notesBody: {
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 24,
    backgroundColor: '#2C82FF',
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
  },
});
