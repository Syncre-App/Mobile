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
          blurAmount={Math.min(intensity / 5, 25)}
          reducedTransparencyFallbackColor="rgba(15, 23, 42, 0.9)"
        />
        <View style={styles.content}>
          {children}
        </View>
      </View>
    );
  }

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

export const BlurPresets = {
  card: { intensity: 40, tint: 'dark' as const },
  modal: { intensity: 60, tint: 'dark' as const },
  overlay: { intensity: 80, tint: 'dark' as const },
  navigation: { intensity: 50, tint: 'dark' as const },
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
