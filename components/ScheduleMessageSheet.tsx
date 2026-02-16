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
import { BlurView } from 'expo-blur';
import { font, palette, radii, spacing } from '../theme/designSystem';

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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={styles.dimOverlay} />
        <View style={styles.dragIndicator} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="time-outline" size={20} color={palette.accent} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Schedule Message</Text>
            <Text style={styles.subtitle}>Choose when to send this message</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={20} color={palette.textMuted} />
          </Pressable>
        </View>

        {/* Options */}
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
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={16} color="#0B1630" />
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Custom Date Picker */}
        {showCustomPicker && Platform.OS === 'ios' && (
          <View style={styles.customPickerContainer}>
            <DateTimePicker
              value={customDate}
              mode="datetime"
              display="spinner"
              onChange={handleCustomDateChange}
              minimumDate={new Date()}
              textColor="#ffffff"
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
                <Text style={styles.confirmButtonText}>Schedule</Text>
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
  customPickerContainer: {
    marginTop: 24,
    paddingTop: 20,
    marginHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  customPickerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 16,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radii.lg,
    minHeight: 50,
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    ...font('bold'),
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    ...font('medium'),
  },
});

export default ScheduleMessageSheet;
