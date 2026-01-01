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
let SwiftUIVStack: any = null;
let SwiftUIHStack: any = null;
let SwiftUIText: any = null;
let SwiftUIButton: any = null;
let SwiftUIImage: any = null;
let SwiftUISpacer: any = null;
let swiftUIBackground: any = null;
let swiftUICornerRadius: any = null;
let swiftUIBorder: any = null;
let swiftUIPadding: any = null;
let swiftUIShadow: any = null;
let swiftUIFrame: any = null;
if (Platform.OS === 'ios') {
  try {
    const swiftUI = require('@expo/ui/swift-ui');
    SwiftUIHost = swiftUI.Host;
    SwiftUIBottomSheet = swiftUI.BottomSheet;
    SwiftUIVStack = swiftUI.VStack;
    SwiftUIHStack = swiftUI.HStack;
    SwiftUIText = swiftUI.Text;
    SwiftUIButton = swiftUI.Button;
    SwiftUIImage = swiftUI.Image;
    SwiftUISpacer = swiftUI.Spacer;
    const modifiers = require('@expo/ui/swift-ui/modifiers');
    swiftUIBackground = modifiers.background;
    swiftUICornerRadius = modifiers.cornerRadius;
    swiftUIBorder = modifiers.border;
    swiftUIPadding = modifiers.padding;
    swiftUIShadow = modifiers.shadow;
    swiftUIFrame = modifiers.frame;
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
  const canRenderSwiftUI =
    shouldUseSwiftUI &&
    SwiftUIHost &&
    SwiftUIBottomSheet &&
    SwiftUIVStack &&
    SwiftUIHStack &&
    SwiftUIText &&
    SwiftUIButton &&
    SwiftUIImage &&
    SwiftUISpacer &&
    swiftUIBackground &&
    swiftUICornerRadius &&
    swiftUIBorder &&
    swiftUIPadding &&
    swiftUIShadow &&
    swiftUIFrame;

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleSelectOption = (duration: EphemeralDuration) => {
    onSelectDuration(duration);
    handleClose();
  };

  const SheetContent = () => (
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
  );

  // ═══════════════════════════════════════════════════════════════
  // iOS: Native SwiftUI BottomSheet
  // ═══════════════════════════════════════════════════════════════
  if (canRenderSwiftUI) {
    return (
      <SwiftUIHost style={styles.swiftUIHost} useViewportSizeMeasurement>
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
          <SwiftUIVStack
            alignment="center"
            spacing={12}
            modifiers={[swiftUIPadding({ horizontal: spacing.lg, vertical: spacing.md })]}
          >
            <SwiftUIVStack
              alignment="leading"
              spacing={12}
              modifiers={[
                swiftUIPadding({ horizontal: spacing.lg, vertical: spacing.lg }),
                swiftUIBackground('rgba(15, 23, 42, 0.9)'),
                swiftUICornerRadius(22),
                swiftUIBorder({ color: 'rgba(255, 255, 255, 0.12)', width: 1 }),
                swiftUIShadow({ radius: 18, y: 10, color: 'rgba(0, 0, 0, 0.35)' }),
                swiftUIFrame({ maxWidth: 420 }),
              ]}
            >
              <SwiftUIHStack alignment="center" spacing={12}>
                <SwiftUIVStack
                  modifiers={[
                    swiftUIFrame({ width: 36, height: 36 }),
                    swiftUIBackground('rgba(10, 132, 255, 0.18)'),
                    swiftUICornerRadius(18),
                  ]}
                >
                  <SwiftUIImage systemName="timer" size={16} color={palette.accent} />
                </SwiftUIVStack>
                <SwiftUIVStack
                  alignment="leading"
                  spacing={2}
                  modifiers={[swiftUIFrame({ maxWidth: 220, alignment: 'leading' })]}
                >
                  <SwiftUIText size={17} weight="semibold" color={palette.text}>
                    Disappearing Message
                  </SwiftUIText>
                  <SwiftUIText size={12} color={palette.textMuted}>
                    Choose how long before messages disappear
                  </SwiftUIText>
                </SwiftUIVStack>
                <SwiftUISpacer />
                <SwiftUIButton
                  onPress={handleClose}
                  variant="borderless"
                  modifiers={[
                    swiftUIFrame({ width: 30, height: 30 }),
                    swiftUIBackground('rgba(255, 255, 255, 0.08)'),
                    swiftUICornerRadius(15),
                  ]}
                >
                  <SwiftUIImage systemName="xmark" size={12} color={palette.textMuted} />
                </SwiftUIButton>
              </SwiftUIHStack>

              <SwiftUIVStack alignment="leading" spacing={10}>
                {DURATION_OPTIONS.map((option) => {
                  const isSelected = selectedDuration === option.value;
                  return (
                    <SwiftUIButton
                      key={option.value ?? 'off'}
                      onPress={() => handleSelectOption(option.value)}
                      variant="borderless"
                      modifiers={[
                        swiftUIPadding({ horizontal: 12, vertical: 10 }),
                        swiftUIBackground(
                          isSelected ? 'rgba(10, 132, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)'
                        ),
                        swiftUICornerRadius(14),
                        swiftUIBorder({
                          color: isSelected
                            ? 'rgba(10, 132, 255, 0.55)'
                            : 'rgba(255, 255, 255, 0.12)',
                          width: 1,
                        }),
                      ]}
                    >
                      <SwiftUIHStack alignment="center" spacing={12}>
                        <SwiftUIVStack
                          alignment="leading"
                          spacing={2}
                          modifiers={[swiftUIFrame({ maxWidth: 240, alignment: 'leading' })]}
                        >
                          <SwiftUIText size={15} weight="medium" color={palette.text}>
                            {option.label}
                          </SwiftUIText>
                          <SwiftUIText size={12} color={palette.textMuted}>
                            {option.description}
                          </SwiftUIText>
                        </SwiftUIVStack>
                        <SwiftUISpacer />
                        {isSelected ? (
                          <SwiftUIImage
                            systemName="checkmark.circle.fill"
                            size={18}
                            color={palette.accent}
                          />
                        ) : null}
                      </SwiftUIHStack>
                    </SwiftUIButton>
                  );
                })}
              </SwiftUIVStack>
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
          <SheetContent />
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
  sheetContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
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
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
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
