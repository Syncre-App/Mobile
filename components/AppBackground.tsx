import React from 'react';
import { StyleSheet, View } from 'react-native';
import { palette } from '../theme/designSystem';

export const AppBackground: React.FC = () => {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flat]} />;
};

const styles = StyleSheet.create({
  flat: {
    backgroundColor: palette.background,
  },
});
