import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBackground } from '../components/AppBackground';

import { NotificationService, notificationService } from '../services/NotificationService';
import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { font, palette, radii, spacing } from '../theme/designSystem';

export default function TermsAcceptScreen() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const user = await StorageService.getObject<any>('user_data');
      setAcceptedAt(user?.terms_accepted_at || null);
      setLoadingUser(false);
    })();
  }, []);

  const handleOpenTerms = useCallback(() => {
    Linking.openURL('https://syncre.xyz/terms').catch(() => {
      notificationService.show('error', 'Could not open terms page');
    });
  }, []);

  const handleAccept = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        NotificationService.show('error', 'Please log in again to continue');
        router.replace('/' as any);
        return;
      }
      const response = await ApiService.post('/user/accept-terms', {}, token);
      if (response.success) {
        const nextAccepted = (response.data as any)?.terms_accepted_at || new Date().toISOString();
        setAcceptedAt(nextAccepted);
        const user = await StorageService.getObject<any>('user_data');
        if (user) {
          user.terms_accepted_at = nextAccepted;
          user.requires_terms_acceptance = false;
          await StorageService.setObject('user_data', user);
        }
        NotificationService.show('success', 'Thanks for accepting the latest terms.');
        router.replace('/home' as any);
      } else {
        NotificationService.show('error', response.error || 'Failed to record acceptance');
      }
    } catch (error: any) {
      NotificationService.show('error', error?.message || 'Failed to record acceptance');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppBackground />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Ionicons name="shield-checkmark" size={22} color="#0b1220" />
            </View>
            <Text style={styles.title}>Accept updated Terms</Text>
            <Text style={styles.subtitle}>
              Apple requires showing the latest End User License Agreement. Review the terms on the web, then confirm to continue.
            </Text>
          </View>

          <TouchableOpacity onPress={handleOpenTerms} style={styles.linkButton}>
            <Text style={styles.linkButtonText}>View Terms of Service</Text>
            <Ionicons name="open-outline" size={16} color="#93c5fd" />
          </TouchableOpacity>

          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Current status</Text>
            {loadingUser ? (
              <ActivityIndicator color="#a5b4fc" />
            ) : acceptedAt ? (
              <Text style={styles.metaValue}>Accepted at {new Date(acceptedAt).toLocaleString()}</Text>
            ) : (
              <Text style={styles.metaValue}>Not accepted</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.acceptButton, isSubmitting && styles.acceptButtonDisabled]}
            onPress={handleAccept}
            disabled={isSubmitting}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#2563EB', '#0EA5E9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.acceptGradient}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.acceptButtonText}>Accept & Continue</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  card: {
    alignSelf: 'center',
    maxWidth: 520,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#a5b4fc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: palette.text,
    fontSize: 24,
    ...font('display'),
    textAlign: 'center',
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  linkButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.4)',
    backgroundColor: 'rgba(147, 197, 253, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  linkButtonText: {
    color: '#93c5fd',
    fontSize: 15,
    ...font('semibold'),
  },
  meta: {
    marginTop: spacing.lg,
    gap: 4,
  },
  metaLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metaValue: {
    color: palette.text,
    fontSize: 15,
  },
  acceptButton: {
    marginTop: spacing.xl,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  acceptButtonDisabled: {
    opacity: 0.7,
  },
  acceptGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  acceptButtonText: {
    color: '#ffffff',
    fontSize: 16,
    ...font('bold'),
  },
});
