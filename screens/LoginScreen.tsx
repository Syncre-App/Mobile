import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { AppBackground } from '../components/AppBackground';
import { GlassCard } from '../components/GlassCard';
import { TransparentField } from '../components/TransparentField';
import { ApiService } from '../services/ApiService';
import { notificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';
import { IdentityService } from '../services/IdentityService';
import { CryptoService } from '../services/CryptoService';
import { palette, radii, spacing } from '../theme/designSystem';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [obscurePassword, setObscurePassword] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      notificationService.show('error', 'Please fill in both email and password fields', 'Error');
      return;
    }
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) {
      notificationService.show('error', 'Please enter a valid email address', 'Error');
      return;
    }

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
          const [needsSetup, localIdentity] = await Promise.all([
            IdentityService.requiresBootstrap(token),
            CryptoService.getStoredIdentity(),
          ]);

          notificationService.show('success', `Welcome, ${user?.username || user?.name || email}!`, 'Login successful');

          if (needsSetup) {
            router.replace('/identity?mode=setup' as any);
          } else if (!localIdentity) {
            router.replace('/identity?mode=unlock' as any);
          } else {
            router.replace('/home' as any);
          }
        } else {
          notificationService.show('error', 'Missing authentication token', 'Error');
        }
      } else {
        console.warn('Login failed response:', response);
        notificationService.show('error', response.error || 'Login failed', 'Error');
      }
    } catch (error: any) {
      console.error('Login error:', error);
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
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.overline}>Welcome back</Text>
          <Text style={styles.heroTitle}>Talk freely.</Text>
          <Text style={styles.heroSubtitle}>Stay close. Own your data.</Text>
        </View>

        <GlassCard width="100%" style={styles.card} variant="subtle" padding={spacing.lg}>
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
              <View style={styles.rememberRow}>
                <Switch
                  value={remember}
                  onValueChange={setRemember}
                  trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: palette.accent }}
                  thumbColor="#fff"
                  ios_backgroundColor="rgba(255,255,255,0.15)"
                />
                <Text style={styles.rememberText}>Remember me</Text>
              </View>
              <TouchableOpacity>
                <Text style={styles.forgotText}>Forgot?</Text>
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

            <TouchableOpacity onPress={() => router.push('/register' as any)} style={styles.registerLink}>
              <Text style={styles.registerText}>
                Don&apos;t have an account? <Text style={styles.registerTextHighlight}>Register</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
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
  logo: { width: 96, height: 96, marginBottom: spacing.sm },
  overline: {
    color: palette.textSubtle,
    fontFamily: 'SpaceGrotesk-Medium',
    letterSpacing: 4,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  heroTitle: {
    color: palette.text,
    fontSize: 34,
    fontFamily: 'SpaceGrotesk-SemiBold',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: palette.textMuted,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  card: { width: '100%', maxWidth: 420 },
  cardContent: { width: '100%' },
  title: {
    color: palette.text,
    fontSize: 22,
    fontFamily: 'PlusJakartaSans-SemiBold',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.lg,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rememberText: { color: palette.textMuted, fontSize: 14 },
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
  loginButtonText: { color: '#fff', fontSize: 16, fontFamily: 'PlusJakartaSans-SemiBold' },
  registerLink: { alignItems: 'center', paddingVertical: spacing.xs, marginTop: spacing.xs },
  registerText: { color: palette.textMuted, fontSize: 14 },
  registerTextHighlight: { color: palette.accentSecondary, fontFamily: 'PlusJakartaSans-SemiBold' },
});
