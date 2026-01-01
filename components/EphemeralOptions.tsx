import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { font, palette, radii, spacing } from '../theme/designSystem';
import { canUseSwiftUI } from '../utils/swiftUi';

// SwiftUI imports for iOS
let SwiftUIHost: any = null;
let SwiftUIBottomSheet: any = null;
let SwiftUIText: any = null;
let SwiftUIButton: any = null;
let SwiftUIVStack: any = null;
let SwiftUIDivider: any = null;
let SwiftUIPicker: any = null;

if (Platform.OS === 'ios') {
  try {
    const swiftUI = require('@expo/ui/swift-ui');
    SwiftUIHost = swiftUI.Host;
    SwiftUIBottomSheet = swiftUI.BottomSheet;
    SwiftUIText = swiftUI.Text;
    SwiftUIButton = swiftUI.Button;
    SwiftUIVStack = swiftUI.VStack;
    SwiftUIDivider = swiftUI.Divider;
    SwiftUIPicker = swiftUI.Picker;
  } catch (e) {
    console.warn('SwiftUI components not available:', e);
  }
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const shouldUseSwiftUI = canUseSwiftUI();

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleSelectOption = (duration: EphemeralDuration) => {
    onSelectDuration(duration);
    handleClose();
  };

  const selectedIndex = DURATION_OPTIONS.findIndex((opt) => opt.value === selectedDuration);

  // ═══════════════════════════════════════════════════════════════
  // iOS: Native SwiftUI BottomSheet
  // ═══════════════════════════════════════════════════════════════
  if (shouldUseSwiftUI && SwiftUIHost && SwiftUIBottomSheet && SwiftUIText && SwiftUIButton && SwiftUIVStack) {
    return (
      <SwiftUIHost style={styles.swiftUIHost}>
        <SwiftUIBottomSheet
          isOpened={visible}
          onIsOpenedChange={(isOpened: boolean) => {
            if (!isOpened) {
              handleClose();
            }
          }}
          presentationDetents={['medium']}
          presentationDragIndicator="visible"
        >
          <SwiftUIVStack spacing={12} padding={20}>
            <SwiftUIText style="title2" fontWeight="bold">
              Disappearing Message
            </SwiftUIText>
            <SwiftUIText style="subheadline" color={palette.textMuted}>
              Choose how long before this message disappears
            </SwiftUIText>

            {SwiftUIDivider && <SwiftUIDivider />}

            {DURATION_OPTIONS.map((option) => (
              <SwiftUIButton
                key={option.value ?? 'off'}
                variant={selectedDuration === option.value ? 'borderedProminent' : 'bordered'}
                systemImage={selectedDuration === option.value ? 'checkmark.circle.fill' : 'circle'}
                onPress={() => handleSelectOption(option.value)}
              >
                {option.label}
              </SwiftUIButton>
            ))}
          </SwiftUIVStack>
        </SwiftUIBottomSheet>
      </SwiftUIHost>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Android / Fallback: Modal
  // ═══════════════════════════════════════════════════════════════
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.modalOverlay} onPress={handleClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={styles.cardContainer}>
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
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  swiftUIHost: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  cardContainer: {
    width: 300,
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
