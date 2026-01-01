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
let SwiftUIHStack: any = null;
let SwiftUISpacer: any = null;
let SwiftUIImage: any = null;
let SwiftUIDivider: any = null;
let SwiftUIPicker: any = null;
let swiftUIBackground: any = null;
let swiftUICornerRadius: any = null;
let swiftUIPadding: any = null;

if (Platform.OS === 'ios') {
  try {
    const swiftUI = require('@expo/ui/swift-ui');
    SwiftUIHost = swiftUI.Host;
    SwiftUIBottomSheet = swiftUI.BottomSheet;
    SwiftUIText = swiftUI.Text;
    SwiftUIButton = swiftUI.Button;
    SwiftUIVStack = swiftUI.VStack;
    SwiftUIHStack = swiftUI.HStack;
    SwiftUISpacer = swiftUI.Spacer;
    SwiftUIImage = swiftUI.Image;
    SwiftUIDivider = swiftUI.Divider;
    SwiftUIPicker = swiftUI.Picker;
    const modifiers = require('@expo/ui/swift-ui/modifiers');
    swiftUIBackground = modifiers.background;
    swiftUICornerRadius = modifiers.cornerRadius;
    swiftUIPadding = modifiers.padding;
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

  // ═══════════════════════════════════════════════════════════════
  // iOS: Native SwiftUI BottomSheet
  // ═══════════════════════════════════════════════════════════════
  if (
    shouldUseSwiftUI &&
    SwiftUIHost &&
    SwiftUIBottomSheet &&
    SwiftUIText &&
    SwiftUIButton &&
    SwiftUIVStack &&
    SwiftUIHStack
  ) {
    const iconModifiers =
      swiftUIBackground && swiftUICornerRadius && swiftUIPadding
        ? [
            swiftUIPadding({ all: 8 }),
            swiftUIBackground('rgba(10, 132, 255, 0.18)'),
            swiftUICornerRadius(12),
          ]
        : undefined;

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
          <SwiftUIVStack spacing={16} padding={20} alignment="leading">
            <SwiftUIHStack spacing={12} alignment="center">
              {SwiftUIImage && iconModifiers && (
                <SwiftUIImage
                  systemName="timer"
                  color={palette.accent}
                  size={20}
                  modifiers={iconModifiers}
                />
              )}
              <SwiftUIVStack spacing={4} alignment="leading">
                <SwiftUIText style="title2" fontWeight="bold">
                  Disappearing Message
                </SwiftUIText>
                <SwiftUIText style="subheadline" color={palette.textMuted}>
                  Choose how long before messages disappear
                </SwiftUIText>
              </SwiftUIVStack>
            </SwiftUIHStack>

            {SwiftUIDivider && <SwiftUIDivider />}

            <SwiftUIVStack spacing={10} alignment="leading">
              {DURATION_OPTIONS.map((option) => {
                const isSelected = selectedDuration === option.value;
                return (
                  <SwiftUIButton
                    key={option.value ?? 'off'}
                    variant={isSelected ? 'borderedProminent' : 'bordered'}
                    controlSize="large"
                    onPress={() => handleSelectOption(option.value)}
                  >
                    <SwiftUIHStack spacing={12} alignment="center">
                      <SwiftUIVStack spacing={2} alignment="leading">
                        <SwiftUIText style="headline" fontWeight={isSelected ? 'semibold' : 'regular'}>
                          {option.label}
                        </SwiftUIText>
                        <SwiftUIText style="caption" color={palette.textMuted}>
                          {option.description}
                        </SwiftUIText>
                      </SwiftUIVStack>
                      {SwiftUISpacer && <SwiftUISpacer />}
                      {SwiftUIImage && (
                        <SwiftUIImage
                          systemName={isSelected ? 'checkmark.circle.fill' : 'circle'}
                          color={isSelected ? palette.accent : palette.textMuted}
                          size={18}
                        />
                      )}
                    </SwiftUIHStack>
                  </SwiftUIButton>
                );
              })}
            </SwiftUIVStack>
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
                <View style={styles.headerIcon}>
                  <Ionicons name="timer-outline" size={18} color={palette.accent} />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.modalTitle}>Disappearing Message</Text>
                  <Text style={styles.modalSubtitle}>
                    Choose how long before messages disappear
                  </Text>
                </View>
                <Pressable onPress={handleClose} style={styles.closeButton}>
                  <Ionicons name="close" size={20} color={palette.textMuted} />
                </Pressable>
              </View>

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
    backgroundColor: 'rgba(3, 7, 18, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    padding: spacing.lg,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  modalContent: {
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(10, 132, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
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
  modalSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  optionsList: {
    gap: spacing.sm,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  optionItemSelected: {
    backgroundColor: 'rgba(10, 132, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.4)',
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
