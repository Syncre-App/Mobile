import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { font, palette, radii, spacing } from '../theme/designSystem';

export type EphemeralDuration = '5m' | '1h' | '24h' | '7d' | null;

interface EphemeralOptionsProps {
  selectedDuration: EphemeralDuration;
  onSelectDuration: (duration: EphemeralDuration) => void;
  visible?: boolean;
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
  visible = false,
  onClose,
}) => {
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleSelectOption = (duration: EphemeralDuration) => {
    onSelectDuration(duration);
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={styles.dimOverlay} />
        <View style={styles.dragIndicator} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="timer-outline" size={20} color={palette.accent} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Disappearing Message</Text>
            <Text style={styles.subtitle}>Choose how long before messages disappear</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={20} color={palette.textMuted} />
          </Pressable>
        </View>

        {/* Options */}
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
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={16} color="#0B1630" />
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(8, 10, 16, 0.92)',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 7, 12, 0.35)',
  },
  dragIndicator: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    ...font('bold'),
    letterSpacing: -0.4,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsList: {
    paddingHorizontal: 20,
    gap: spacing.sm,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    minHeight: 64,
  },
  optionItemSelected: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    color: '#ffffff',
    fontSize: 17,
    ...font('semibold'),
  },
  optionDescription: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    marginTop: 4,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default EphemeralOptions;
