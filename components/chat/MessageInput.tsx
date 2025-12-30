import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../hooks/useTheme';
import { Layout } from '../../constants/layout';

interface MessageInputProps {
  onSend: (message: string, attachments?: string[]) => void;
  onTyping?: (isTyping: boolean) => void;
  onAttachmentPress?: () => void;
  replyTo?: { id: number; name: string; preview: string } | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  onTyping,
  onAttachmentPress,
  replyTo,
  onCancelReply,
  disabled = false,
  placeholder = 'Message',
}: MessageInputProps) {
  const { colors } = useTheme();
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleTextChange = (text: string) => {
    setMessage(text);

    // Handle typing indicator
    if (onTyping) {
      onTyping(true);
      
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
      
      typingTimeout.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  };

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage && attachments.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(trimmedMessage, attachments.length > 0 ? attachments : undefined);
    setMessage('');
    setAttachments([]);
    
    if (onTyping) {
      onTyping(false);
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
    }
  };

  const handleAttachment = async () => {
    if (onAttachmentPress) {
      onAttachmentPress();
      return;
    }

    // Default: open image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const uris = result.assets.map(asset => asset.uri);
      setAttachments(prev => [...prev, ...uris]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const canSend = message.trim().length > 0 || attachments.length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Reply Preview */}
      {replyTo && (
        <View style={[styles.replyContainer, { backgroundColor: colors.surface }]}>
          <View style={[styles.replyBar, { backgroundColor: colors.accent }]} />
          <View style={styles.replyContent}>
            <Text style={[styles.replyName, { color: colors.accent }]}>
              Replying to {replyTo.name}
            </Text>
            <Text style={[styles.replyText, { color: colors.textSecondary }]} numberOfLines={1}>
              {replyTo.preview}
            </Text>
          </View>
          <TouchableOpacity onPress={onCancelReply} style={styles.cancelReply}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <View style={[styles.attachmentsPreview, { backgroundColor: colors.surface }]}>
          {attachments.map((uri, index) => (
            <View key={index} style={styles.attachmentItem}>
              <Image source={{ uri }} style={styles.attachmentThumb} />
              <TouchableOpacity
                style={[styles.removeAttachment, { backgroundColor: colors.error }]}
                onPress={() => removeAttachment(index)}
              >
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Input Bar */}
      <View style={[styles.container, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={handleAttachment}
          disabled={disabled}
        >
          <Ionicons
            name="add-circle-outline"
            size={28}
            color={disabled ? colors.textTertiary : colors.accent}
          />
        </TouchableOpacity>

        <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground }]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.text }]}
            placeholder={placeholder}
            placeholderTextColor={colors.inputPlaceholder}
            value={message}
            onChangeText={handleTextChange}
            multiline
            maxLength={4000}
            editable={!disabled}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.sendButton,
            canSend && { backgroundColor: colors.accent },
          ]}
          onPress={handleSend}
          disabled={!canSend || disabled}
        >
          <Ionicons
            name="arrow-up"
            size={20}
            color={canSend ? '#FFFFFF' : colors.textTertiary}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical: Layout.spacing.sm,
    borderTopWidth: 0.5,
  },
  attachButton: {
    padding: Layout.spacing.xs,
    marginBottom: 4,
  },
  inputContainer: {
    flex: 1,
    borderRadius: Layout.chatInput.borderRadius,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Platform.OS === 'ios' ? Layout.spacing.sm : 0,
    marginHorizontal: Layout.spacing.xs,
    minHeight: Layout.chatInput.minHeight,
    maxHeight: Layout.chatInput.maxHeight,
    justifyContent: 'center',
  },
  input: {
    fontSize: Layout.fontSize.md,
    lineHeight: 20,
    maxHeight: Layout.chatInput.maxHeight - Layout.spacing.md,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  replyBar: {
    width: 3,
    height: '100%',
    borderRadius: 2,
    marginRight: Layout.spacing.sm,
  },
  replyContent: {
    flex: 1,
  },
  replyName: {
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
  },
  replyText: {
    fontSize: Layout.fontSize.sm,
  },
  cancelReply: {
    padding: Layout.spacing.xs,
  },
  attachmentsPreview: {
    flexDirection: 'row',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  attachmentItem: {
    position: 'relative',
    marginRight: Layout.spacing.sm,
  },
  attachmentThumb: {
    width: 60,
    height: 60,
    borderRadius: Layout.radius.sm,
  },
  removeAttachment: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
