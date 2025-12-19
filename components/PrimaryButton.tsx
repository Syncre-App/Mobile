import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { font, spacing, useTheme } from '../theme/designSystem';

type PrimaryButtonProps = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [styles.button, style, isDisabled && styles.disabled, pressed && styles.pressed]}
    >
      <LinearGradient colors={theme.gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
        {loading ? (
          <ActivityIndicator color={theme.palette.text} />
        ) : (
          <Text style={styles.title}>{title}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    button: {
      borderRadius: theme.radii.pill,
      overflow: 'hidden',
      shadowColor: theme.palette.accent,
      shadowOpacity: 0.3,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    fill: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      color: theme.palette.text,
      fontSize: 16,
      ...font('semibold'),
    },
    disabled: {
      opacity: 0.6,
    },
    pressed: {
      transform: [{ scale: 0.98 }],
    },
  });

export default PrimaryButton;
