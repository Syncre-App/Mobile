import React, { useMemo } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { font, useTheme } from '../theme/designSystem';

type TextButtonProps = {
  title: string;
  onPress?: () => void;
  tone?: 'default' | 'muted' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export const TextButton: React.FC<TextButtonProps> = ({ title, onPress, tone = 'default', style }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const color =
    tone === 'danger' ? theme.palette.error : tone === 'muted' ? theme.palette.textMuted : theme.palette.accent;

  return (
    <Pressable onPress={onPress} style={style}>
      <Text style={[styles.text, { color }]}>{title}</Text>
    </Pressable>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    text: {
      fontSize: 14,
      ...font('semibold'),
    },
  });

export default TextButton;
