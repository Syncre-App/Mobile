import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback, useRef } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { font, palette, radii, spacing } from '../theme/designSystem';
import { canUseSwiftUI } from '../utils/swiftUi';

// SwiftUI imports for iOS
let SwiftUIHost: any = null;
let SwiftUIBottomSheet: any = null;
let SwiftUIText: any = null;
let SwiftUIButton: any = null;
let SwiftUIVStack: any = null;
let SwiftUIHStack: any = null;
let SwiftUITextField: any = null;
let SwiftUISwitch: any = null;
let SwiftUIDivider: any = null;
let SwiftUIForm: any = null;
let SwiftUISection: any = null;

if (Platform.OS === 'ios') {
  try {
    const swiftUI = require('@expo/ui/swift-ui');
    SwiftUIHost = swiftUI.Host;
    SwiftUIBottomSheet = swiftUI.BottomSheet;
    SwiftUIText = swiftUI.Text;
    SwiftUIButton = swiftUI.Button;
    SwiftUIVStack = swiftUI.VStack;
    SwiftUIHStack = swiftUI.HStack;
    SwiftUITextField = swiftUI.TextField;
    SwiftUISwitch = swiftUI.Switch;
    SwiftUIDivider = swiftUI.Divider;
    SwiftUIForm = swiftUI.Form;
    SwiftUISection = swiftUI.Section;
  } catch (e) {
    console.warn('SwiftUI components not available:', e);
  }
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MAX_OPTIONS = 10;
const MAX_OPTION_LENGTH = 50;
const MAX_QUESTION_LENGTH = 255;
const MIN_OPTIONS = 2;

interface CreatePollSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreatePoll: (data: { question: string; options: string[]; multiSelect: boolean }) => void;
  isCreating?: boolean;
}

export const CreatePollSheet: React.FC<CreatePollSheetProps> = ({
  visible,
  onClose,
  onCreatePoll,
  isCreating = false,
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multiSelect, setMultiSelect] = useState(false);
  const shouldUseSwiftUI = canUseSwiftUI();
  
  // Refs for SwiftUI TextFields
  const questionRef = useRef<any>(null);
  const optionRefs = useRef<any[]>([]);

  const resetForm = useCallback(() => {
    setQuestion('');
    setOptions(['', '']);
    setMultiSelect(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleAddOption = useCallback(() => {
    if (options.length < MAX_OPTIONS) {
      setOptions([...options, '']);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [options]);

  const handleRemoveOption = useCallback((index: number) => {
    if (options.length > MIN_OPTIONS) {
      setOptions(options.filter((_, i) => i !== index));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [options]);

  const handleOptionChange = useCallback((index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value.slice(0, MAX_OPTION_LENGTH);
    setOptions(newOptions);
  }, [options]);

  const handleCreate = useCallback(() => {
    const trimmedQuestion = question.trim();
    const validOptions = options
      .map((opt) => opt.trim())
      .filter((opt) => opt.length > 0);

    if (!trimmedQuestion) {
      return;
    }

    if (validOptions.length < MIN_OPTIONS) {
      return;
    }

    onCreatePoll({
      question: trimmedQuestion,
      options: validOptions,
      multiSelect,
    });

    resetForm();
  }, [question, options, multiSelect, onCreatePoll, resetForm]);

  const isValid = question.trim().length > 0 &&
    options.filter((opt) => opt.trim().length > 0).length >= MIN_OPTIONS;

  // ═══════════════════════════════════════════════════════════════
  // iOS: Native SwiftUI BottomSheet
  // ═══════════════════════════════════════════════════════════════
  if (shouldUseSwiftUI && SwiftUIHost && SwiftUIBottomSheet && SwiftUIText && SwiftUIButton && SwiftUIVStack && SwiftUITextField) {
    return (
      <SwiftUIHost style={styles.swiftUIHost}>
        <SwiftUIBottomSheet
          isOpened={visible}
          onIsOpenedChange={(isOpened: boolean) => {
            if (!isOpened) {
              handleClose();
            }
          }}
          presentationDetents={['large']}
          presentationDragIndicator="visible"
        >
          <SwiftUIVStack spacing={16} padding={20}>
            <SwiftUIHStack>
              <SwiftUIText style="title2" fontWeight="bold">
                Create Poll
              </SwiftUIText>
            </SwiftUIHStack>

            {/* Question */}
            <SwiftUIText style="subheadline" color={palette.textMuted}>
              Question
            </SwiftUIText>
            <SwiftUITextField
              ref={questionRef}
              defaultValue={question}
              placeholder="What's the question?"
              onChangeText={(text: string) => setQuestion(text.slice(0, MAX_QUESTION_LENGTH))}
              multiline
            />

            {SwiftUIDivider && <SwiftUIDivider />}

            {/* Options */}
            <SwiftUIText style="subheadline" color={palette.textMuted}>
              Options
            </SwiftUIText>
            {options.map((option, index) => (
              <SwiftUIHStack key={index} spacing={8}>
                <SwiftUITextField
                  ref={(ref: any) => (optionRefs.current[index] = ref)}
                  defaultValue={option}
                  placeholder={`Option ${index + 1}`}
                  onChangeText={(text: string) => handleOptionChange(index, text)}
                />
                {options.length > MIN_OPTIONS && (
                  <SwiftUIButton
                    variant="plain"
                    role="destructive"
                    systemImage="xmark.circle.fill"
                    onPress={() => handleRemoveOption(index)}
                  />
                )}
              </SwiftUIHStack>
            ))}

            {options.length < MAX_OPTIONS && (
              <SwiftUIButton
                variant="bordered"
                systemImage="plus.circle"
                onPress={handleAddOption}
              >
                Add option
              </SwiftUIButton>
            )}

            {SwiftUIDivider && <SwiftUIDivider />}

            {/* Multi-select toggle */}
            {SwiftUISwitch && (
              <SwiftUISwitch
                checked={multiSelect}
                onValueChange={setMultiSelect}
                label="Allow multiple answers"
                variant="switch"
              />
            )}

            {SwiftUIDivider && <SwiftUIDivider />}

            {/* Actions */}
            <SwiftUIHStack spacing={12}>
              <SwiftUIButton
                variant="bordered"
                onPress={handleClose}
              >
                Cancel
              </SwiftUIButton>
              <SwiftUIButton
                variant="borderedProminent"
                systemImage="chart.bar"
                disabled={!isValid || isCreating}
                onPress={handleCreate}
              >
                {isCreating ? 'Creating...' : 'Create'}
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
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.cardContainer}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Ionicons name="stats-chart" size={24} color={palette.accent} />
              <Text style={styles.title}>Create poll</Text>
              <Pressable onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={palette.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.label}>Question</Text>
              <TextInput
                style={styles.questionInput}
                value={question}
                onChangeText={(text) => setQuestion(text.slice(0, MAX_QUESTION_LENGTH))}
                placeholder="What's the question?"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                multiline
                maxLength={MAX_QUESTION_LENGTH}
              />
              <Text style={styles.charCount}>
                {question.length}/{MAX_QUESTION_LENGTH}
              </Text>

              <Text style={styles.label}>Options</Text>
              {options.map((option, index) => (
                <View key={index} style={styles.optionRow}>
                  <View style={styles.optionNumber}>
                    <Text style={styles.optionNumberText}>{index + 1}</Text>
                  </View>
                  <TextInput
                    style={styles.optionInput}
                    value={option}
                    onChangeText={(text) => handleOptionChange(index, text)}
                    placeholder={`${index + 1}. option`}
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    maxLength={MAX_OPTION_LENGTH}
                  />
                  {options.length > MIN_OPTIONS && (
                    <Pressable
                      onPress={() => handleRemoveOption(index)}
                      style={styles.removeOptionButton}
                    >
                      <Ionicons name="close-circle" size={22} color="#EF4444" />
                    </Pressable>
                  )}
                </View>
              ))}

              {options.length < MAX_OPTIONS && (
                <Pressable style={styles.addOptionButton} onPress={handleAddOption}>
                  <Ionicons name="add-circle-outline" size={20} color={palette.accent} />
                  <Text style={styles.addOptionText}>Add option</Text>
                </Pressable>
              )}

              <Pressable
                style={styles.multiSelectRow}
                onPress={() => {
                  setMultiSelect(!multiSelect);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <View style={[styles.checkbox, multiSelect && styles.checkboxChecked]}>
                  {multiSelect && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                </View>
                <Text style={styles.multiSelectText}>Allow multiple answers</Text>
              </Pressable>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.createButton,
                  (!isValid || isCreating) && styles.createButtonDisabled,
                ]}
                onPress={handleCreate}
                disabled={!isValid || isCreating}
              >
                <Ionicons name="stats-chart" size={18} color="#ffffff" />
                <Text style={styles.createButtonText}>
                  {isCreating ? 'Creating...' : 'Create'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  cardContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  content: {
    maxHeight: 500,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
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
  scrollContent: {
    padding: spacing.md,
    maxHeight: 320,
  },
  label: {
    color: palette.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  questionInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radii.md,
    padding: spacing.sm,
    color: palette.text,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  charCount: {
    color: palette.textMuted,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  optionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionNumberText: {
    color: palette.accent,
    fontSize: 12,
    ...font('semibold'),
  },
  optionInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: palette.text,
    fontSize: 14,
  },
  removeOptionButton: {
    padding: 4,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    borderStyle: 'dashed',
  },
  addOptionText: {
    color: palette.accent,
    fontSize: 14,
  },
  multiSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  multiSelectText: {
    color: palette.text,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
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
  createButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: palette.accent,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 14,
    ...font('semibold'),
  },
});

export default CreatePollSheet;
