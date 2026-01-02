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
let SwiftUIDatePicker: any = null;
let GlassEffectContainer: any = null;
let swiftUICornerRadius: any = null;
let swiftUIPadding: any = null;
let swiftUIFrame: any = null;
let swiftUIGlassEffect: any = null;

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
    SwiftUIDatePicker = swiftUI.DatePicker;
    GlassEffectContainer = swiftUI.GlassEffectContainer;
    const modifiers = require('@expo/ui/swift-ui/modifiers');
    swiftUICornerRadius = modifiers.cornerRadius;
    swiftUIPadding = modifiers.padding;
    swiftUIFrame = modifiers.frame;
    swiftUIGlassEffect = modifiers.glassEffect;
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
    SwiftUIDatePicker &&
    GlassEffectContainer &&
    swiftUICornerRadius &&
    swiftUIPadding &&
    swiftUIFrame &&
    swiftUIGlassEffect;
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

  useEffect(() => {
    if (visible) {
      const date = new Date();
      date.setMinutes(date.getMinutes() + 30);
      date.setSeconds(0);
      date.setMilliseconds(0);
      setSelectedDate(date);
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
  };

  const openTimePicker = () => {
    setPickerMode('time');
    setShowTimePicker(true);
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
  };

  const isValidDate = selectedDate > new Date();

  const SheetContent = () => (
    <View style={styles.cardContainer}>
      <View style={styles.content}>
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
          {quickScheduleOptions.map((option) => (
            <Pressable
              key={option.label}
              style={styles.quickOption}
              onPress={() => handleQuickSchedule(option)}
            >
              <Text style={styles.quickOptionText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Custom time</Text>

        <View style={styles.dateTimeRow}>
          <Pressable style={styles.dateTimeButton} onPress={openDatePicker}>
            <Ionicons name="calendar" size={18} color={palette.accent} />
            <Text style={styles.dateTimeText}>{formatDate(selectedDate)}</Text>
          </Pressable>
          <Pressable style={styles.dateTimeButton} onPress={openTimePicker}>
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
  // iOS: Native SwiftUI BottomSheet with Liquid Glass
  // ═══════════════════════════════════════════════════════════════
  if (canRenderSwiftUI) {
    const quickRows = [quickScheduleOptions.slice(0, 2), quickScheduleOptions.slice(2)];
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
          <GlassEffectContainer>
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
                  swiftUIGlassEffect({ glass: { variant: 'regular' } }),
                  swiftUICornerRadius(22),
                  swiftUIFrame({ maxWidth: 440 }),
                ]}
              >
                <SwiftUIHStack alignment="center" spacing={12}>
                  <SwiftUIVStack
                    modifiers={[
                      swiftUIFrame({ width: 36, height: 36 }),
                      swiftUIGlassEffect({ glass: { variant: 'clear', tint: palette.accent } }),
                      swiftUICornerRadius(18),
                    ]}
                  >
                    <SwiftUIImage systemName="calendar" size={16} color={palette.accent} />
                  </SwiftUIVStack>
                  <SwiftUIVStack alignment="leading" spacing={2}>
                    <SwiftUIText size={17} weight="semibold" color={palette.text}>
                      Schedule message
                    </SwiftUIText>
                    <SwiftUIText size={12} color={palette.textMuted}>
                      Send it later without leaving the chat
                    </SwiftUIText>
                  </SwiftUIVStack>
                  <SwiftUISpacer />
                  <SwiftUIButton
                    onPress={onClose}
                    variant="borderless"
                    modifiers={[
                      swiftUIFrame({ width: 30, height: 30 }),
                      swiftUIGlassEffect({ glass: { variant: 'clear' } }),
                      swiftUICornerRadius(15),
                    ]}
                  >
                    <SwiftUIImage systemName="xmark" size={12} color={palette.textMuted} />
                  </SwiftUIButton>
                </SwiftUIHStack>

                {messagePreview ? (
                  <SwiftUIVStack
                    alignment="leading"
                    spacing={4}
                    modifiers={[
                      swiftUIPadding({ horizontal: 12, vertical: 10 }),
                      swiftUIGlassEffect({ glass: { variant: 'clear' } }),
                      swiftUICornerRadius(12),
                    ]}
                  >
                    <SwiftUIText size={11} color={palette.textMuted}>
                      Message
                    </SwiftUIText>
                    <SwiftUIText size={13} color={palette.text} lineLimit={2}>
                      {messagePreview}
                    </SwiftUIText>
                  </SwiftUIVStack>
                ) : null}

                <SwiftUIHStack
                  alignment="center"
                  spacing={8}
                  modifiers={[
                    swiftUIPadding({ horizontal: 12, vertical: 10 }),
                    swiftUIGlassEffect({ glass: { variant: 'clear' } }),
                    swiftUICornerRadius(12),
                  ]}
                >
                  <SwiftUIImage systemName="clock" size={14} color={palette.textMuted} />
                  <SwiftUIText size={12} color={palette.textMuted}>
                    Scheduled for {formatDate(selectedDate)} at {formatTime(selectedDate)}
                  </SwiftUIText>
                </SwiftUIHStack>

                <SwiftUIText size={12} color={palette.textMuted}>
                  Quick picks
                </SwiftUIText>
                <SwiftUIVStack alignment="leading" spacing={8}>
                  {quickRows.map((row, rowIndex) => (
                    <SwiftUIHStack key={`quick-row-${rowIndex}`} spacing={8}>
                      {row.map((option) => (
                        <SwiftUIButton
                          key={option.label}
                          onPress={() => handleQuickSchedule(option)}
                          variant="borderless"
                          modifiers={[
                            swiftUIPadding({ horizontal: 12, vertical: 8 }),
                            swiftUIGlassEffect({ glass: { variant: 'clear' } }),
                            swiftUICornerRadius(18),
                          ]}
                        >
                          <SwiftUIText size={12} color={palette.text}>
                            {option.label}
                          </SwiftUIText>
                        </SwiftUIButton>
                      ))}
                    </SwiftUIHStack>
                  ))}
                </SwiftUIVStack>

                <SwiftUIText size={12} color={palette.textMuted}>
                  Custom time
                </SwiftUIText>
                <SwiftUIVStack
                  key={`schedule-picker-${pickerSeed}`}
                  modifiers={[
                    swiftUIPadding({ horizontal: 4, vertical: 6 }),
                    swiftUIGlassEffect({ glass: { variant: 'clear' } }),
                    swiftUICornerRadius(14),
                  ]}
                >
                  <SwiftUIDatePicker
                    initialDate={selectedDate.toISOString()}
                    displayedComponents="dateAndTime"
                    variant="wheel"
                    onDateSelected={(date: Date) => setSelectedDate(date)}
                    color={palette.accent}
                  />
                </SwiftUIVStack>

                <SwiftUIHStack spacing={10}>
                  <SwiftUIButton
                    onPress={onClose}
                    variant="borderless"
                    modifiers={[
                      swiftUIPadding({ horizontal: 14, vertical: 10 }),
                      swiftUIGlassEffect({ glass: { variant: 'clear' } }),
                      swiftUICornerRadius(12),
                      swiftUIFrame({ maxWidth: 160 }),
                    ]}
                  >
                    <SwiftUIText size={13} weight="medium" color={palette.textMuted}>
                      Cancel
                    </SwiftUIText>
                  </SwiftUIButton>
                  <SwiftUIButton
                    onPress={handleConfirm}
                    disabled={!isValidDate}
                    variant="borderless"
                    modifiers={[
                      swiftUIPadding({ horizontal: 14, vertical: 10 }),
                      swiftUIGlassEffect({
                        glass: {
                          variant: isValidDate ? 'regular' : 'clear',
                          tint: palette.accent,
                        },
                      }),
                      swiftUICornerRadius(12),
                      swiftUIFrame({ maxWidth: 180 }),
                    ]}
                  >
                    <SwiftUIText size={13} weight="semibold" color="#ffffff">
                      Schedule
                    </SwiftUIText>
                  </SwiftUIButton>
                </SwiftUIHStack>

                {!isValidDate ? (
                  <SwiftUIText size={11} color="#EF4444">
                    Time must be in the future
                  </SwiftUIText>
                ) : null}
              </SwiftUIVStack>
            </SwiftUIVStack>
          </GlassEffectContainer>
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radii.md,
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryText: {
    color: palette.textMuted,
    fontSize: 13,
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
  quickOptionText: {
    color: palette.text,
    fontSize: 13,
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
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
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
