import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { palette, radii, spacing } from '../theme/designSystem';
import { GlassCard } from './GlassCard';

export type EphemeralDuration = '5m' | '1h' | '24h' | '7d' | null;

interface EphemeralOptionsProps {
  selectedDuration: EphemeralDuration;
  onSelectDuration: (duration: EphemeralDuration) => void;
}

const DURATION_OPTIONS: { value: EphemeralDuration; label: string; description: string }[] = [
  { value: null, label: 'Off', description: 'Message stays forever' },
  { value: '5m', label: '5 minutes', description: 'Disappears in 5 min' },
  { value: '1h', label: '1 hour', description: 'Disappears in 1 hour' },
  { value: '24h', label: '24 hours', description: 'Disappears in 1 day' },
  { value: '7d', label: '7 days', description: 'Disappears in 1 week' },
];

export const EphemeralOptions: React.FC<EphemeralOptionsProps> = ({
  selectedDuration,
  onSelectDuration,
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleToggleModal = () => {
    setIsModalVisible(!isModalVisible);
  };

  const handleSelectOption = (duration: EphemeralDuration) => {
    onSelectDuration(duration);
    setIsModalVisible(false);
  };

  const isActive = selectedDuration !== null;

  return (
    <>
      <Pressable
        onPress={handleToggleModal}
        style={[styles.triggerButton, isActive && styles.triggerButtonActive]}
        accessibilityLabel="Ephemeral message options"
        accessibilityRole="button"
      >
        <Ionicons
          name="timer-outline"
          size={22}
          color={isActive ? '#FB923C' : 'rgba(255, 255, 255, 0.6)'}
        />
      </Pressable>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsModalVisible(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <GlassCard width={280} variant="default" padding={0}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Ionicons name="timer-outline" size={24} color={palette.text} />
                  <Text style={styles.modalTitle}>Disappearing Message</Text>
                </View>
                <Text style={styles.modalDescription}>
                  Choose how long before this message disappears
                </Text>

                <View style={styles.optionsList}>
                  {DURATION_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value ?? 'off'}
                      style={[
                        styles.optionItem,
                        selectedDuration === option.value && styles.optionItemSelected,
                      ]}
                      onPress={() => handleSelectOption(option.value)}
                    >
                      <View style={styles.optionContent}>
                        <Text style={styles.optionLabel}>{option.label}</Text>
                        <Text style={styles.optionDescription}>{option.description}</Text>
                      </View>
                      {selectedDuration === option.value && (
                        <Ionicons name="checkmark-circle" size={22} color={palette.accent} />
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            </GlassCard>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  triggerButton: {
    padding: spacing.xs,
    borderRadius: radii.md,
  },
  triggerButtonActive: {
    backgroundColor: 'rgba(251, 146, 60, 0.15)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  modalTitle: {
    color: palette.text,
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  modalDescription: {
    color: palette.textMuted,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  optionsList: {
    gap: spacing.xs,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  optionItemSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.4)',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    color: palette.text,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-Medium',
  },
  optionDescription: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});

export default EphemeralOptions;
