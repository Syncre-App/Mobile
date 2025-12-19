import React, { useMemo } from 'react';
import { ColorValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeBlur } from './NativeBlur';
import { useTheme } from '../theme/designSystem';

type GlassVariant = 'card' | 'nav' | 'sheet' | 'pill';

type GlassSurfaceProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  variant?: GlassVariant;
  tint?: 'light' | 'dark' | 'default';
};

export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  style,
  intensity,
  variant = 'card',
  tint,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const radius =
    variant === 'pill' ? theme.radii.pill : variant === 'nav' ? theme.radii.lg : theme.radii.xl;
  const blurIntensity =
    intensity ??
    (variant === 'nav'
      ? theme.tokens.blur.nav
      : variant === 'sheet'
      ? theme.tokens.blur.sheet
      : theme.tokens.blur.card);

  const strokeColors: [ColorValue, ColorValue] = theme.gradients.glassStroke;
  const surfaceColors: [ColorValue, ColorValue] = theme.gradients.surface;

  return (
    <View style={[styles.container, { borderRadius: radius }, style]}>
      <NativeBlur intensity={blurIntensity} tint={tint} style={[styles.blur, { borderRadius: radius }]}>
        <LinearGradient
          colors={surfaceColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.surface, { borderRadius: radius }]}
        >
          <LinearGradient
            colors={strokeColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.stroke, { borderRadius: radius }]}
          />
          {children}
        </LinearGradient>
      </NativeBlur>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      borderWidth: theme.tokens.glass.borderWidth,
      borderColor: theme.palette.border,
      backgroundColor: theme.palette.surface,
      overflow: 'hidden',
      ...theme.shadows.card,
    },
    blur: {
      flex: 1,
    },
    surface: {
      flex: 1,
      padding: 1,
    },
    stroke: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.35,
    },
  });

export default GlassSurface;
