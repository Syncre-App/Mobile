import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Layout } from '../../constants/layout';

export interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
  fullScreen?: boolean;
  style?: ViewStyle;
}

export function LoadingSpinner({
  size = 'large',
  color,
  message,
  fullScreen = false,
  style,
}: LoadingSpinnerProps) {
  const { colors } = useTheme();
  const spinnerColor = color || colors.accent;

  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, { backgroundColor: colors.background }, style]}>
        <ActivityIndicator size={size} color={spinnerColor} />
        {message && (
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {message}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={spinnerColor} />
      {message && (
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Layout.spacing.lg,
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    marginTop: Layout.spacing.md,
    fontSize: Layout.fontSize.md,
  },
});
