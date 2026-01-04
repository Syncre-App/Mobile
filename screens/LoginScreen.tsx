import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { AppBackground } from '../components/AppBackground';
import { TransparentField } from '../components/TransparentField';
import { ApiService } from '../services/ApiService';
import { notificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';
import { CryptoService, EncryptedIdentityKey } from '../services/CryptoService';
import { font, palette, radii, spacing } from '../theme/designSystem';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [obscurePassword, setObscurePassword] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please fill in both email and password fields');
      notificationService.show('error', 'Please fill in both email and password fields', 'Error');
      return;
    }
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) {
      setErrorMessage('Please enter a valid email address');
      notificationService.show('error', 'Please enter a valid email address', 'Error');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    try {
      const response = await ApiService.post('/auth/login', {
        email: email.trim(),
        password: password,
      });

      console.log('Login response raw =', response);

      if (response.success && response.data) {
        const data = response.data as any;
        const token = data?.token || data?.accessToken || data?.authToken || data?.jwt;
        const user = data?.user || data?.profile || data?.user_data || data;
        console.log('Login parsed token=', !!token, 'user present=', !!user);

        if (token) {
          await StorageService.setAuthToken(token);
          const verify = await StorageService.getAuthToken();
          console.log('StorageService.getAuthToken() =>', verify ? '[present]' : '[missing]');
        } else {
          console.warn('Login: server returned no token');
        }

        if (user) {
          await StorageService.setObject('user_data', user);
        } else {
          console.warn('Login: server returned no user object');
        }

        if (token) {
          // Initialize E2EE identity with password
          try {
            const identityKey = (data?.identityKey as EncryptedIdentityKey) || null;
            await CryptoService.initializeFromLogin({
              password: password,
              token: token,
              identityKey: identityKey,
            });
            console.log('[LoginScreen] E2EE identity initialized');
          } catch (cryptoError: any) {
            console.error('[LoginScreen] Failed to initialize E2EE:', cryptoError);
            // Don't block login, but warn user
            notificationService.show('error', 'Failed to initialize secure messaging. Some features may not work.', 'Warning');
          }

          notificationService.show('success', `Welcome, ${user?.username || user?.name || email}!`, 'Login successful');

          if (data?.requires_terms_acceptance || !user?.terms_accepted_at) {
            router.replace('/terms' as any);
          } else {
            router.replace('/home' as any);
          }
        } else {
          setErrorMessage('Missing authentication token');
          notificationService.show('error', 'Missing authentication token', 'Error');
        }
      } else {
        console.warn('Login failed response:', response);
        const bannedUntil = (response.data as any)?.banned_until || (response.data as any)?.bannedUntil;
        const deleteAfter = (response.data as any)?.delete_after;
        if (bannedUntil) {
          const until = new Date(bannedUntil);
          setErrorMessage(`Your account is banned until ${until.toLocaleString()}.`);
          notificationService.show(
            'error',
            `Your account is banned until ${until.toLocaleString()}.`,
            'Login blocked'
          );
        } else if (deleteAfter) {
          setErrorMessage('Account deletion is pending. Try again after the 24h grace window or contact support.');
          notificationService.show(
            'error',
            'Account deletion is pending. Try again after the 24h grace window or contact support.',
            'Login blocked'
          );
        } else {
          setErrorMessage(response.error || 'Login failed');
          notificationService.show('error', response.error || 'Login failed', 'Error');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setErrorMessage('Network error or server issue');
      notificationService.show('error', 'Network error or server issue', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppBackground />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.overline}>Welcome back</Text>
          <Text style={styles.heroTitle}>Talk freely.</Text>
          <Text style={styles.heroSubtitle}>Stay close. Own your data.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.title}>Sign in to Syncre</Text>
            <Text style={styles.subtitle}>Secure messaging that mirrors our web glow.</Text>

            <TransparentField
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              prefixIcon={<Ionicons name="mail" size={18} color={palette.textSubtle} />}
              style={styles.field}
            />

            <TransparentField
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={obscurePassword}
              prefixIcon={<Ionicons name="lock-closed" size={18} color={palette.textSubtle} />}
              suffixIcon={<Ionicons name={obscurePassword ? 'eye' : 'eye-off'} size={18} color={palette.textSubtle} />}
              onSuffixPress={() => setObscurePassword(!obscurePassword)}
              style={styles.field}
            />

            <View style={styles.row}>
              <TouchableOpacity onPress={() => router.push({ pathname: '/reset', params: { email } } as any)}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              activeOpacity={0.9}
              disabled={isLoading}
            >
              <LinearGradient
                colors={isLoading ? ['#64748B', '#475569'] : ['#2563EB', '#0EA5E9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.loginButtonText}>Login</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <TouchableOpacity onPress={() => router.push('/register' as any)} style={styles.registerLink}>
              <Text style={styles.registerText}>
                Don&apos;t have an account? <Text style={styles.registerTextHighlight}>Register</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    textTransform: 'uppercase',
    fontSize: 12,
  },
  heroTitle: {
    color: palette.text,
    fontSize: 34,
    ...font('display'),
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: palette.textMuted,
    fontSize: 15,
    ...font('regular'),
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardContent: { width: '100%' },
  title: {
    color: palette.text,
    fontSize: 22,
    ...font('semibold'),
    letterSpacing: -0.2,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  field: { marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.lg,
  },
  forgotText: { color: palette.accentSecondary, fontSize: 14, textDecorationLine: 'underline' },
  loginButton: { width: '100%', marginBottom: spacing.md },
  loginButtonDisabled: { opacity: 0.75 },
  loginGradient: {
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  loginButtonText: { color: '#fff', fontSize: 16, ...font('semibold') },
  registerLink: { alignItems: 'center', paddingVertical: spacing.xs, marginTop: spacing.xs },
  registerText: { color: palette.textMuted, fontSize: 14 },
  registerTextHighlight: { color: palette.accentSecondary, ...font('semibold') },
  errorBox: {
    width: '100%',
    backgroundColor: '#ef44441a',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  errorText: { color: '#fecdd3', fontSize: 14, textAlign: 'center' },
});
