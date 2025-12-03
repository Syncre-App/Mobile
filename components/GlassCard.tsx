import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue, StyleProp, ColorValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
  const isHero = variant === 'hero';
  const isSubtle = variant === 'subtle';

  const borderColor = isHero
    ? 'rgba(59, 130, 246, 0.45)'
    : isSubtle
    ? 'rgba(255, 255, 255, 0.12)'
    : palette.border;

  const gradientColors: [ColorValue, ColorValue] = isHero
    ? ['rgba(37, 99, 235, 0.22)', 'rgba(99, 102, 241, 0.12)']
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
      <BlurView intensity={intensity} tint="dark" style={styles.blur}>
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
      </BlurView>
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
    shadowColor: '#1E2A78',
    shadowOpacity: 0.55,
    shadowRadius: 45,
    shadowOffset: { width: 0, height: 25 },
    elevation: 24,
  },
  subtleShadow: {
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
});
