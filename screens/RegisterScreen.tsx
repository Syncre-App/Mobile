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
import { notificationService } from '../services/NotificationService';

import { GlassCard } from '../components/GlassCard';
import { TransparentField } from '../components/TransparentField';
import { ApiService } from '../services/ApiService';

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
      
      {/* Background Gradient */}
      <LinearGradient
        colors={['#03040A', '#071026']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Neon Logo */}
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={['#0EA5FF', '#2C82FF']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.logoGradient}
          >
            <Ionicons name="menu" size={36} color="white" />
          </LinearGradient>
        </View>

        {/* Register Form */}
        <GlassCard style={styles.formCard}>
          <View style={styles.headerContainer}>
            <Text style={styles.title}>REGISTER</Text>
            <LinearGradient
              colors={['#2C82FF', '#0EA5FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.titleUnderline}
            />
          </View>

          <View style={styles.formContainer}>
            <TransparentField
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              prefixIcon={
                <Ionicons name="person" size={18} color="rgba(255, 255, 255, 0.7)" />
              }
              style={styles.inputField}
            />

            <TransparentField
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              prefixIcon={
                <Ionicons name="mail" size={18} color="rgba(255, 255, 255, 0.7)" />
              }
              style={styles.inputField}
            />

            <TransparentField
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              prefixIcon={
                <Ionicons name="lock-closed" size={18} color="rgba(255, 255, 255, 0.7)" />
              }
              style={styles.inputField}
            />

            <TransparentField
              placeholder="Confirm Password"
              value={password2}
              onChangeText={setPassword2}
              secureTextEntry
              prefixIcon={
                <Ionicons name="lock-closed" size={18} color="rgba(255, 255, 255, 0.7)" />
              }
              style={styles.inputField}
            />

            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              style={styles.registerButton}
            >
              <LinearGradient
                colors={['#2C82FF', '#0EA5FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.registerButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.registerButtonText}>REGISTER</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 48,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
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
  },
  formCard: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  title: {
    color: 'white',
    fontWeight: 'bold',
    letterSpacing: 2,
    fontSize: 16,
    marginBottom: 8,
  },
  titleUnderline: {
    width: 120,
    height: 3,
    borderRadius: 2,
  },
  formContainer: {
    paddingBottom: 10,
  },
  inputField: {
    marginBottom: 12,
  },
  registerButton: {
    width: '100%',
    marginTop: 16,
    marginBottom: 12,
  },
  registerButtonGradient: {
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    shadowColor: '#2C82FF',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 14,
  },
  registerButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  loginLinkText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
});
