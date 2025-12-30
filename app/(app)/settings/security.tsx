import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../hooks/useTheme';
import { Layout } from '../../../constants/layout';

export default function SecurityScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Security</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.iconContainer, { backgroundColor: colors.accent + '15' }]}>
            <Ionicons name="shield-checkmark" size={32} color={colors.accent} />
          </View>
          <Text style={[styles.infoTitle, { color: colors.text }]}>End-to-End Encryption</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Your messages are encrypted end-to-end. Only you and the recipient can read them.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            SECURITY FEATURES
          </Text>
          <View style={[styles.sectionContent, { backgroundColor: colors.surface }]}>
            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="lock-closed" size={20} color={colors.success} />
              </View>
              <View style={styles.featureInfo}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>
                  Message Encryption
                </Text>
                <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>
                  All messages are encrypted using XChaCha20-Poly1305
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="key" size={20} color={colors.success} />
              </View>
              <View style={styles.featureInfo}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>
                  Password-Protected Keys
                </Text>
                <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>
                  Your encryption keys are protected by your password
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="finger-print" size={20} color={colors.success} />
              </View>
              <View style={styles.featureInfo}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>
                  Biometric Protection
                </Text>
                <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>
                  Use Face ID or fingerprint to unlock the app
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          Syncre never stores your private keys on our servers. They are encrypted with your password and only decrypted on your device.
        </Text>
      </ScrollView>
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
  content: {
    padding: Layout.spacing.lg,
  },
  infoCard: {
    padding: Layout.spacing.xl,
    borderRadius: Layout.radius.lg,
    alignItems: 'center',
    marginBottom: Layout.spacing.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Layout.spacing.md,
  },
  infoTitle: {
    fontSize: Layout.fontSize.lg,
    fontWeight: Layout.fontWeight.semibold,
    marginBottom: Layout.spacing.sm,
  },
  infoText: {
    fontSize: Layout.fontSize.sm,
    textAlign: 'center',
  },
  section: {
    marginBottom: Layout.spacing.lg,
  },
  sectionTitle: {
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
    textTransform: 'uppercase',
    marginBottom: Layout.spacing.sm,
    marginLeft: Layout.spacing.sm,
  },
  sectionContent: {
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Layout.spacing.md,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureInfo: {
    flex: 1,
    marginLeft: Layout.spacing.md,
  },
  featureTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.medium,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: Layout.fontSize.xs,
  },
  note: {
    fontSize: Layout.fontSize.sm,
    textAlign: 'center',
    paddingHorizontal: Layout.spacing.md,
  },
});
