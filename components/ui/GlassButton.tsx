import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../../hooks/useTheme';
import { Layout } from '../../constants/layout';

interface GlassButtonProps {
  title: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function GlassButton({
  title,
  onPress,
  icon,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
}: GlassButtonProps) {
  const { colors, isDark } = useTheme();
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const isIOS = Platform.OS === 'ios';

  const getIconColor = () => {
    if (disabled) return colors.textTertiary;
    switch (variant) {
      case 'danger':
        return colors.error;
      case 'secondary':
        return colors.text;
      default:
        return colors.accent;
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.textTertiary;
    switch (variant) {
      case 'danger':
        return colors.error;
      case 'secondary':
        return colors.text;
      default:
        return colors.accent;
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { paddingVertical: 8, paddingHorizontal: 16 };
      case 'lg':
        return { paddingVertical: 16, paddingHorizontal: 28 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 20 };
    }
  };

  const content = (
    <View style={[styles.content, getSizeStyles()]}>
      {loading ? (
        <ActivityIndicator size="small" color={getIconColor()} />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={size === 'sm' ? 18 : size === 'lg' ? 24 : 20}
              color={getIconColor()}
              style={styles.icon}
            />
          )}
          <Text
            style={[
              styles.text,
              { color: getTextColor() },
              size === 'sm' && { fontSize: 14 },
              size === 'lg' && { fontSize: 18 },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </View>
  );

  const buttonStyles = [
    styles.button,
    fullWidth && styles.fullWidth,
  ];

  if (useGlass) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
        style={buttonStyles}
      >
        <GlassView style={styles.glassContainer} glassEffectStyle="regular">
          {content}
        </GlassView>
      </TouchableOpacity>
    );
  }

  if (isIOS) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
        style={buttonStyles}
      >
        <BlurView
          style={styles.blurContainer}
          tint={isDark ? 'dark' : 'light'}
          intensity={60}
        >
          {content}
        </BlurView>
      </TouchableOpacity>
    );
  }

  // Android fallback
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        buttonStyles,
        styles.androidContainer,
        { backgroundColor: colors.surface },
      ]}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  glassContainer: {
    borderRadius: Layout.radius.lg,
  },
  blurContainer: {
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
  },
  androidContainer: {
    borderRadius: Layout.radius.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: Layout.spacing.sm,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
