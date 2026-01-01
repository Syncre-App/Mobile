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
let SwiftUIVStack: any = null;
let SwiftUIHStack: any = null;
let SwiftUIText: any = null;
let SwiftUIButton: any = null;
let SwiftUIImage: any = null;
let SwiftUITextField: any = null;
let SwiftUISwitch: any = null;
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
    SwiftUITextField = swiftUI.TextField;
    SwiftUISwitch = swiftUI.Switch;
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
    SwiftUITextField &&
    SwiftUISwitch &&
    SwiftUISpacer &&
    swiftUIBackground &&
    swiftUICornerRadius &&
    swiftUIBorder &&
    swiftUIPadding &&
    swiftUIShadow &&
    swiftUIFrame;
  const optionIdRef = useRef(0);
  const buildOption = useCallback((): PollOption => {
    const id = optionIdRef.current;
    optionIdRef.current += 1;
    return { id: `option-${id}`, text: '' };
  }, []);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<PollOption[]>(() => [buildOption(), buildOption()]);
  const [multiSelect, setMultiSelect] = useState(false);
  const [formKey, setFormKey] = useState(0);
  
  const resetForm = useCallback(() => {
    optionIdRef.current = 0;
    setQuestion('');
    setOptions([buildOption(), buildOption()]);
    setMultiSelect(false);
    setFormKey((key) => key + 1);
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

  const SheetContent = () => (
    <View style={styles.cardContainer}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="stats-chart" size={18} color={palette.accent} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Create poll</Text>
            <Text style={styles.subtitle}>Ask a question and collect votes</Text>
          </View>
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
            <View key={option.id} style={styles.optionRow}>
              <View style={styles.optionNumber}>
                <Text style={styles.optionNumberText}>{index + 1}</Text>
              </View>
              <TextInput
                style={styles.optionInput}
                value={option.text}
                onChangeText={(text) => handleOptionChange(option.id, text)}
                placeholder={`${index + 1}. option`}
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                maxLength={MAX_OPTION_LENGTH}
              />
              {options.length > MIN_OPTIONS && (
                <Pressable
                  onPress={() => handleRemoveOption(option.id)}
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
          presentationDetents={['medium', 'large']}
          presentationDragIndicator="visible"
        >
          <SwiftUIVStack
            alignment="center"
            spacing={12}
            modifiers={[swiftUIPadding({ horizontal: spacing.lg, vertical: spacing.md })]}
          >
            <SwiftUIVStack
              key={`poll-sheet-${formKey}`}
              alignment="leading"
              spacing={12}
              modifiers={[
                swiftUIPadding({ horizontal: spacing.lg, vertical: spacing.lg }),
                swiftUIBackground('rgba(15, 23, 42, 0.9)'),
                swiftUICornerRadius(22),
                swiftUIBorder({ color: 'rgba(255, 255, 255, 0.12)', width: 1 }),
                swiftUIShadow({ radius: 18, y: 10, color: 'rgba(0, 0, 0, 0.35)' }),
                swiftUIFrame({ maxWidth: 440 }),
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
                  <SwiftUIImage systemName="chart.bar" size={16} color={palette.accent} />
                </SwiftUIVStack>
                <SwiftUIVStack alignment="leading" spacing={2}>
                  <SwiftUIText size={17} weight="semibold" color={palette.text}>
                    Create poll
                  </SwiftUIText>
                  <SwiftUIText size={12} color={palette.textMuted}>
                    Ask a question and collect votes
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

              <SwiftUIText size={12} color={palette.textMuted}>
                Question
              </SwiftUIText>
              <SwiftUITextField
                key={`poll-question-${formKey}`}
                defaultValue={question}
                placeholder="What's the question?"
                multiline
                numberOfLines={3}
                onChangeText={(text: string) =>
                  setQuestion(text.slice(0, MAX_QUESTION_LENGTH))
                }
                modifiers={[
                  swiftUIPadding({ horizontal: 12, vertical: 10 }),
                  swiftUIBackground('rgba(255, 255, 255, 0.08)'),
                  swiftUICornerRadius(12),
                  swiftUIBorder({ color: 'rgba(255, 255, 255, 0.1)', width: 1 }),
                ]}
              />
              <SwiftUIText size={11} color={palette.textMuted}>
                {question.length}/{MAX_QUESTION_LENGTH}
              </SwiftUIText>

              <SwiftUIText size={12} color={palette.textMuted}>
                Options
              </SwiftUIText>
              <SwiftUIVStack alignment="leading" spacing={8}>
                {options.map((option, index) => (
                  <SwiftUIHStack key={option.id} alignment="center" spacing={8}>
                    <SwiftUIVStack
                      modifiers={[
                        swiftUIFrame({ width: 24, height: 24 }),
                        swiftUIBackground('rgba(37, 99, 235, 0.2)'),
                        swiftUICornerRadius(12),
                      ]}
                    >
                      <SwiftUIText size={11} weight="semibold" color={palette.accent}>
                        {String(index + 1)}
                      </SwiftUIText>
                    </SwiftUIVStack>
                    <SwiftUITextField
                      defaultValue={option.text}
                      placeholder={`${index + 1}. option`}
                      onChangeText={(text: string) => handleOptionChange(option.id, text)}
                      modifiers={[
                        swiftUIFrame({ maxWidth: 260, alignment: 'leading' }),
                        swiftUIPadding({ horizontal: 10, vertical: 8 }),
                        swiftUIBackground('rgba(255, 255, 255, 0.08)'),
                        swiftUICornerRadius(12),
                        swiftUIBorder({ color: 'rgba(255, 255, 255, 0.1)', width: 1 }),
                      ]}
                    />
                    {options.length > MIN_OPTIONS ? (
                      <SwiftUIButton
                        onPress={() => handleRemoveOption(option.id)}
                        variant="borderless"
                        modifiers={[
                          swiftUIFrame({ width: 28, height: 28 }),
                          swiftUIBackground('rgba(239, 68, 68, 0.12)'),
                          swiftUICornerRadius(14),
                        ]}
                      >
                        <SwiftUIImage systemName="xmark.circle.fill" size={16} color="#EF4444" />
                      </SwiftUIButton>
                    ) : null}
                  </SwiftUIHStack>
                ))}
              </SwiftUIVStack>

              {options.length < MAX_OPTIONS ? (
                <SwiftUIButton
                  onPress={handleAddOption}
                  variant="borderless"
                  modifiers={[
                    swiftUIPadding({ horizontal: 12, vertical: 10 }),
                    swiftUIBackground('rgba(37, 99, 235, 0.15)'),
                    swiftUICornerRadius(14),
                    swiftUIBorder({ color: 'rgba(37, 99, 235, 0.3)', width: 1 }),
                  ]}
                >
                  <SwiftUIHStack alignment="center" spacing={8}>
                    <SwiftUIImage systemName="plus.circle" size={16} color={palette.accent} />
                    <SwiftUIText size={13} weight="medium" color={palette.accent}>
                      Add option
                    </SwiftUIText>
                  </SwiftUIHStack>
                </SwiftUIButton>
              ) : null}

              <SwiftUIHStack alignment="center" spacing={10}>
                <SwiftUIText size={13} color={palette.text}>
                  Allow multiple answers
                </SwiftUIText>
                <SwiftUISpacer />
                <SwiftUISwitch
                  value={multiSelect}
                  onValueChange={(value: boolean) => setMultiSelect(value)}
                  color={palette.accent}
                />
              </SwiftUIHStack>

              <SwiftUIHStack spacing={10}>
                <SwiftUIButton
                  onPress={handleClose}
                  variant="borderless"
                  modifiers={[
                    swiftUIPadding({ horizontal: 14, vertical: 10 }),
                    swiftUIBackground('rgba(255, 255, 255, 0.08)'),
                    swiftUICornerRadius(12),
                    swiftUIFrame({ maxWidth: 160 }),
                  ]}
                >
                  <SwiftUIText size={13} weight="medium" color={palette.textMuted}>
                    Cancel
                  </SwiftUIText>
                </SwiftUIButton>
                <SwiftUIButton
                  onPress={handleCreate}
                  disabled={!isValid || isCreating}
                  variant="borderless"
                  modifiers={[
                    swiftUIPadding({ horizontal: 14, vertical: 10 }),
                    swiftUIBackground(
                      isValid && !isCreating ? palette.accent : 'rgba(59, 130, 246, 0.4)'
                    ),
                    swiftUICornerRadius(12),
                    swiftUIFrame({ maxWidth: 180 }),
                  ]}
                >
                  <SwiftUIText size={13} weight="semibold" color="#ffffff">
                    {isCreating ? 'Creating...' : 'Create'}
                  </SwiftUIText>
                </SwiftUIButton>
              </SwiftUIHStack>
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <SheetContent />
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
  sheetContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    padding: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 7, 18, 0.65)',
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
    maxHeight: 560,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
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
  scrollContent: {
    padding: spacing.md,
    maxHeight: 360,
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
