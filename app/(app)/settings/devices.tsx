import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../hooks/useTheme';
import { Layout } from '../../../constants/layout';

export default function DevicesScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Active Devices</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <Ionicons name="phone-portrait-outline" size={48} color={colors.accent} />
          <Text style={[styles.infoTitle, { color: colors.text }]}>This Device</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Your current device is registered for end-to-end encryption
          </Text>
        </View>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          Device management for E2EE is coming soon. You'll be able to see all your logged-in devices and revoke access if needed.
        </Text>
      </View>
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
  infoTitle: {
    fontSize: Layout.fontSize.lg,
    fontWeight: Layout.fontWeight.semibold,
    marginTop: Layout.spacing.md,
    marginBottom: Layout.spacing.sm,
  },
  infoText: {
    fontSize: Layout.fontSize.sm,
    textAlign: 'center',
  },
  note: {
    fontSize: Layout.fontSize.sm,
    textAlign: 'center',
    paddingHorizontal: Layout.spacing.lg,
  },
});
