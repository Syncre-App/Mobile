import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { Host, Button as SwiftUIButton } from '@expo/ui/swift-ui';
import { useTheme } from '../../hooks/useTheme';
import { secureStorage } from '../../services/storage/secure';
import { Layout } from '../../constants/layout';
import { APP_CONFIG } from '../../constants/config';

/**
 * PIN Setup Screen
 * 
 * This screen is shown after login when no PIN exists.
 * The E2EE identity key is already set up with the password during login.
 * This PIN is only for local quick unlock (lock screen).
 */
export default function PinSetupScreen() {
  const { colors } = useTheme();

  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [step]);

  const hashPin = async (pinCode: string): Promise<string> => {
    // Use a fixed salt for PIN - this is just for local lock screen
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pinCode + 'syncre_pin_salt'
    );
    return hash;
  };

  const handlePinChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, APP_CONFIG.PIN_MAX_LENGTH);
    
    if (step === 'create') {
      setPin(digits);
      setError('');
    } else {
      setConfirmPin(digits);
      setError('');
      
      // Auto-verify when confirm PIN matches created PIN length
      if (digits.length === pin.length) {
        verifyAndSave(digits);
      }
    }
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('confirm');
    setConfirmPin('');
  };

  const verifyAndSave = async (confirmedPin: string) => {
    if (confirmedPin !== pin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('PINs do not match. Try again.');
      setConfirmPin('');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Hash and store PIN locally
      const pinHash = await hashPin(pin);
      await secureStorage.setPinHash(pinHash);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Navigate to main app
      router.replace('/(app)/(tabs)');
    } catch (err: any) {
      console.error('PIN setup error:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.message || 'Failed to setup PIN. Please try again.');
      setStep('create');
      setPin('');
      setConfirmPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('create');
      setConfirmPin('');
      setError('');
    }
  };

  const handleSkip = () => {
    // Allow skipping PIN setup
    router.replace('/(app)/(tabs)');
  };

  const currentPin = step === 'create' ? pin : confirmPin;
  const dotsCount = step === 'create' ? APP_CONFIG.PIN_MAX_LENGTH : pin.length;
  const canContinue = step === 'create' && pin.length >= APP_CONFIG.PIN_MIN_LENGTH;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.content} onPress={() => inputRef.current?.focus()}>
          {/* Header */}
          <View style={styles.header}>
            {step === 'confirm' && (
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
            <View style={[styles.iconContainer, { backgroundColor: colors.accent + '15' }]}>
              <Ionicons name="keypad" size={48} color={colors.accent} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              {step === 'create' ? 'Create PIN' : 'Confirm PIN'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {step === 'create'
                ? `Enter a ${APP_CONFIG.PIN_MIN_LENGTH}-${APP_CONFIG.PIN_MAX_LENGTH} digit PIN for quick unlock`
                : 'Enter your PIN again to confirm'}
            </Text>
          </View>

          {/* PIN Dots */}
          <View style={styles.pinContainer}>
            <View style={styles.pinDots}>
              {Array.from({ length: dotsCount }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.pinDot,
                    {
                      backgroundColor: index < currentPin.length ? colors.accent : 'transparent',
                      borderColor: error ? colors.error : colors.border,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Hidden input */}
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              value={currentPin}
              onChangeText={handlePinChange}
              keyboardType="number-pad"
              maxLength={APP_CONFIG.PIN_MAX_LENGTH}
              autoFocus
              secureTextEntry
              caretHidden
            />
          </View>

          {/* PIN length indicator in create step */}
          {step === 'create' && pin.length > 0 && (
            <Text style={[styles.lengthIndicator, { color: colors.textSecondary }]}>
              {pin.length} / {APP_CONFIG.PIN_MIN_LENGTH}-{APP_CONFIG.PIN_MAX_LENGTH} digits
            </Text>
          )}

          {/* Error */}
          {error ? (
            <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
          ) : null}

          {/* Loading */}
          {isLoading && (
            <Text style={[styles.loading, { color: colors.textSecondary }]}>
              Setting up PIN...
            </Text>
          )}

          {/* Info */}
          <View style={styles.instructions}>
            <View style={styles.instructionRow}>
              <Ionicons name="flash" size={20} color={colors.accent} />
              <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
                PIN is for quick unlock only
              </Text>
            </View>
            <View style={styles.instructionRow}>
              <Ionicons name="shield-checkmark" size={20} color={colors.success} />
              <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
                Your messages are encrypted with your password
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Buttons */}
        <View style={styles.footer}>
          {canContinue && (
            Platform.OS === 'ios' ? (
              <Host style={styles.nativeButtonHost}>
                <SwiftUIButton onPress={handleContinue}>
                  Continue
                </SwiftUIButton>
              </Host>
            ) : (
              <TouchableOpacity
                style={[styles.continueButton, { backgroundColor: colors.accent }]}
                onPress={handleContinue}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>
            )
          )}
          
          {step === 'create' && (
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
                Skip for now
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Layout.spacing.xxl,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: Layout.spacing.sm,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Layout.spacing.lg,
  },
  title: {
    fontSize: Layout.fontSize.title,
    fontWeight: Layout.fontWeight.bold,
    marginBottom: Layout.spacing.sm,
  },
  subtitle: {
    fontSize: Layout.fontSize.md,
    textAlign: 'center',
    paddingHorizontal: Layout.spacing.lg,
  },
  pinContainer: {
    alignItems: 'center',
    marginBottom: Layout.spacing.md,
  },
  pinDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Layout.spacing.md,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  lengthIndicator: {
    textAlign: 'center',
    fontSize: Layout.fontSize.sm,
    marginBottom: Layout.spacing.md,
  },
  error: {
    textAlign: 'center',
    fontSize: Layout.fontSize.sm,
    marginBottom: Layout.spacing.md,
  },
  loading: {
    textAlign: 'center',
    fontSize: Layout.fontSize.sm,
    marginBottom: Layout.spacing.md,
  },
  instructions: {
    marginTop: Layout.spacing.xl,
    gap: Layout.spacing.md,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.md,
  },
  instructionText: {
    fontSize: Layout.fontSize.sm,
    flex: 1,
  },
  footer: {
    padding: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
    gap: Layout.spacing.md,
  },
  nativeButtonHost: {
    height: 50,
  },
  continueButton: {
    height: 50,
    borderRadius: Layout.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.semibold,
  },
  skipButton: {
    alignItems: 'center',
    padding: Layout.spacing.sm,
  },
  skipButtonText: {
    fontSize: Layout.fontSize.md,
  },
});
