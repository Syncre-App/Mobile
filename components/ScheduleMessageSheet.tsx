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

interface ScheduleMessageSheetProps {
  visible: boolean;
  onClose: () => void;
  onSchedule: (scheduledFor: Date) => void;
  messagePreview?: string;
}

const formatDate = (date: Date): string => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) {
    return 'Today';
  }
  if (isTomorrow) {
    return 'Tomorrow';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const ScheduleMessageSheet: React.FC<ScheduleMessageSheetProps> = ({
  visible,
  onClose,
  onSchedule,
  messagePreview,
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
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + 30);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [pickerSeed, setPickerSeed] = useState(0);
  const [activeQuickOption, setActiveQuickOption] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      const date = new Date();
      date.setMinutes(date.getMinutes() + 30);
      date.setSeconds(0);
      date.setMilliseconds(0);
      setSelectedDate(date);
      setActiveQuickOption('30 min');
      setPickerSeed((seed) => seed + 1);
    }
  }, [visible]);

  const handleDateChange = (_event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      setActiveQuickOption(null);
    }
  };

  const handleConfirm = () => {
    if (selectedDate <= new Date()) {
      return;
    }
    onSchedule(selectedDate);
    onClose();
  };

  const openDatePicker = () => {
    setPickerMode('date');
    setShowDatePicker(true);
    setActiveQuickOption(null);
  };

  const openTimePicker = () => {
    setPickerMode('time');
    setShowTimePicker(true);
    setActiveQuickOption(null);
  };

  const quickScheduleOptions = [
    { label: '30 min', minutes: 30 },
    { label: '1 hour', minutes: 60 },
    { label: '3 hours', minutes: 180 },
    { label: 'Tomorrow morning', preset: 'tomorrow_morning' },
  ];

  const handleQuickSchedule = (option: typeof quickScheduleOptions[0]) => {
    const date = new Date();
    if (option.preset === 'tomorrow_morning') {
      date.setDate(date.getDate() + 1);
      date.setHours(9, 0, 0, 0);
    } else if (option.minutes) {
      date.setMinutes(date.getMinutes() + option.minutes);
    }
    date.setSeconds(0);
    date.setMilliseconds(0);
    setSelectedDate(date);
    setPickerSeed((seed) => seed + 1);
    setActiveQuickOption(option.label);
  };

  const isValidDate = selectedDate > new Date();

  const SheetContent = () => (
    <View style={styles.cardContainer}>
      <View style={styles.content}>
        <View style={styles.sheetHandle} />
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="calendar-outline" size={18} color={palette.accent} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Schedule message</Text>
            <Text style={styles.subtitle}>Send it later without leaving the chat</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={palette.textMuted} />
          </Pressable>
        </View>

        {messagePreview ? (
          <View style={styles.previewContainer}>
            <Text style={styles.previewLabel}>Message:</Text>
            <Text style={styles.previewText} numberOfLines={2}>
              {messagePreview}
            </Text>
          </View>
        ) : null}

        <View style={styles.summaryRow}>
          <Ionicons name="time-outline" size={16} color={palette.textMuted} />
          <Text style={styles.summaryText}>
            Scheduled for {formatDate(selectedDate)} at {formatTime(selectedDate)}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Quick picks</Text>
        <View style={styles.quickOptions}>
          {quickScheduleOptions.map((option) => {
            const isActive = activeQuickOption === option.label;
            return (
              <Pressable
                key={option.label}
                style={[styles.quickOption, isActive && styles.quickOptionActive]}
                onPress={() => handleQuickSchedule(option)}
              >
                <Text style={[styles.quickOptionText, isActive && styles.quickOptionTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Custom time</Text>

        <View style={styles.dateTimeRow}>
          <Pressable
            style={[styles.dateTimeButton, showDatePicker && styles.dateTimeButtonActive]}
            onPress={openDatePicker}
          >
            <Ionicons name="calendar" size={18} color={palette.accent} />
            <Text style={styles.dateTimeText}>{formatDate(selectedDate)}</Text>
          </Pressable>
          <Pressable
            style={[styles.dateTimeButton, showTimePicker && styles.dateTimeButtonActive]}
            onPress={openTimePicker}
          >
            <Ionicons name="time" size={18} color={palette.accent} />
            <Text style={styles.dateTimeText}>{formatTime(selectedDate)}</Text>
          </Pressable>
        </View>

        {(showDatePicker || showTimePicker) && Platform.OS === 'ios' && (
          <View style={styles.pickerContainer}>
            <DateTimePicker
              value={selectedDate}
              mode={pickerMode}
              display="spinner"
              onChange={handleDateChange}
              minimumDate={new Date()}
              locale="en-US"
              textColor={palette.text}
            />
          </View>
        )}

        {showDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}

        {showTimePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={selectedDate}
            mode="time"
            display="default"
            onChange={handleDateChange}
            is24Hour
          />
        )}

        <View style={styles.footer}>
          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[
              styles.scheduleButton,
              !isValidDate && styles.scheduleButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!isValidDate}
          >
            <Ionicons name="send" size={16} color="#ffffff" />
            <Text style={styles.scheduleButtonText}>Schedule</Text>
          </Pressable>
        </View>

        {!isValidDate && (
          <Text style={styles.errorText}>
            Time must be in the future
          </Text>
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
            key={`schedule-sheet-${pickerSeed}`}
            alignment="center"
            spacing={16}
            modifiers={[swiftUIPadding({ horizontal: spacing.lg, vertical: spacing.md })]}
          >
            {/* Header */}
            <SwiftUIHStack alignment="center" spacing={12}>
              <SwiftUIVStack
                modifiers={[
                  swiftUIFrame({ width: 40, height: 40 }),
                  swiftUIBackground('rgba(10, 132, 255, 0.18)'),
                  swiftUICornerRadius(20),
                ]}
              >
                <SwiftUIImage systemName="calendar.badge.clock" size={18} color={palette.accent} />
              </SwiftUIVStack>
              <SwiftUIVStack alignment="leading" spacing={2}>
                <SwiftUIText size={18} weight="semibold" color={palette.text}>
                  Schedule message
                </SwiftUIText>
                <SwiftUIText size={13} color={palette.textMuted}>
                  Send it later without leaving the chat
                </SwiftUIText>
              </SwiftUIVStack>
              <SwiftUISpacer />
              <SwiftUIButton
                systemImage="xmark"
                onPress={onClose}
                variant="plain"
              />
            </SwiftUIHStack>

            {messagePreview ? (
              <SwiftUIVStack
                alignment="leading"
                spacing={4}
                modifiers={[
                  swiftUIPadding({ horizontal: 14, vertical: 12 }),
                  swiftUIBackground('rgba(255, 255, 255, 0.06)'),
                  swiftUICornerRadius(12),
                  swiftUIFrame({ maxWidth: 340, alignment: 'leading' }),
                ]}
              >
                <SwiftUIText size={12} weight="medium" color={palette.textMuted}>
                  Message
                </SwiftUIText>
                <SwiftUIText size={14} color={palette.text} lineLimit={2}>
                  {messagePreview}
                </SwiftUIText>
              </SwiftUIVStack>
            ) : null}

            {/* Scheduled time display */}
            <SwiftUIHStack
              alignment="center"
              spacing={10}
              modifiers={[
                swiftUIPadding({ horizontal: 16, vertical: 12 }),
                swiftUIBackground('rgba(10, 132, 255, 0.12)'),
                swiftUICornerRadius(12),
              ]}
            >
              <SwiftUIImage systemName="clock.fill" size={16} color={palette.accent} />
              <SwiftUIText size={14} weight="medium" color={palette.text}>
                {formatDate(selectedDate)} at {formatTime(selectedDate)}
              </SwiftUIText>
            </SwiftUIHStack>

            {/* Quick picks */}
            <SwiftUIVStack alignment="leading" spacing={8}>
              <SwiftUIText size={13} weight="medium" color={palette.textMuted}>
                Quick picks
              </SwiftUIText>
              <SwiftUIHStack spacing={8}>
                {quickScheduleOptions.slice(0, 3).map((option) => {
                  const isActive = activeQuickOption === option.label;
                  return (
                    <SwiftUIHStack
                      key={option.label}
                      alignment="center"
                      modifiers={[
                        swiftUIPadding({ horizontal: 14, vertical: 10 }),
                        swiftUIBackground(
                          isActive ? 'rgba(10, 132, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)'
                        ),
                        swiftUICornerRadius(20),
                        swiftUIOnTapGesture(() => handleQuickSchedule(option)),
                      ]}
                    >
                      <SwiftUIText size={14} weight={isActive ? 'semibold' : 'medium'} color={palette.text}>
                        {option.label}
                      </SwiftUIText>
                    </SwiftUIHStack>
                  );
                })}
              </SwiftUIHStack>
              <SwiftUIHStack spacing={8}>
                {quickScheduleOptions.slice(3).map((option) => {
                  const isActive = activeQuickOption === option.label;
                  return (
                    <SwiftUIHStack
                      key={option.label}
                      alignment="center"
                      modifiers={[
                        swiftUIPadding({ horizontal: 14, vertical: 10 }),
                        swiftUIBackground(
                          isActive ? 'rgba(10, 132, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)'
                        ),
                        swiftUICornerRadius(20),
                        swiftUIOnTapGesture(() => handleQuickSchedule(option)),
                      ]}
                    >
                      <SwiftUIText size={14} weight={isActive ? 'semibold' : 'medium'} color={palette.text}>
                        {option.label}
                      </SwiftUIText>
                    </SwiftUIHStack>
                  );
                })}
              </SwiftUIHStack>
            </SwiftUIVStack>

            {/* Date picker */}
            <SwiftUIVStack alignment="leading" spacing={8}>
              <SwiftUIText size={13} weight="medium" color={palette.textMuted}>
                Custom time
              </SwiftUIText>
              <SwiftUIHStack spacing={10}>
                <SwiftUIDateTimePicker
                  initialDate={selectedDate.toISOString()}
                  displayedComponents="date"
                  variant="compact"
                  onDateSelected={(date: Date) => {
                    const newDate = new Date(selectedDate);
                    newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                    setSelectedDate(newDate);
                    setActiveQuickOption(null);
                  }}
                  color={palette.accent}
                />
                <SwiftUIDateTimePicker
                  initialDate={selectedDate.toISOString()}
                  displayedComponents="hourAndMinute"
                  variant="compact"
                  onDateSelected={(date: Date) => {
                    const newDate = new Date(selectedDate);
                    newDate.setHours(date.getHours(), date.getMinutes());
                    setSelectedDate(newDate);
                    setActiveQuickOption(null);
                  }}
                  color={palette.accent}
                />
              </SwiftUIHStack>
            </SwiftUIVStack>

            {/* Error message */}
            {!isValidDate ? (
              <SwiftUIHStack alignment="center" spacing={6}>
                <SwiftUIImage systemName="exclamationmark.triangle.fill" size={14} color="#EF4444" />
                <SwiftUIText size={13} color="#EF4444">
                  Please select a time in the future
                </SwiftUIText>
              </SwiftUIHStack>
            ) : null}

            {/* Footer buttons */}
            <SwiftUIHStack spacing={12}>
              <SwiftUIButton onPress={onClose} variant="bordered">
                Cancel
              </SwiftUIButton>
              <SwiftUIButton
                systemImage="paperplane.fill"
                onPress={handleConfirm}
                disabled={!isValidDate}
                variant="borderedProminent"
              >
                Schedule
              </SwiftUIButton>
            </SwiftUIHStack>
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
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  content: {
    padding: spacing.lg,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
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
  title: {
    color: palette.text,
    fontSize: 18,
    ...font('semibold'),
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  previewContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  previewLabel: {
    color: palette.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  previewText: {
    color: palette.text,
    fontSize: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(10, 132, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.35)',
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryText: {
    color: palette.text,
    fontSize: 13,
    ...font('medium'),
  },
  sectionLabel: {
    color: palette.textMuted,
    fontSize: 12,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  quickOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  quickOptionActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.22)',
    borderColor: 'rgba(10, 132, 255, 0.55)',
  },
  quickOptionText: {
    color: palette.text,
    fontSize: 13,
  },
  quickOptionTextActive: {
    color: palette.text,
    ...font('semibold'),
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
  },
  dateTimeButtonActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.16)',
    borderColor: 'rgba(10, 132, 255, 0.45)',
  },
  dateTimeText: {
    color: palette.text,
    fontSize: 14,
    ...font('medium'),
  },
  pickerContainer: {
    marginBottom: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  cancelButtonText: {
    color: palette.textMuted,
    fontSize: 14,
    ...font('medium'),
  },
  scheduleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: palette.accent,
  },
  scheduleButtonDisabled: {
    opacity: 0.5,
  },
  scheduleButtonText: {
    color: '#ffffff',
    fontSize: 14,
    ...font('semibold'),
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default ScheduleMessageSheet;
