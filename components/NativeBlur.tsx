import React from 'react';
import { Platform, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView as ExpoBlurView } from 'expo-blur';
import { BlurView as NativeBlurView } from '@react-native-community/blur';

interface NativeBlurProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Cross-platform blur component that uses native iOS blur on iOS
 * and falls back to expo-blur on Android.
 * 
 * iOS: Uses @react-native-community/blur for true native UIVisualEffectView
 * Android: Uses expo-blur which renders a blurred snapshot
 */
export const NativeBlur: React.FC<NativeBlurProps> = ({
  intensity = 50,
  tint = 'dark',
  style,
  children,
}) => {
  if (Platform.OS === 'ios') {
    // Map tint to native iOS blur types
    // iOS 26+ supports enhanced blur materials
    const blurType = tint === 'light' 
      ? 'light' 
      : tint === 'dark' 
        ? 'dark' 
        : 'regular';

    return (
      <View style={[styles.container, style]}>
        <NativeBlurView
          style={StyleSheet.absoluteFillObject}
          blurType={blurType}
          blurAmount={Math.min(intensity / 5, 25)} // Native blur uses 0-25 range
          reducedTransparencyFallbackColor="rgba(15, 23, 42, 0.9)"
        />
        <View style={styles.content}>
          {children}
        </View>
      </View>
    );
  }

  // Android fallback using expo-blur
  return (
    <ExpoBlurView
      intensity={intensity}
      tint={tint}
      style={[styles.container, style]}
    >
      {children}
    </ExpoBlurView>
  );
};

/**
 * Preset blur configurations for common UI patterns
 */
export const BlurPresets = {
  /** Light glass effect for cards */
  card: { intensity: 40, tint: 'dark' as const },
  /** Medium glass effect for modals */
  modal: { intensity: 60, tint: 'dark' as const },
  /** Heavy glass effect for overlays */
  overlay: { intensity: 80, tint: 'dark' as const },
  /** Subtle glass for navigation bars */
  navigation: { intensity: 50, tint: 'dark' as const },
  /** Toast notifications */
  toast: { intensity: 55, tint: 'dark' as const },
} as const;

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
});

export default NativeBlur;
