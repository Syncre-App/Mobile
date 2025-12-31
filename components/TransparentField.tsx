import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  KeyboardTypeOptions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { font, gradients, palette, radii, spacing } from '../theme/designSystem';
import { canUseSwiftUI } from '../utils/swiftUi';

// SwiftUI components for iOS
let SwiftUIHost: any = null;
let SwiftUITextField: any = null;
let SwiftUISecureField: any = null;

if (Platform.OS === 'ios') {
  try {
    const swiftUI = require('@expo/ui/swift-ui');
    SwiftUIHost = swiftUI.Host;
    SwiftUITextField = swiftUI.TextField;
    SwiftUISecureField = swiftUI.SecureField;
  } catch (e) {
    console.warn('SwiftUI TextField not available:', e);
  }
}

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
  const shouldUseSwiftUI = canUseSwiftUI();
  // iOS: Try SwiftUI TextField/SecureField
  if (shouldUseSwiftUI && SwiftUIHost && (SwiftUITextField || SwiftUISecureField)) {
    const FieldComponent = secureTextEntry ? SwiftUISecureField : SwiftUITextField;
    
    if (FieldComponent) {
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
              <View style={styles.swiftUIFieldContainer}>
                <SwiftUIHost style={styles.swiftUIHost}>
                  <FieldComponent
                    placeholder={placeholder || ''}
                    text={value}
                    onChangeText={onChangeText}
                  />
                </SwiftUIHost>
              </View>
              {suffixIcon && (
                <TouchableOpacity onPress={onSuffixPress} style={styles.suffixIcon}>
                  {suffixIcon}
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>
        </View>
      );
    }
  }

  // Fallback: React Native TextInput
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
  swiftUIFieldContainer: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  swiftUIHost: {
    flex: 1,
  },
  prefixIcon: {
    marginRight: spacing.sm,
  },
  suffixIcon: {
    marginLeft: spacing.sm,
  },
});
