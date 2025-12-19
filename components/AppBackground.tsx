import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/designSystem';

export const AppBackground: React.FC = () => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={theme.gradients.background}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.orbPrimary} />
      <View style={styles.orbSecondary} />
      <View style={styles.orbGlow} />
      <View style={styles.fadeBottom} />
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    orbPrimary: {
      position: 'absolute',
      top: -160,
      left: -120,
      width: 360,
      height: 360,
      borderRadius: 200,
      backgroundColor: theme.palette.accentSoft,
      opacity: theme.isDark ? 0.5 : 0.32,
    },
    orbSecondary: {
      position: 'absolute',
      bottom: -180,
      right: -80,
      width: 280,
      height: 280,
      borderRadius: 180,
      backgroundColor: theme.palette.surfaceStrong,
      opacity: theme.isDark ? 0.4 : 0.55,
    },
    orbGlow: {
      position: 'absolute',
      top: '35%',
      left: '55%',
      width: 180,
      height: 180,
      borderRadius: 120,
      backgroundColor: theme.palette.accentStrong,
      opacity: theme.isDark ? 0.18 : 0.12,
    },
    fadeBottom: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 160,
      backgroundColor: theme.palette.background,
      opacity: theme.isDark ? 0.85 : 0.55,
    },
  });

export default AppBackground;
