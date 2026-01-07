import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState, useEffect } from 'react';
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
let SwiftUIDateTimePicker: any = null;
let swiftUICornerRadius: any = null;
let swiftUIBackground: any = null;
let swiftUIPadding: any = null;
let swiftUIFrame: any = null;
let swiftUIOnTapGesture: any = null;

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
    SwiftUIDateTimePicker = swiftUI.DateTimePicker;
    const modifiers = require('@expo/ui/swift-ui/modifiers');
    swiftUICornerRadius = modifiers.cornerRadius;
    swiftUIBackground = modifiers.background;
    swiftUIPadding = modifiers.padding;
    swiftUIFrame = modifiers.frame;
    swiftUIOnTapGesture = modifiers.onTapGesture;
  } catch (e) {
    console.warn('SwiftUI components not available:', e);
  }
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type ScheduleOption = '30m' | '1h' | '3h' | 'tomorrow' | 'custom' | null;

interface ScheduleMessageSheetProps {
  visible: boolean;
  onClose: () => void;
  onSchedule: (scheduledFor: Date | null) => void;
}

const getScheduleDate = (option: ScheduleOption, customDate?: Date): Date | null => {
  if (option === null) return null;
  if (option === 'custom' && customDate) return customDate;

  const now = new Date();
  switch (option) {
    case '30m':
      return new Date(now.getTime() + 30 * 60 * 1000);
    case '1h':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case '3h':
      return new Date(now.getTime() + 3 * 60 * 60 * 1000);
    case 'tomorrow': {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow;
    }
    default:
      return null;
  }
};

const SCHEDULE_OPTIONS: { value: ScheduleOption; label: string; description: string }[] = [
  { value: null, label: 'Off', description: 'Send immediately' },
  { value: '30m', label: 'In 30 minutes', description: 'Send in half an hour' },
  { value: '1h', label: 'In 1 hour', description: 'Send in one hour' },
  { value: '3h', label: 'In 3 hours', description: 'Send in three hours' },
  { value: 'tomorrow', label: 'Tomorrow morning', description: 'Send at 9:00 AM' },
  { value: 'custom', label: 'Custom time', description: 'Pick a specific date and time' },
];

export const ScheduleMessageSheet: React.FC<ScheduleMessageSheetProps> = ({
  visible,
  onClose,
  onSchedule,
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
    SwiftUIDateTimePicker &&
    swiftUICornerRadius &&
    swiftUIBackground &&
    swiftUIPadding &&
    swiftUIFrame &&
    swiftUIOnTapGesture;

  const [selectedOption, setSelectedOption] = useState<ScheduleOption>(null);
  const [customDate, setCustomDate] = useState<Date>(() => {
    const date = new Date();
    date.setHours(date.getHours() + 1);
    date.setMinutes(0);
    date.setSeconds(0);
    return date;
  });
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  useEffect(() => {
    if (visible) {
      setSelectedOption(null);
      setShowCustomPicker(false);
      const date = new Date();
      date.setHours(date.getHours() + 1);
      date.setMinutes(0);
      date.setSeconds(0);
      setCustomDate(date);
    }
  }, [visible]);

  const handleSelectOption = (option: ScheduleOption) => {
    setSelectedOption(option);
    if (option === 'custom') {
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
      const scheduledDate = getScheduleDate(option);
      onSchedule(scheduledDate);
      onClose();
    }
  };

  const handleCustomDateChange = (_event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      if (pickerMode === 'date') {
        setPickerMode('time');
      } else {
        setShowCustomPicker(false);
      }
    }
    if (date) {
      setCustomDate(date);
    }
  };

  const handleConfirmCustom = () => {
    if (customDate > new Date()) {
      onSchedule(customDate);
      onClose();
    }
  };

  const isCustomDateValid = customDate > new Date();

  const SheetContent = () => (
    <View style={styles.cardContainer}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <View style={styles.headerIcon}>
            <Ionicons name="time-outline" size={18} color={palette.accent} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.modalTitle}>Schedule Message</Text>
            <Text style={styles.modalSubtitle}>
              Choose when to send this message
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={palette.textMuted} />
          </Pressable>
        </View>

        <View style={styles.optionsList}>
          {SCHEDULE_OPTIONS.map((option) => (
            <Pressable
              key={option.value ?? 'off'}
              style={[
                styles.optionItem,
                selectedOption === option.value && styles.optionItemSelected,
              ]}
              onPress={() => handleSelectOption(option.value)}
            >
              <View style={styles.optionContent}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
              {selectedOption === option.value && (
                <Ionicons name="checkmark-circle" size={22} color={palette.accent} />
              )}
            </Pressable>
          ))}
        </View>

        {showCustomPicker && Platform.OS === 'ios' && (
          <View style={styles.customPickerContainer}>
            <DateTimePicker
              value={customDate}
              mode="datetime"
              display="spinner"
              onChange={handleCustomDateChange}
              minimumDate={new Date()}
              textColor={palette.text}
            />
            <View style={styles.customPickerActions}>
              {!isCustomDateValid && (
                <Text style={styles.errorText}>Select a future time</Text>
              )}
              <Pressable
                style={[
                  styles.confirmButton,
                  !isCustomDateValid && styles.confirmButtonDisabled,
                ]}
                onPress={handleConfirmCustom}
                disabled={!isCustomDateValid}
              >
                <Ionicons name="checkmark" size={18} color="#ffffff" />
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        )}

        {showCustomPicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={customDate}
            mode={pickerMode}
            display="default"
            onChange={handleCustomDateChange}
            minimumDate={new Date()}
          />
        )}
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
              onClose();
            }
          }}
          presentationDragIndicator="visible"
        >
          <SwiftUIVStack
            alignment="center"
            spacing={12}
            modifiers={[swiftUIPadding({ horizontal: spacing.lg, vertical: spacing.md })]}
          >
            {/* Header */}
            <SwiftUIHStack alignment="center" spacing={12}>
              <SwiftUIVStack
                modifiers={[
                  swiftUIFrame({ width: 36, height: 36 }),
                  swiftUIBackground('rgba(10, 132, 255, 0.18)'),
                  swiftUICornerRadius(18),
                ]}
              >
                <SwiftUIImage systemName="clock" size={16} color={palette.accent} />
              </SwiftUIVStack>
              <SwiftUIVStack
                alignment="leading"
                spacing={2}
                modifiers={[swiftUIFrame({ maxWidth: 220, alignment: 'leading' })]}
              >
                <SwiftUIText size={17} weight="semibold" color={palette.text}>
                  Schedule Message
                </SwiftUIText>
                <SwiftUIText size={12} color={palette.textMuted}>
                  Choose when to send this message
                </SwiftUIText>
              </SwiftUIVStack>
              <SwiftUISpacer />
              <SwiftUIButton
                systemImage="xmark"
                onPress={onClose}
                variant="plain"
                modifiers={[swiftUIFrame({ width: 30, height: 30 })]}
              />
            </SwiftUIHStack>

            {/* Options */}
            <SwiftUIVStack alignment="leading" spacing={6}>
              {SCHEDULE_OPTIONS.filter((o) => o.value !== 'custom').map((option) => {
                const isSelected = selectedOption === option.value;
                return (
                  <SwiftUIHStack
                    key={option.value ?? 'off'}
                    alignment="center"
                    spacing={12}
                    modifiers={[
                      swiftUIPadding({ horizontal: 14, vertical: 12 }),
                      swiftUIBackground(
                        isSelected ? 'rgba(10, 132, 255, 0.25)' : 'rgba(255, 255, 255, 0.06)'
                      ),
                      swiftUICornerRadius(12),
                      swiftUIFrame({ maxWidth: 380 }),
                      swiftUIOnTapGesture(() => handleSelectOption(option.value)),
                    ]}
                  >
                    <SwiftUIVStack
                      alignment="leading"
                      spacing={2}
                      modifiers={[swiftUIFrame({ maxWidth: 280, alignment: 'leading' })]}
                    >
                      <SwiftUIText size={16} weight="medium" color={palette.text}>
                        {option.label}
                      </SwiftUIText>
                      <SwiftUIText size={13} color={palette.textMuted}>
                        {option.description}
                      </SwiftUIText>
                    </SwiftUIVStack>
                    <SwiftUISpacer />
                    {isSelected ? (
                      <SwiftUIImage
                        systemName="checkmark.circle.fill"
                        size={22}
                        color={palette.accent}
                      />
                    ) : null}
                  </SwiftUIHStack>
                );
              })}
            </SwiftUIVStack>

            {/* Custom time picker */}
            <SwiftUIVStack alignment="center" spacing={8}>
              <SwiftUIText size={13} weight="medium" color={palette.textMuted}>
                Or pick a custom time
              </SwiftUIText>
              <SwiftUIHStack spacing={10}>
                <SwiftUIDateTimePicker
                  initialDate={customDate.toISOString()}
                  displayedComponents="date"
                  variant="compact"
                  onDateSelected={(date: Date) => {
                    const newDate = new Date(customDate);
                    newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                    setCustomDate(newDate);
                    setSelectedOption('custom');
                  }}
                  color={palette.accent}
                />
                <SwiftUIDateTimePicker
                  initialDate={customDate.toISOString()}
                  displayedComponents="hourAndMinute"
                  variant="compact"
                  onDateSelected={(date: Date) => {
                    const newDate = new Date(customDate);
                    newDate.setHours(date.getHours(), date.getMinutes());
                    setCustomDate(newDate);
                    setSelectedOption('custom');
                  }}
                  color={palette.accent}
                />
              </SwiftUIHStack>
              {selectedOption === 'custom' && (
                <SwiftUIButton
                  systemImage="checkmark"
                  onPress={handleConfirmCustom}
                  disabled={!isCustomDateValid}
                  variant="borderedProminent"
                >
                  Schedule for custom time
                </SwiftUIButton>
              )}
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
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
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
  customPickerContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  customPickerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 14,
    ...font('semibold'),
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
  },
});

export default ScheduleMessageSheet;
