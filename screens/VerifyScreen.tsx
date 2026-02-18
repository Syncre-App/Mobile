import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBackground } from '../components/AppBackground';
import { ApiService } from '../services/ApiService';
import { notificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';
import { font, palette, radii, spacing } from '../theme/designSystem';

const CODE_LENGTH = 6;

export const VerifyScreen: React.FC = () => {
  const { email } = useLocalSearchParams();
  const [codeDigits, setCodeDigits] = useState<string[]>(Array.from({ length: CODE_LENGTH }, () => ''));
  const [loading, setLoading] = useState(false);
  const inputsRef = React.useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    focusAt(0);
  }, []);

  const focusAt = (index: number) => {
    const target = inputsRef.current[index];
    if (target) {
      target.focus();
    }
  };

  const handleChangeAt = (value: string, index: number) => {
    const sanitized = value.replace(/\D/g, '');
    if (!sanitized.length) {
      const next = [...codeDigits];
      next[index] = '';
      setCodeDigits(next);
      return;
    }

    const next = [...codeDigits];
    let cursor = index;
    sanitized.split('').forEach((char) => {
      if (cursor >= CODE_LENGTH) return;
      next[cursor] = char;
      cursor += 1;
    });
    setCodeDigits(next);
    if (cursor < CODE_LENGTH) {
      focusAt(cursor);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !codeDigits[index] && index > 0) {
      const next = [...codeDigits];
      next[index - 1] = '';
      setCodeDigits(next);
      focusAt(index - 1);
    }
  };

  const handleVerify = async () => {
    const code = codeDigits.join('').trim();
    if (code.length !== CODE_LENGTH) {
      notificationService.show('error', 'Please enter the 6-digit code', 'Error');
      return;
    }

    setLoading(true);
    console.log('Starting verification for:', email, 'with code:', code);

    try {
      const response = await ApiService.post('/auth/verify', {
        email: email,
        code,
      });

      console.log('Verify response:', response);

      if (response.success && response.data) {
        console.log('Verification successful');
        
        const { token, user } = response.data as any;
        
        // Save token and user data if present
        if (token) {
          await StorageService.setAuthToken(token);
        } else {
          console.warn('Verify: server returned no token');
        }

        if (user) {
          await StorageService.setObject('user_data', user);
        } else {
          console.warn('Verify: server returned no user object');
        }
        
        notificationService.show('success', 'Account verification successful!', 'Success');
        router.replace('/home' as any);
      } else {
        console.log('Verification failed:', response.error);
        notificationService.show('error', response.error || 'Verification failed', 'Error');
      }
    } catch (error: any) {
      console.log('Verification exception:', error);
      const msg = error.toString();
      if (msg.includes('Connection refused') || msg.includes('Network Error')) {
        notificationService.show('error', `Connection error: server not reachable (${ApiService.baseUrl})`, 'Error');
      } else {
        notificationService.show('error', `Error: ${error.message || error}`, 'Error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppBackground />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.overline}>Almost there</Text>
          <Text style={styles.title}>Verify your account</Text>
          <Text style={styles.description}>We sent a code to {email}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.content}>
            <View style={styles.codeRow}>
              {Array.from({ length: CODE_LENGTH }).map((_, idx) => (
                <TextInput
                  key={idx}
                  ref={(ref) => {
                    inputsRef.current[idx] = ref;
                  }}
                  style={[
                    styles.codeInput,
                    codeDigits[idx] ? styles.codeInputFilled : undefined,
                  ]}
                  value={codeDigits[idx]}
                  onChangeText={(text) => handleChangeAt(text, idx)}
                  onKeyPress={(e) => handleKeyPress(e, idx)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textContentType="oneTimeCode"
                  returnKeyType="done"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={handleVerify}
                />
              ))}
            </View>

            <TouchableOpacity
              onPress={handleVerify}
              disabled={loading}
              style={styles.verifyButton}
            >
              <LinearGradient
                colors={['#2C82FF', '#0EA5FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.verifyButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.verifyButtonText}>VERIFY</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    gap: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  overline: {
    color: palette.textSubtle,
    ...font('displayMedium'),
    letterSpacing: 4,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.text,
    fontWeight: '600',
    fontSize: 24,
    textAlign: 'center',
    ...font('display'),
  },
  description: {
    color: palette.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontSize: 15,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  content: {
    gap: spacing.md,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  codeInput: {
    flex: 1,
    height: 58,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    textAlign: 'center',
    color: palette.text,
    fontSize: 20,
    ...font('display'),
  },
  codeInputFilled: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  verifyButton: {
    width: '100%',
    marginTop: spacing.sm,
  },
  verifyButtonGradient: {
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  verifyButtonText: {
    color: 'white',
    ...font('semibold'),
    fontSize: 16,
  },
});
