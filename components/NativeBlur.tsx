import React from 'react';
import { Platform, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView as NativeBlurView } from '@react-native-community/blur';
import { md3Elevation } from '../theme/md3Theme';
import { canUseSwiftUI } from '../utils/swiftUi';

const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// SwiftUI components for iOS
let SwiftUIHost: any = null;
let SwiftUIRoundedRectangle: any = null;
let glassEffect: any = null;
let GlassEffectContainer: any = null;

if (isIOS) {
  try {
    const swiftUI = require('@expo/ui/swift-ui');
    SwiftUIHost = swiftUI.Host;
    SwiftUIRoundedRectangle = swiftUI.RoundedRectangle;
    GlassEffectContainer = swiftUI.GlassEffectContainer;
    const modifiers = require('@expo/ui/swift-ui/modifiers');
    glassEffect = modifiers.glassEffect;
  } catch (e) {
    console.warn('SwiftUI components not available:', e);
  }
}

interface NativeBlurProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Glass variant for iOS: 'regular', 'clear', or 'identity' */
  glassVariant?: 'regular' | 'clear' | 'identity';
  /** Whether the glass should be interactive (iOS) */
  isInteractive?: boolean;
  /** Corner radius for the blur container */
  cornerRadius?: number;
  /** MD3 elevation level for Android (0-5) */
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
}

const defaultTint: NativeBlurProps['tint'] = isIOS ? 'default' : 'dark';

export const NativeBlur: React.FC<NativeBlurProps> = ({
  intensity = 50,
  tint = defaultTint,
  style,
  children,
  glassVariant = 'regular',
  isInteractive = false,
  cornerRadius = 20,
  elevation = 2,
}) => {
  const shouldUseSwiftUI = canUseSwiftUI();
  const canUseGlassEffect = shouldUseSwiftUI && Number(Platform.Version) >= 26;
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
            borderRadius: cornerRadius,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  // iOS: Try SwiftUI GlassEffect first, fallback to native blur
  if (canUseGlassEffect && SwiftUIHost && SwiftUIRoundedRectangle && glassEffect && GlassEffectContainer) {
    return (
      <View style={[styles.container, { borderRadius: cornerRadius }, style]}>
        <SwiftUIHost style={StyleSheet.absoluteFillObject}>
          <GlassEffectContainer spacing={0}>
            <SwiftUIRoundedRectangle
              cornerRadius={cornerRadius}
              modifiers={[
                glassEffect({
                  glass: {
                    variant: glassVariant,
                    interactive: isInteractive,
                  },
                  shape: 'rectangle',
                }),
              ]}
            />
          </GlassEffectContainer>
        </SwiftUIHost>
        <View style={styles.content}>
          {children}
        </View>
      </View>
    );
  }

  // iOS Fallback: Traditional blur effect with @react-native-community/blur
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
    <View style={[styles.container, { borderRadius: cornerRadius }, style]}>
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
    glassVariant: 'regular' as const,
    elevation: 2 as const,
  },
  modal: { 
    intensity: isIOS ? 42 : 60, 
    tint: defaultTint,
    glassVariant: 'regular' as const,
    elevation: 4 as const,
  },
  overlay: { 
    intensity: isIOS ? 58 : 80, 
    tint: defaultTint,
    glassVariant: 'clear' as const,
    elevation: 5 as const,
  },
  navigation: { 
    intensity: isIOS ? 32 : 50, 
    tint: defaultTint,
    glassVariant: 'regular' as const,
    elevation: 3 as const,
  },
  toast: { 
    intensity: isIOS ? 36 : 55, 
    tint: defaultTint,
    glassVariant: 'clear' as const,
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
