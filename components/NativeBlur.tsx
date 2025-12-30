import React from 'react';
import { Platform, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView as ExpoBlurView } from 'expo-blur';
import { BlurView as NativeBlurView } from '@react-native-community/blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { md3Colors, md3Elevation } from '../theme/md3Theme';

const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Cache the liquid glass availability check
let _liquidGlassAvailable: boolean | null = null;
const checkLiquidGlass = (): boolean => {
  if (_liquidGlassAvailable === null) {
    try {
      _liquidGlassAvailable = isLiquidGlassAvailable();
    } catch {
      _liquidGlassAvailable = false;
    }
  }
  return _liquidGlassAvailable;
};

interface NativeBlurProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** For iOS 26+ GlassView: 'regular' or 'clear' */
  glassStyle?: 'regular' | 'clear';
  /** For iOS 26+ GlassView: whether the glass should be interactive */
  isInteractive?: boolean;
  /** MD3 elevation level for Android (0-5) */
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
}

const defaultTint: NativeBlurProps['tint'] = isIOS ? 'default' : 'dark';

export const NativeBlur: React.FC<NativeBlurProps> = ({
  intensity = 50,
  tint = defaultTint,
  style,
  children,
  glassStyle = 'regular',
  isInteractive = false,
  elevation = 2,
}) => {
  // Android: Material Design 3 Surface
  if (isAndroid) {
    const elevationStyle = md3Elevation[`level${elevation}`];
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: elevationStyle.backgroundColor,
            elevation: elevationStyle.elevation,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  // iOS 26+: Native Liquid Glass
  if (checkLiquidGlass()) {
    return (
      <GlassView
        style={[styles.container, style]}
        glassEffectStyle={glassStyle}
        isInteractive={isInteractive}
      >
        <View style={styles.content}>
          {children}
        </View>
      </GlassView>
    );
  }

  // iOS < 26: Traditional blur effect
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
};

export const BlurPresets = {
  card: { 
    intensity: isIOS ? 28 : 40, 
    tint: defaultTint,
    glassStyle: 'regular' as const,
    elevation: 2 as const,
  },
  modal: { 
    intensity: isIOS ? 42 : 60, 
    tint: defaultTint,
    glassStyle: 'regular' as const,
    elevation: 4 as const,
  },
  overlay: { 
    intensity: isIOS ? 58 : 80, 
    tint: defaultTint,
    glassStyle: 'clear' as const,
    elevation: 5 as const,
  },
  navigation: { 
    intensity: isIOS ? 32 : 50, 
    tint: defaultTint,
    glassStyle: 'regular' as const,
    elevation: 3 as const,
  },
  toast: { 
    intensity: isIOS ? 36 : 55, 
    tint: defaultTint,
    glassStyle: 'clear' as const,
    elevation: 3 as const,
  },
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
