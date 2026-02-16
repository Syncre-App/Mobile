import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { font, palette, radii, spacing } from '../theme/designSystem';

const MAX_OPTIONS = 10;
const MAX_OPTION_LENGTH = 50;
const MAX_QUESTION_LENGTH = 255;
const MIN_OPTIONS = 2;

type PollOption = { id: string; text: string };

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
  const optionIdRef = useRef(0);
  const buildOption = useCallback((): PollOption => {
    const id = optionIdRef.current;
    optionIdRef.current += 1;
    return { id: `option-${id}`, text: '' };
  }, []);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<PollOption[]>(() => [buildOption(), buildOption()]);
  const [multiSelect, setMultiSelect] = useState(false);

  const resetForm = useCallback(() => {
    optionIdRef.current = 0;
    setQuestion('');
    setOptions([buildOption(), buildOption()]);
    setMultiSelect(false);
  }, [buildOption]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleAddOption = useCallback(() => {
    if (options.length < MAX_OPTIONS) {
      setOptions((prev) => [...prev, buildOption()]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [buildOption, options.length]);

  const handleRemoveOption = useCallback((optionId: string) => {
    if (options.length > MIN_OPTIONS) {
      setOptions((prev) => prev.filter((option) => option.id !== optionId));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [options.length]);

  const handleOptionChange = useCallback((optionId: string, value: string) => {
    setOptions((prev) =>
      prev.map((option) =>
        option.id === optionId
          ? { ...option, text: value.slice(0, MAX_OPTION_LENGTH) }
          : option
      )
    );
  }, []);

  const handleCreate = useCallback(() => {
    const trimmedQuestion = question.trim();
    const validOptions = options
      .map((opt) => opt.text.trim())
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
    options.filter((opt) => opt.text.trim().length > 0).length >= MIN_OPTIONS;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={styles.dimOverlay} />
        <View style={styles.dragIndicator} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="stats-chart" size={20} color={palette.accent} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Create Poll</Text>
            <Text style={styles.subtitle}>Ask a question and collect votes</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={20} color={palette.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Question */}
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

          {/* Options */}
          <Text style={styles.label}>Options</Text>
          {options.map((option, index) => (
            <View key={option.id} style={styles.optionRow}>
              <View style={styles.optionNumber}>
                <Text style={styles.optionNumberText}>{index + 1}</Text>
              </View>
              <TextInput
                style={styles.optionInput}
                value={option.text}
                onChangeText={(text) => handleOptionChange(option.id, text)}
                placeholder={`Option ${index + 1}`}
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                maxLength={MAX_OPTION_LENGTH}
              />
              {options.length > MIN_OPTIONS && (
                <Pressable
                  onPress={() => handleRemoveOption(option.id)}
                  style={styles.removeOptionButton}
                >
                  <Ionicons name="close-circle" size={24} color="#EF4444" />
                </Pressable>
              )}
            </View>
          ))}

          {options.length < MAX_OPTIONS && (
            <Pressable style={styles.addOptionButton} onPress={handleAddOption}>
              <Ionicons name="add-circle-outline" size={22} color={palette.accent} />
              <Text style={styles.addOptionText}>Add option</Text>
            </Pressable>
          )}

          {/* Multi-select toggle */}
          <Pressable
            style={styles.multiSelectRow}
            onPress={() => {
              setMultiSelect(!multiSelect);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <View style={[styles.checkbox, multiSelect && styles.checkboxChecked]}>
              {multiSelect && <Ionicons name="checkmark" size={16} color="#0B1630" />}
            </View>
            <Text style={styles.multiSelectText}>Allow multiple answers</Text>
          </Pressable>
        </ScrollView>

        {/* Footer */}
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
              {isCreating ? 'Creating...' : 'Create Poll'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    marginBottom: 20,
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
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    ...font('semibold'),
  },
  questionInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radii.lg,
    padding: 16,
    color: '#ffffff',
    fontSize: 17,
    minHeight: 100,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  charCount: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 24,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  optionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionNumberText: {
    color: palette.accent,
    fontSize: 14,
    ...font('bold'),
  },
  optionInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
    minHeight: 50,
  },
  removeOptionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    marginTop: 8,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
    minHeight: 56,
  },
  addOptionText: {
    color: palette.accent,
    fontSize: 16,
    ...font('semibold'),
  },
  multiSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.lg,
    minHeight: 60,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  multiSelectText: {
    color: '#ffffff',
    fontSize: 16,
    ...font('medium'),
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    minHeight: 54,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    ...font('semibold'),
  },
  createButton: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: radii.lg,
    backgroundColor: palette.accent,
    minHeight: 54,
  },
  createButtonDisabled: {
    opacity: 0.4,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    ...font('bold'),
  },
});

export default CreatePollSheet;
