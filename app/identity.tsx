import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen } from '../components/Screen';
import { AppBackground } from '../components/AppBackground';
import { Field } from '../components/Field';
import { GlassPanel } from '../components/GlassPanel';
import { PrimaryButton } from '../components/PrimaryButton';
import { font, spacing, useTheme } from '../theme/designSystem';
import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { CryptoService } from '../services/CryptoService';
import { NotificationService } from '../services/NotificationService';
import { IdentityService } from '../services/IdentityService';
import { PinService } from '../services/PinService';

export default function IdentityScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = params?.mode === 'setup' ? 'setup' : 'unlock';
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = mode === 'setup' ? 'Create Secure PIN' : 'Unlock Secure Messages';
  const subtitle =
    mode === 'setup'
      ? 'Pick a 4-6 digit PIN. This protects your private key.'
      : 'Enter your PIN to unlock secure messages on this device.';

  const handleSubmit = async () => {
    const trimmed = pin.trim();
    if (trimmed.length < 4 || trimmed.length > 6) {
      NotificationService.show('error', 'PIN must be 4-6 digits.');
      return;
    }
    setIsSubmitting(true);
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      const [remoteResponse, localIdentity] = await Promise.all([
        ApiService.get('/keys/identity', token),
        CryptoService.getStoredIdentity(),
      ]);

      const remoteData = remoteResponse.success ? remoteResponse.data : null;
      const remotePublicKey = remoteData?.publicKey || null;
      const remoteHasEncrypted = remoteResponse.success && Boolean(remoteData?.encryptedPrivateKey);
      const shouldBackup = mode === 'setup' || !remoteHasEncrypted;

      if (mode === 'unlock' && !remoteHasEncrypted) {
        NotificationService.show('error', 'No secure backup found. Set up your PIN first.');
        return;
      }

      if (mode === 'unlock' && localIdentity && remotePublicKey && localIdentity.publicKey !== remotePublicKey) {
        const choice = await new Promise<'remote' | 'local' | null>((resolve) => {
          Alert.alert(
            'Secure identity mismatch',
            'This device has a different key than the backup. Which one should we keep?',
            [
              { text: 'Use backup', style: 'destructive', onPress: () => resolve('remote') },
              { text: 'Use this device', onPress: () => resolve('local') },
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
            ]
          );
        });
        if (!choice) return;
        if (choice === 'remote') {
          await CryptoService.resetIdentity();
        }
      }

      await PinService.setPin(trimmed);
      await CryptoService.bootstrapIdentity({
        pin: trimmed,
        token,
        identityResponse: remoteResponse,
        forceBackup: shouldBackup,
      });
      IdentityService.clearCache();
      NotificationService.show('success', mode === 'setup' ? 'Secure PIN saved' : 'Secure messaging unlocked');
      router.replace('/home');
    } catch (err: any) {
      const message = err?.message || 'Failed to unlock secure keys.';
      if (/decrypt identity key/i.test(message)) {
        Alert.alert(
          'Cannot unlock secure key',
          'The backup could not be decrypted. You can reset and create a new key.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Reset identity',
              style: 'destructive',
              onPress: async () => {
                await CryptoService.resetIdentity();
                await PinService.clearPin();
                IdentityService.clearCache();
                NotificationService.show('info', 'Secure identity reset. Set a new PIN.');
                router.replace('/identity?mode=setup');
              },
            },
          ]
        );
      } else {
        NotificationService.show('error', message);
      }
    } finally {
      setIsSubmitting(false);
      setPin('');
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <AppBackground />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.overline}>Secure identity</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <GlassPanel style={styles.panel} glassEffectStyle="regular" isInteractive>
            <Field
              label="PIN"
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              secureTextEntry
            />
            <PrimaryButton title={mode === 'setup' ? 'Save PIN' : 'Unlock'} onPress={handleSubmit} loading={isSubmitting} />
          </GlassPanel>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    scroll: {
      paddingBottom: spacing.xxl,
    },
    hero: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxl,
      gap: spacing.xs,
    },
    overline: {
      color: theme.palette.textSubtle,
      ...font('displayMedium'),
      letterSpacing: 3,
      textTransform: 'uppercase',
      fontSize: 12,
    },
    title: {
      color: theme.palette.text,
      fontSize: 28,
      ...font('display'),
    },
    subtitle: {
      color: theme.palette.textMuted,
      fontSize: 14,
      ...font('regular'),
    },
    panel: {
      marginTop: spacing.xl,
      marginHorizontal: spacing.lg,
      gap: spacing.md,
    },
  });
