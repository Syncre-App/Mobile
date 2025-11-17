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
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flat]} />;
};

const styles = StyleSheet.create({
  flat: {
    backgroundColor: palette.background,
  },
});
