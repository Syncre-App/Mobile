import React, { useMemo } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { font, spacing, useTheme } from '../theme/designSystem';

type FieldProps = TextInputProps & {
  label?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

export const Field: React.FC<FieldProps> = ({
  label,
  leading,
  trailing,
  containerStyle,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <LinearGradient
        colors={theme.gradients.glassStroke}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.border}
      >
        <View style={styles.inner}>
          {leading ? <View style={styles.icon}>{leading}</View> : null}
          <TextInput
            style={[styles.input, style]}
            placeholderTextColor={theme.palette.textSubtle}
            selectionColor={theme.palette.accent}
            {...props}
          />
          {trailing ? <View style={styles.icon}>{trailing}</View> : null}
        </View>
      </LinearGradient>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    label: {
      color: theme.palette.textSubtle,
      fontSize: 12,
      marginBottom: spacing.xs,
      ...font('displayMedium'),
      letterSpacing: 2.5,
      textTransform: 'uppercase',
    },
    border: {
      borderRadius: theme.radii.lg,
      padding: theme.tokens.glass.borderWidth,
    },
    inner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.palette.surfaceSoft,
      borderRadius: theme.radii.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      color: theme.palette.text,
      fontSize: 15,
      ...font('regular'),
      paddingVertical: 0,
    },
    icon: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export default Field;
