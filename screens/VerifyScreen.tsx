import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '../components/AppBackground';
import { GlassCard } from '../components/GlassCard';
import { TransparentField } from '../components/TransparentField';
import { ApiService } from '../services/ApiService';
import { notificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';
import { palette, radii, spacing } from '../theme/designSystem';

export const VerifyScreen: React.FC = () => {
  const { email } = useLocalSearchParams();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    const c = code.trim();
    if (!c) {
      notificationService.show('error', 'Please enter the verification code', 'Error');
      return;
    }

    setLoading(true);
    console.log('✅ Starting verification for:', email, 'with code:', c);

    try {
      const response = await ApiService.post('/auth/verify', {
        email: email,
        code: c,
      });

      console.log('✅ Verify response:', response);

      if (response.success && response.data) {
        console.log('✅ Verification successful');
        
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
        console.log('❌ Verification failed:', response.error);
  notificationService.show('error', response.error || 'Verification failed', 'Error');
      }
    } catch (error: any) {
      console.log('❌ Verification exception:', error);
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

        <GlassCard style={styles.card} variant="subtle" padding={spacing.lg}>
          <View style={styles.content}>
            
            <TransparentField
              placeholder="Code"
              value={code}
              onChangeText={setCode}
              keyboardType="default"
              autoCapitalize="characters"
              style={styles.inputField}
            />

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
        </GlassCard>
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
    fontFamily: 'SpaceGrotesk-Medium',
    letterSpacing: 4,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.text,
    fontWeight: '600',
    fontSize: 24,
    textAlign: 'center',
    fontFamily: 'SpaceGrotesk-SemiBold',
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
  },
  content: {
    gap: spacing.md,
  },
  inputField: {
    marginBottom: spacing.md,
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
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
  },
});
