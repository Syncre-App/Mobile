import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { gradients, palette } from '../theme/designSystem';

interface GlowProps {
  cx: string;
  cy: string;
  r: string;
  start: string;
  end?: string;
  opacity?: number;
  style?: ViewStyle;
}

const GlowLayer: React.FC<GlowProps> = ({
  cx,
  cy,
  r,
  start,
  end = 'transparent',
  opacity = 1,
  style,
}) => (
  <Svg style={[styles.glowLayer, style]} pointerEvents="none">
    <Defs>
      <RadialGradient id="glow" cx={cx} cy={cy} r={r}>
        <Stop offset="0" stopColor={start} stopOpacity={opacity} />
        <Stop offset="1" stopColor={end} stopOpacity={0} />
      </RadialGradient>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
  </Svg>
);

export const AppBackground: React.FC = () => {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={gradients.backgroundBase}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <GlowLayer
        cx="20%"
        cy="12%"
        r="60%"
        start="rgba(37, 99, 235, 0.55)"
        style={styles.glow}
      />

      <GlowLayer
        cx="80%"
        cy="8%"
        r="55%"
        start="rgba(14, 165, 233, 0.45)"
        style={styles.glow}
      />

      <GlowLayer
        cx="50%"
        cy="95%"
        r="65%"
        start="rgba(99, 102, 241, 0.4)"
        style={styles.glow}
      />

      <View style={styles.vignette} />
      <View style={styles.noiseOverlay} />
      <View style={styles.bottomShine} />
    </View>
  );
};

const styles = StyleSheet.create({
  glowLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  glow: {
    opacity: 0.95,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  noiseOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  bottomShine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -120,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    shadowColor: palette.accentSecondary,
    shadowOpacity: 0.25,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
});
