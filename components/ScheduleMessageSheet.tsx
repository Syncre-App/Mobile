import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { font, palette, radii, spacing } from '../theme/designSystem';
import { GlassySheet } from './GlassySheet';
import { canUseSwiftUI } from '../utils/swiftUi';

// SwiftUI imports for iOS
let SwiftUIBottomSheet: any = null;
let SwiftUIDatePicker: any = null;
let SwiftUIHost: any = null;

if (Platform.OS === 'ios') {
  try {
    const swiftUI = require('@expo/ui/swift-ui');
    SwiftUIBottomSheet = swiftUI.BottomSheet;
    SwiftUIDatePicker = swiftUI.DatePicker;
    SwiftUIHost = swiftUI.Host;
  } catch (e) {
    console.warn('SwiftUI components not available:', e);
  }
}

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

  // Shared content component
  const SheetContent = ({ useSwiftUIDatePicker = false }: { useSwiftUIDatePicker?: boolean }) => (
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
      
      {useSwiftUIDatePicker && SwiftUIDatePicker && SwiftUIHost ? (
        <SwiftUIHost matchContents style={styles.swiftUIPickerContainer}>
          <SwiftUIDatePicker
            initialDate={selectedDate.toISOString()}
            onDateSelected={handleSwiftUIDateChange}
            displayedComponents="dateAndTime"
            variant="automatic"
            color={palette.accent}
          />
        </SwiftUIHost>
      ) : (
        <>
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
        </>
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
  );

  // ═══════════════════════════════════════════════════════════════
  // iOS: Native BottomSheet with SwiftUI DatePicker
  // ═══════════════════════════════════════════════════════════════
  if (shouldUseSwiftUI && SwiftUIBottomSheet && SwiftUIHost) {
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
          <GlassySheet>
            <SheetContent useSwiftUIDatePicker={!!SwiftUIDatePicker} />
          </GlassySheet>
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
            <SheetContent />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
  swiftUIPickerContainer: {
    marginBottom: spacing.md,
    alignItems: 'center',
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
