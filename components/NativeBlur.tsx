import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView as ExpoBlurView } from 'expo-blur';
import { BlurView as NativeBlurView } from '@react-native-community/blur';
import { useTheme } from '../theme/designSystem';

type NativeBlurProps = {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

const isIOS = Platform.OS === 'ios';

const resolveBlurType = (tint: NativeBlurProps['tint']) => {
  if (tint === 'light') return 'ultraThinMaterialLight';
  if (tint === 'dark') return 'ultraThinMaterialDark';
  return 'ultraThinMaterial';
};

const resolveFallbackColor = (tint: NativeBlurProps['tint']) => {
  if (tint === 'light') return 'rgba(255, 255, 255, 0.75)';
  if (tint === 'dark') return 'rgba(14, 16, 22, 0.8)';
  return 'rgba(14, 16, 22, 0.75)';
};

export const NativeBlur: React.FC<NativeBlurProps> = ({
  intensity = 40,
  tint,
  style,
  children,
}) => {
  const { theme } = useTheme();
  const resolvedTint = tint ?? (theme.isDark ? 'dark' : 'light');

  if (isIOS) {
    return (
      <View style={[styles.container, style]}>
        <NativeBlurView
          style={StyleSheet.absoluteFillObject}
          blurType={resolveBlurType(resolvedTint)}
          blurAmount={Math.min(Math.round(intensity / 2), 28)}
          reducedTransparencyFallbackColor={resolveFallbackColor(resolvedTint)}
        />
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  return (
    <ExpoBlurView intensity={intensity} tint={resolvedTint} style={[styles.container, style]}>
      {children}
    </ExpoBlurView>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
});

export default NativeBlur;
