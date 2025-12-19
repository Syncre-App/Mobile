import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue, StyleProp, ColorValue, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeBlur } from './NativeBlur';
import { gradients, palette, radii, shadows, tokens } from '../theme/designSystem';

interface GlassCardProps {
  children: ReactNode;
  width?: DimensionValue;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  variant?: 'default' | 'hero' | 'subtle';
  padding?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  width = 360,
  style,
  intensity = tokens.blur.card,
  variant = 'default',
  padding = 20,
}) => {
  const isIOS = Platform.OS === 'ios';
  const isHero = variant === 'hero';
  const isSubtle = variant === 'subtle';

  const borderColor = isHero
    ? isIOS
      ? 'rgba(10, 132, 255, 0.4)'
      : 'rgba(255, 255, 255, 0.28)'
    : isSubtle
    ? 'rgba(255, 255, 255, 0.12)'
    : palette.border;

  const gradientColors: [ColorValue, ColorValue] = isHero
    ? isIOS
      ? ['rgba(10, 132, 255, 0.22)', 'rgba(94, 92, 230, 0.12)']
      : ['rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.06)']
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
      <NativeBlur intensity={intensity} tint={isIOS ? 'default' : 'dark'} style={styles.blur}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { padding }]}
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
  heroShadow: {
    shadowColor: Platform.OS === 'ios' ? '#0A84FF' : '#000000',
    shadowOpacity: Platform.OS === 'ios' ? 0.45 : 0.3,
    shadowRadius: Platform.OS === 'ios' ? 40 : 24,
    shadowOffset: { width: 0, height: Platform.OS === 'ios' ? 22 : 16 },
    elevation: Platform.OS === 'ios' ? 20 : 16,
  },
  subtleShadow: {
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
});
