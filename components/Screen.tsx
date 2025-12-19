import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { AppBackground } from './AppBackground';
import { useTheme } from '../theme/designSystem';

type ScreenProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  withBackground?: boolean;
};

export const Screen: React.FC<ScreenProps> = ({
  children,
  style,
  edges = ['top', 'left', 'right'],
  withBackground = false,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={[styles.container, style]} edges={edges}>
      {withBackground ? <AppBackground /> : null}
      {children}
    </SafeAreaView>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.palette.background,
    },
  });

export default Screen;
