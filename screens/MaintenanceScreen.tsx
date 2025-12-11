import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBackground } from '../components/AppBackground';
import { GlassCard } from '../components/GlassCard';
import { palette, spacing } from '../theme/designSystem';

export const MaintenanceScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <AppBackground />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.overline}>Hang tight</Text>
          <Text style={styles.title}>We&apos;re polishing things</Text>
          <Text style={styles.message}>
            Maintenance keeps Syncre fast, private, and secure. Back shortly.
          </Text>
        </View>

        <GlassCard width={360} style={styles.card} variant="subtle" padding={spacing.lg}>
          <View style={styles.cardContent}>
            <Ionicons name="construct" size={48} color="#fff7" />
            <Text style={styles.cardTitle}>Under Maintenance</Text>
            <LinearGradient colors={['#2C82FF', '#0EA5FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.underline} />
            <Text style={styles.cardMessage}>
              We&apos;re updating infrastructure and tightening security. Your data remains safe.
            </Text>
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
};

export default MaintenanceScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    gap: spacing.lg,
  },
  hero: { alignItems: 'center', gap: spacing.xs },
  logo: { width: 120, height: 120 },
  overline: {
    color: palette.textSubtle,
    fontFamily: 'SpaceGrotesk-Medium',
    letterSpacing: 4,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  title: {
    color: palette.text,
    fontSize: 28,
    fontFamily: 'SpaceGrotesk-SemiBold',
    textAlign: 'center',
  },
  message: {
    color: palette.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  card: { alignSelf: 'center', width: '100%', maxWidth: 420 },
  cardContent: { alignItems: 'center', padding: spacing.sm },
  cardTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  underline: { width: 80, height: 3, borderRadius: 2, marginBottom: spacing.lg },
  cardMessage: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 14, textAlign: 'center' },
});
