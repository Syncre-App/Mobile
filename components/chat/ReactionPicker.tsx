import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { Layout } from '../../constants/layout';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '👏'];

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (reaction: string) => void;
  position?: { x: number; y: number };
}

export function ReactionPicker({
  visible,
  onClose,
  onSelect,
  position,
}: ReactionPickerProps) {
  const { colors } = useTheme();

  const handleSelect = (reaction: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(reaction);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: colors.surface,
              ...Layout.shadow.lg,
            },
            position && {
              position: 'absolute',
              top: position.y,
              left: position.x,
            },
          ]}
        >
          <View style={styles.reactions}>
            {REACTIONS.map((reaction, index) => (
              <TouchableOpacity
                key={index}
                style={styles.reactionButton}
                onPress={() => handleSelect(reaction)}
                activeOpacity={0.7}
              >
                <Text style={styles.reactionEmoji}>{reaction}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  container: {
    borderRadius: Layout.radius.xl,
    paddingVertical: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.md,
  },
  reactions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionButton: {
    padding: Layout.spacing.sm,
  },
  reactionEmoji: {
    fontSize: 28,
  },
});
