import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TouchableOpacityProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { Layout } from '../../constants/layout';

export interface IconButtonProps extends TouchableOpacityProps {
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  backgroundColor?: string;
  variant?: 'default' | 'filled' | 'outline';
  style?: ViewStyle;
}

export function IconButton({
  icon,
  size = 24,
  color,
  backgroundColor,
  variant = 'default',
  style,
  onPress,
  disabled,
  ...props
}: IconButtonProps) {
  const { colors } = useTheme();

  const handlePress = async (event: any) => {
    if (disabled) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(event);
  };

  const getBackgroundColor = () => {
    if (backgroundColor) return backgroundColor;
    switch (variant) {
      case 'filled':
        return colors.accent;
      case 'outline':
        return 'transparent';
      default:
        return 'transparent';
    }
  };

  const getIconColor = () => {
    if (color) return color;
    if (disabled) return colors.textSecondary;
    switch (variant) {
      case 'filled':
        return '#FFFFFF';
      default:
        return colors.text;
    }
  };

  const buttonSize = size + Layout.spacing.md * 2;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonSize / 2,
          backgroundColor: getBackgroundColor(),
          borderColor: variant === 'outline' ? colors.border : 'transparent',
          borderWidth: variant === 'outline' ? 1 : 0,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      {...props}
    >
      <Ionicons name={icon} size={size} color={getIconColor()} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
