import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { GlassCard } from './GlassCard';

interface GlassySheetProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'subtle' | 'hero';
}

export const GlassySheet: React.FC<GlassySheetProps> = ({
  children,
  style,
  variant = 'default',
}) => {
  return (
    <GlassCard width="100%" padding={0} variant={variant} style={[styles.card, style]}>
      {children}
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    flex: 1,
  },
});

export default GlassySheet;
