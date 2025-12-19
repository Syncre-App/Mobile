import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  KeyboardTypeOptions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { font, gradients, palette, radii, spacing } from '../theme/designSystem';

interface TransparentFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  style?: ViewStyle;
  onSuffixPress?: () => void;
  editable?: boolean;
}

export const TransparentField: React.FC<TransparentFieldProps> = ({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType,
  autoCapitalize,
  prefixIcon,
  suffixIcon,
  style,
  onSuffixPress,
  editable = true,
}) => {
  return (
    <View style={style}>
      <LinearGradient
        colors={gradients.cardStroke as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      >
        <View style={styles.container}>
          {prefixIcon && <View style={styles.prefixIcon}>{prefixIcon}</View>}
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={palette.textSubtle}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            selectionColor={palette.accent}
            editable={editable}
            selectTextOnFocus={editable}
          />
          {suffixIcon && (
            <TouchableOpacity onPress={onSuffixPress} style={styles.suffixIcon}>
              {suffixIcon}
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  gradientBorder: {
    borderRadius: radii.lg,
    padding: 1.4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  input: {
    flex: 1,
    color: palette.text,
    fontSize: 15,
    paddingVertical: spacing.sm,
    ...font('regular'),
  },
  prefixIcon: {
    marginRight: spacing.sm,
  },
  suffixIcon: {
    marginLeft: spacing.sm,
  },
});
