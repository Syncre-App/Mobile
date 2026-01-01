import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { font, palette, radii, spacing } from '../theme/designSystem';

export type EphemeralDuration = '5m' | '1h' | '24h' | '7d' | null;

interface EphemeralOptionsProps {
  selectedDuration: EphemeralDuration;
  onSelectDuration: (duration: EphemeralDuration) => void;
  /** External visibility control - when provided, no trigger button is rendered */
  visible?: boolean;
  /** Called when sheet should close - required when visible is provided */
  onClose?: () => void;
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
  visible,
  onClose,
}) => {
  // External control mode: visible and onClose are provided
  const isExternallyControlled = visible !== undefined && onClose !== undefined;
  const isModalVisible = isExternallyControlled ? visible : false;

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleSelectOption = (duration: EphemeralDuration) => {
    onSelectDuration(duration);
    handleClose();
  };

  // Shared content component
  const SheetContent = () => (
    <View style={styles.modalContent}>
      <View style={styles.modalHeader}>
        <Ionicons name="timer-outline" size={24} color={palette.text} />
        <Text style={styles.modalTitle}>Disappearing Message</Text>
        <Pressable onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={20} color={palette.textMuted} />
        </Pressable>
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
  );

  // If externally controlled, just render the modal
  if (isExternallyControlled) {
    return (
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.modalOverlay} onPress={handleClose}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.cardContainer}>
              <SheetContent />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // Legacy mode: no trigger button rendered (component is now only used externally controlled)
  return null;
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
  swiftUIHost: {
    width: 0,
    height: 0,
  },
  cardContainer: {
    width: 280,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
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
  closeButton: {
    padding: spacing.xs,
    marginLeft: 'auto',
  },
  modalTitle: {
    color: palette.text,
    fontSize: 18,
    ...font('semibold'),
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
    ...font('medium'),
  },
  optionDescription: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});

export default EphemeralOptions;
