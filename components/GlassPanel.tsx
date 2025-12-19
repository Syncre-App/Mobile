import React, { useMemo } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/designSystem';
import { NativeBlur } from './NativeBlur';

type GlassPanelProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'card' | 'nav' | 'pill' | 'sheet';
  tintColor?: string;
  glassEffectStyle?: 'regular' | 'clear';
  isInteractive?: boolean;
  padding?: number;
};

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  style,
  variant = 'card',
  tintColor,
  glassEffectStyle = 'regular',
  isInteractive = false,
  padding,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme, variant, padding), [theme, variant, padding]);
  const useLiquid = Platform.OS === 'ios' && isLiquidGlassAvailable();

  return (
    <View style={[styles.container, style]}>
      {useLiquid ? (
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle={glassEffectStyle}
          tintColor={tintColor}
          isInteractive={isInteractive}
        />
      ) : (
        <NativeBlur intensity={theme.tokens.blur.card} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient
        colors={theme.gradients.glassStroke}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.stroke}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const createStyles = (
  theme: ReturnType<typeof useTheme>['theme'],
  variant: GlassPanelProps['variant'],
  padding?: number
) => {
  const radius = variant === 'pill' ? theme.radii.pill : variant === 'nav' ? theme.radii.lg : theme.radii.xl;
  const resolvedPadding =
    variant === 'nav' ? 12 : variant === 'sheet' ? 16 : variant === 'pill' ? 10 : 16;

  return StyleSheet.create({
    container: {
      borderRadius: radius,
      borderWidth: theme.tokens.glass.borderWidth,
      borderColor: theme.palette.border,
      overflow: 'hidden',
      backgroundColor: theme.palette.surface,
      ...theme.shadows.card,
    },
    stroke: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radius,
      opacity: 0.35,
    },
    content: {
      padding: padding ?? resolvedPadding,
    },
  });
};

export default GlassPanel;
