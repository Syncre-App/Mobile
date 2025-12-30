import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Keyboard,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { useE2EEStore } from '../../stores/e2eeStore';
import { secureStorage } from '../../services/storage/secure';
import { Layout } from '../../constants/layout';
import { APP_CONFIG } from '../../constants/config';

export default function PinSetupScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ email?: string; password?: string }>();
  const { user } = useAuthStore();
  const { setupIdentityKey, registerDevice } = useE2EEStore();

  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Focus input on mount
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [step]);

  const hashPin = async (pinCode: string): Promise<string> => {
    // Simple hash for PIN verification
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pinCode + (user?.id || 'salt')
    );
    return hash;
  };

  const handlePinChange = (value: string) => {
    // Only allow digits
    const digits = value.replace(/\D/g, '');
    
    if (step === 'create') {
      setPin(digits);
      setError('');
      
      // Auto-advance to confirm when PIN is complete
      if (digits.length >= APP_CONFIG.PIN_MIN_LENGTH && digits.length <= APP_CONFIG.PIN_MAX_LENGTH) {
        if (digits.length === APP_CONFIG.PIN_MAX_LENGTH) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setTimeout(() => {
            setStep('confirm');
            setConfirmPin('');
          }, 200);
        }
      }
    } else {
      setConfirmPin(digits);
      setError('');
      
      // Auto-verify when confirm PIN is complete
      if (digits.length === pin.length) {
        verifyAndSetup(digits);
      }
    }
  };

  const verifyAndSetup = async (confirmedPin: string) => {
    if (confirmedPin !== pin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('PINs do not match. Try again.');
      setConfirmPin('');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Hash and store PIN
      const pinHash = await hashPin(pin);
      await secureStorage.setPinHash(pinHash);

      // Setup E2EE with PIN as the password
      const e2eeResult = await setupIdentityKey(pin);
      if (!e2eeResult.success) {
        throw new Error(e2eeResult.error || 'Failed to setup encryption');
      }

      // Register device
      const deviceId = await secureStorage.getDeviceId();
      if (deviceId) {
        await registerDevice(deviceId);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Navigate to main app
      router.replace('/(app)/(tabs)');
    } catch (err: any) {
      console.error('PIN setup error:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.message || 'Failed to setup PIN. Please try again.');
      // Reset to create step
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

  const currentPin = step === 'create' ? pin : confirmPin;
  const maxLength = step === 'create' ? APP_CONFIG.PIN_MAX_LENGTH : pin.length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
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
              ? `Enter a ${APP_CONFIG.PIN_MIN_LENGTH}-${APP_CONFIG.PIN_MAX_LENGTH} digit PIN to secure your messages`
              : 'Enter your PIN again to confirm'}
          </Text>
        </View>

        {/* PIN Dots */}
        <View style={styles.pinContainer}>
          <View style={styles.pinDots}>
            {Array.from({ length: maxLength }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.pinDot,
                  {
                    backgroundColor: index < currentPin.length ? colors.accent : 'transparent',
                    borderColor: colors.border,
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
            maxLength={maxLength}
            autoFocus
            secureTextEntry
          />
        </View>

        {/* Error */}
        {error ? (
          <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
        ) : null}

        {/* Loading */}
        {isLoading && (
          <Text style={[styles.loading, { color: colors.textSecondary }]}>
            Setting up encryption...
          </Text>
        )}

        {/* Instructions */}
        <View style={styles.instructions}>
          <View style={styles.instructionRow}>
            <Ionicons name="shield-checkmark" size={20} color={colors.success} />
            <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
              Your PIN encrypts your messages
            </Text>
          </View>
          <View style={styles.instructionRow}>
            <Ionicons name="warning" size={20} color={colors.warning} />
            <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
              If you forget your PIN, you'll lose access to old messages
            </Text>
          </View>
        </View>
      </View>

      {/* Continue button for create step */}
      {step === 'create' && pin.length >= APP_CONFIG.PIN_MIN_LENGTH && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: colors.accent }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setStep('confirm');
            }}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
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
    marginBottom: Layout.spacing.xl,
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
});
