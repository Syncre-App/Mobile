import React from 'react';
import { Platform, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView as ExpoBlurView } from 'expo-blur';
import { BlurView as NativeBlurView } from '@react-native-community/blur';

const isIOS = Platform.OS === 'ios';

interface NativeBlurProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const defaultTint: NativeBlurProps['tint'] = isIOS ? 'default' : 'dark';

export const NativeBlur: React.FC<NativeBlurProps> = ({
  intensity = 50,
  tint = defaultTint,
  style,
  children,
}) => {
  if (isIOS) {
    const blurType = tint === 'light'
      ? 'ultraThinMaterialLight'
      : tint === 'dark'
        ? 'ultraThinMaterialDark'
        : 'ultraThinMaterial';

    const fallbackColor = tint === 'light'
      ? 'rgba(255, 255, 255, 0.7)'
      : tint === 'dark'
        ? 'rgba(28, 28, 30, 0.8)'
        : 'rgba(28, 28, 30, 0.75)';

    return (
      <View style={[styles.container, style]}>
        <NativeBlurView
          style={StyleSheet.absoluteFillObject}
          blurType={blurType}
          blurAmount={Math.min(intensity / 5, 25)}
          reducedTransparencyFallbackColor={fallbackColor}
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
  card: { intensity: isIOS ? 28 : 40, tint: defaultTint },
  modal: { intensity: isIOS ? 42 : 60, tint: defaultTint },
  overlay: { intensity: isIOS ? 58 : 80, tint: defaultTint },
  navigation: { intensity: isIOS ? 32 : 50, tint: defaultTint },
  toast: { intensity: isIOS ? 36 : 55, tint: defaultTint },
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
