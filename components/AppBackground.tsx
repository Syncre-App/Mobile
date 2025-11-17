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
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <GlowLayer
        cx="20%"
        cy="12%"
        r="60%"
        start="rgba(59, 130, 246, 0.25)"
        style={styles.glow}
      />

      <GlowLayer
        cx="80%"
        cy="8%"
        r="55%"
        start="rgba(14, 165, 233, 0.2)"
        style={styles.glow}
      />

      <GlowLayer
        cx="50%"
        cy="95%"
        r="65%"
        start="rgba(99, 102, 241, 0.18)"
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
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  noiseOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.08,
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
  },
  bottomShine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -120,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
    shadowColor: 'rgba(148, 163, 184, 0.55)',
    shadowOpacity: 0.35,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
});
