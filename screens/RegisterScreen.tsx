import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
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
import { notificationService } from '../services/NotificationService';
import { GlassCard } from '../components/GlassCard';
import { TransparentField } from '../components/TransparentField';
import { ApiService } from '../services/ApiService';
import { palette, radii, spacing } from '../theme/designSystem';

export const RegisterScreen: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const u = username.trim();
    const e = email.trim();
    const p = password;
    const p2 = password2;

    if (!u || !e || !p || !p2) {
        notificationService.show('error', 'All fields are required', 'Error');
      return;
    }
    if (p !== p2) {
        notificationService.show('error', 'Passwords do not match', 'Error');
      return;
    }

    setLoading(true);
    console.log('📝 Starting registration for:', e, '(username:', u, ')');

    try {
      const response = await ApiService.post('/auth/register', {
        email: e,
        username: u,
        password: p,
      });

      console.log('📝 Register response:', response);

      if (response.success) {
        const verified = response.data?.verified ?? false;
        console.log('📧 User verified status:', verified);

        if (!verified) {
          console.log('📧 User needs verification, redirecting to verify screen');
            notificationService.show('success', 'Please check your email for a verification code.', 'Registration successful');
          router.replace({
            pathname: '/verify' as any,
            params: { email: e },
          } as any);
        } else {
          console.log('✅ User already verified, registration complete');
            notificationService.show('success', 'Registration completed successfully!', 'Registration successful');
          router.replace({
            pathname: '/verify' as any,
            params: { email: e },
          } as any);
        }
      } else {
        console.log('❌ Registration failed:', response.error);
        const errorMessage = response.error || 'Registration error occurred';
          notificationService.show('error', errorMessage || 'Registration failed', 'Error');
      }
    } catch (error: any) {
      console.log('❌ Registration exception:', error);
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

  const goToLogin = () => {
    router.replace('/' as any);
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
          <Text style={styles.overline}>Create your handle</Text>
          <Text style={styles.title}>Join the Syncre collective</Text>
          <Text style={styles.subtitle}>Encryption-first chat across mobile & web.</Text>
        </View>

        <GlassCard style={styles.formCard} variant="subtle" padding={spacing.lg}>
          <View style={styles.formContainer}>
            <TransparentField
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              prefixIcon={<Ionicons name="person" size={18} color={palette.textSubtle} />}
              style={styles.inputField}
            />

            <TransparentField
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              prefixIcon={<Ionicons name="mail" size={18} color={palette.textSubtle} />}
              style={styles.inputField}
            />

            <TransparentField
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              prefixIcon={<Ionicons name="lock-closed" size={18} color={palette.textSubtle} />}
              style={styles.inputField}
            />

            <TransparentField
              placeholder="Confirm Password"
              value={password2}
              onChangeText={setPassword2}
              secureTextEntry
              prefixIcon={<Ionicons name="lock-closed" size={18} color={palette.textSubtle} />}
              style={styles.inputField}
            />

            <TouchableOpacity onPress={handleRegister} disabled={loading} style={styles.registerButton}>
              <LinearGradient
                colors={['#2C82FF', '#0EA5FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.registerButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.registerButtonText}>Register</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={goToLogin} style={styles.loginLink}>
              <Text style={styles.loginLinkText}>Already have an account? Login</Text>
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
    gap: spacing.sm,
  },
  logoGradient: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2C82FF',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 18,
    marginBottom: spacing.sm,
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
    fontSize: 28,
    fontFamily: 'SpaceGrotesk-SemiBold',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  formContainer: {
    paddingBottom: spacing.xs,
  },
  inputField: {
    marginBottom: spacing.md,
  },
  registerButton: {
    width: '100%',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  registerButtonGradient: {
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    shadowColor: '#2C82FF',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 14,
  },
  registerButtonText: {
    color: 'white',
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  loginLinkText: {
    color: palette.textMuted,
    fontSize: 14,
  },
});
