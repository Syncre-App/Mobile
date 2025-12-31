import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue, StyleProp, ColorValue, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeBlur } from './NativeBlur';
import { gradients, palette, radii, shadows, tokens } from '../theme/designSystem';
import { md3Colors, getMd3CardStyle, type CardVariant } from '../theme/md3Theme';

const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// SwiftUI components for iOS
let SwiftUIHost: any = null;
let SwiftUIRoundedRectangle: any = null;
let glassEffect: any = null;
let GlassEffectContainer: any = null;
let padding: any = null;

if (isIOS) {
  try {
    const swiftUI = require('@expo/ui/swift-ui');
    SwiftUIHost = swiftUI.Host;
    SwiftUIRoundedRectangle = swiftUI.RoundedRectangle;
    GlassEffectContainer = swiftUI.GlassEffectContainer;
    const modifiers = require('@expo/ui/swift-ui/modifiers');
    glassEffect = modifiers.glassEffect;
    padding = modifiers.padding;
  } catch (e) {
    console.warn('SwiftUI components not available:', e);
  }
}

interface GlassCardProps {
  children: ReactNode;
  width?: DimensionValue;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  variant?: CardVariant;
  padding?: number;
  /** Whether the glass should be interactive (iOS) */
  isInteractive?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  width = 360,
  style,
  intensity = tokens.blur.card,
  variant = 'default',
  padding: paddingValue = 20,
  isInteractive = false,
}) => {
  const isHero = variant === 'hero';
  const isSubtle = variant === 'subtle';

  // ═══════════════════════════════════════════════════════════════
  // ANDROID: Material Design 3 Card
  // ═══════════════════════════════════════════════════════════════
  if (isAndroid) {
    const md3Style = getMd3CardStyle(variant);
    
    return (
      <View
        style={[
          styles.md3Container,
          md3Style,
          { width },
          style,
        ]}
      >
        <View style={[styles.md3Content, { padding: paddingValue }]}>
          {children}
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // iOS: Try SwiftUI GlassEffect first
  // ═══════════════════════════════════════════════════════════════
  if (SwiftUIHost && SwiftUIRoundedRectangle && glassEffect && GlassEffectContainer) {
    const glassVariant = isSubtle ? 'clear' : 'regular';
    const tintColor = isHero ? palette.accent : undefined;
    
    return (
      <View
        style={[
          styles.swiftUIContainer,
          isHero && styles.heroShadow,
          isSubtle && styles.subtleShadow,
          { width },
          style,
        ]}
      >
        <GlassEffectContainer spacing={0}>
          <SwiftUIHost style={StyleSheet.absoluteFillObject}>
            <SwiftUIRoundedRectangle
              cornerRadius={radii.xl}
              modifiers={[
                glassEffect({
                  glass: {
                    variant: glassVariant,
                    interactive: isInteractive,
                    tint: tintColor,
                  },
                  shape: 'rectangle',
                }),
              ]}
            />
          </SwiftUIHost>
        </GlassEffectContainer>
        <View style={[styles.swiftUIContent, { padding: paddingValue }]}>
          {children}
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // iOS Fallback: Traditional Blur + Gradient
  // ═══════════════════════════════════════════════════════════════
  const borderColor = isHero
    ? 'rgba(10, 132, 255, 0.4)'
    : isSubtle
      ? 'rgba(255, 255, 255, 0.12)'
      : palette.border;

  const gradientColors: [ColorValue, ColorValue] = isHero
    ? ['rgba(10, 132, 255, 0.22)', 'rgba(94, 92, 230, 0.12)']
    : ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)'];

  return (
    <View
      style={[
        styles.container,
        isHero && styles.heroShadow,
        isSubtle && styles.subtleShadow,
        { width, borderColor },
        style,
      ]}
    >
      <NativeBlur intensity={intensity} tint="default" style={styles.blur}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { padding: paddingValue }]}
        >
          <LinearGradient
            colors={gradients.cardStroke as [ColorValue, ColorValue, ...ColorValue[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.strokeOverlay}
          />
          {children}
        </LinearGradient>
      </NativeBlur>
    </View>
  );
};

const styles = StyleSheet.create({
  // iOS fallback styles (blur + gradient)
  container: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1.2,
    backgroundColor: palette.surface,
    ...shadows.card,
  },
  blur: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
  },
  strokeOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },

  // iOS SwiftUI styles
  swiftUIContainer: {
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  swiftUIContent: {
    flex: 1,
    justifyContent: 'center',
  },

  // MD3 Android styles
  md3Container: {
    overflow: 'hidden',
  },
  md3Content: {
    flex: 1,
    justifyContent: 'center',
  },

  // Shared shadow styles
  heroShadow: {
    shadowColor: isIOS ? '#0A84FF' : md3Colors.shadow,
    shadowOpacity: isIOS ? 0.45 : 0.3,
    shadowRadius: isIOS ? 40 : 8,
    shadowOffset: { width: 0, height: isIOS ? 22 : 4 },
    elevation: isIOS ? 20 : 8,
  },
  subtleShadow: {
    shadowColor: isIOS ? '#0B0E14' : md3Colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: isIOS ? 12 : 4,
    shadowOffset: { width: 0, height: isIOS ? 8 : 2 },
    elevation: isIOS ? 8 : 4,
  },
});

export default GlassCard;
