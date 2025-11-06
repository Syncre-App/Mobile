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
import { GlassCard } from '../components/GlassCard';
import { TransparentField } from '../components/TransparentField';
import { ApiService } from '../services/ApiService';
import { notificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';

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

        notificationService.show('success', `Welcome, ${user?.username || user?.name || email}!`, 'Login successful');
        router.replace('/home' as any);
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
    <LinearGradient
      colors={['#03040A', '#071026']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.logoContainer}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <GlassCard width={360} style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.title}>LOGIN</Text>
            <LinearGradient colors={['#2C82FF', '#0EA5FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.underline} />

            <TransparentField
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              prefixIcon={<Ionicons name="mail" size={18} color="#fff7" />}
              style={styles.field}
            />

            <TransparentField
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={obscurePassword}
              prefixIcon={<Ionicons name="lock-closed" size={18} color="#fff7" />}
              suffixIcon={<Ionicons name={obscurePassword ? 'eye' : 'eye-off'} size={18} color="#fff7" />}
              onSuffixPress={() => setObscurePassword(!obscurePassword)}
              style={styles.field}
            />

            <View style={styles.row}>
              <View style={styles.rememberRow}>
                <Switch value={remember} onValueChange={setRemember} trackColor={{ false: '#767577', true: '#2C82FF' }} thumbColor="#fff" ios_backgroundColor="#3e3e3e" />
                <Text style={styles.rememberText}>Remember me</Text>
              </View>
              <TouchableOpacity>
                <Text style={styles.forgotText}>Forgot?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.loginButton, isLoading && styles.loginButtonDisabled]} onPress={handleLogin} activeOpacity={0.8} disabled={isLoading}>
              <LinearGradient colors={isLoading ? ['#999', '#777'] : ['#2C82FF', '#0EA5FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginGradient}>
                {isLoading ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.loginButtonText}>LOGIN</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/register' as any)} style={styles.registerLink}>
              <Text style={styles.registerText}>Don't have an account? <Text style={styles.registerTextHighlight}>Register</Text></Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      </ScrollView>
    </LinearGradient>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 48 },
  logoContainer: { marginBottom: 32, alignItems: 'center' },
  logo: { width: 120, height: 120 },
  card: { alignSelf: 'center' },
  cardContent: { alignItems: 'center' },
  title: { color: 'white', fontSize: 16, fontWeight: 'bold', letterSpacing: 2, marginTop: 10, marginBottom: 10 },
  underline: { width: 60, height: 2, borderRadius: 1, marginBottom: 30 },
  field: { marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 20 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rememberText: { color: '#fff9', fontSize: 14 },
  forgotText: { color: '#2C82FF', fontSize: 14, textDecorationLine: 'underline', textDecorationColor: '#fff7' },
  loginButton: { width: '100%', marginBottom: 20 },
  loginButtonDisabled: { opacity: 0.7 },
  loginGradient: { paddingVertical: 14, borderRadius: 24, alignItems: 'center', shadowColor: '#2C82FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 5 },
  loginButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  registerLink: { alignItems: 'center', paddingVertical: 8, marginTop: 4 },
  registerText: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 14 },
  registerTextHighlight: { color: '#2C82FF', fontWeight: 'bold' },
});
