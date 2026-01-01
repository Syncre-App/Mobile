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
let SwiftUIText: any = null;
let SwiftUIButton: any = null;
let SwiftUIVStack: any = null;
let SwiftUIHStack: any = null;
let SwiftUIDateTimePicker: any = null;
let SwiftUIDivider: any = null;

if (Platform.OS === 'ios') {
  try {
    const swiftUI = require('@expo/ui/swift-ui');
    SwiftUIHost = swiftUI.Host;
    SwiftUIBottomSheet = swiftUI.BottomSheet;
    SwiftUIText = swiftUI.Text;
    SwiftUIButton = swiftUI.Button;
    SwiftUIVStack = swiftUI.VStack;
    SwiftUIHStack = swiftUI.HStack;
    SwiftUIDateTimePicker = swiftUI.DateTimePicker;
    SwiftUIDivider = swiftUI.Divider;
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

  useEffect(() => {
    if (visible) {
      const date = new Date();
      date.setMinutes(date.getMinutes() + 30);
      date.setSeconds(0);
      date.setMilliseconds(0);
      setSelectedDate(date);
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

  const handleSwiftUIDateChange = (date: Date) => {
    setSelectedDate(date);
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
  };

  const isValidDate = selectedDate > new Date();

  // ═══════════════════════════════════════════════════════════════
  // iOS: Native SwiftUI BottomSheet with SwiftUI DatePicker
  // ═══════════════════════════════════════════════════════════════
  if (shouldUseSwiftUI && SwiftUIHost && SwiftUIBottomSheet && SwiftUIText && SwiftUIButton && SwiftUIVStack && SwiftUIDateTimePicker) {
    return (
      <SwiftUIHost style={styles.swiftUIHost}>
        <SwiftUIBottomSheet
          isOpened={visible}
          onIsOpenedChange={(isOpened: boolean) => {
            if (!isOpened) {
              onClose();
            }
          }}
          presentationDetents={['medium', 'large']}
          presentationDragIndicator="visible"
        >
          <SwiftUIVStack spacing={16} padding={20}>
            <SwiftUIText style="title2" fontWeight="bold">
              Schedule Message
            </SwiftUIText>

            {messagePreview && (
              <SwiftUIText style="caption" color={palette.textMuted} numberOfLines={2}>
                {messagePreview}
              </SwiftUIText>
            )}

            {SwiftUIDivider && <SwiftUIDivider />}

            {/* Quick picks */}
            <SwiftUIText style="subheadline" color={palette.textMuted}>
              Quick picks
            </SwiftUIText>
            <SwiftUIHStack spacing={8}>
              {quickScheduleOptions.slice(0, 3).map((option) => (
                <SwiftUIButton
                  key={option.label}
                  variant="bordered"
                  controlSize="small"
                  onPress={() => handleQuickSchedule(option)}
                >
                  {option.label}
                </SwiftUIButton>
              ))}
            </SwiftUIHStack>
            <SwiftUIButton
              variant="bordered"
              controlSize="small"
              onPress={() => handleQuickSchedule(quickScheduleOptions[3])}
            >
              {quickScheduleOptions[3].label}
            </SwiftUIButton>

            {SwiftUIDivider && <SwiftUIDivider />}

            {/* Date picker */}
            <SwiftUIText style="subheadline" color={palette.textMuted}>
              Custom time
            </SwiftUIText>
            <SwiftUIDateTimePicker
              initialDate={selectedDate.toISOString()}
              onDateSelected={handleSwiftUIDateChange}
              displayedComponents="dateAndTime"
              variant="compact"
            />

            {SwiftUIDivider && <SwiftUIDivider />}

            {/* Actions */}
            <SwiftUIHStack spacing={12}>
              <SwiftUIButton
                variant="bordered"
                onPress={onClose}
              >
                Cancel
              </SwiftUIButton>
              <SwiftUIButton
                variant="borderedProminent"
                systemImage="paperplane"
                disabled={!isValidDate}
                onPress={handleConfirm}
              >
                Schedule
              </SwiftUIButton>
            </SwiftUIHStack>

            {!isValidDate && (
              <SwiftUIText style="caption" color="#EF4444">
                Time must be in the future
              </SwiftUIText>
            )}
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
          <View style={styles.cardContainer}>
            <View style={styles.content}>
              <View style={styles.header}>
                <Ionicons name="calendar-outline" size={24} color={palette.text} />
                <Text style={styles.title}>Schedule message</Text>
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
    width: 320,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  content: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    flex: 1,
    color: palette.text,
    fontSize: 18,
    ...font('semibold'),
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
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
