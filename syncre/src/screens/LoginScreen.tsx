import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { GlassCard } from '../components/GlassCard';
import { TransparentField } from '../components/TransparentField';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [obscurePassword, setObscurePassword] = useState(true);

  const handleLogin = () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please fill in both email and password');
      return;
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) {
      Alert.alert('Error', 'Please enter a valid email');
      return;
    }

    // TODO: Implement actual login logic
    Alert.alert('Success', `Logged in as ${email}`);
  };

  const handleDiscordLogin = () => {
    // TODO: Implement Discord OAuth
    Alert.alert('Info', 'Discord login not implemented yet');
  };

  const handleAppleLogin = () => {
    // TODO: Implement Apple Sign In
    Alert.alert('Info', 'Apple login not implemented yet');
  };

  return (
    <LinearGradient
      colors={['#03040A', '#071026']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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

        {/* Glass Card */}
        <GlassCard width={360} style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.title}>LOGIN</Text>
            <LinearGradient
              colors={['#2C82FF', '#0EA5FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.underline}
            />

            {/* Email Field */}
            <TransparentField
              value={email}
              onChangeText={setEmail}
              placeholder="Email or username"
              prefixIcon={<Ionicons name="person" size={18} color="#fff7" />}
              style={styles.field}
            />

            {/* Password Field */}
            <TransparentField
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry={obscurePassword}
              prefixIcon={<Ionicons name="lock-closed" size={18} color="#fff7" />}
              suffixIcon={
                <Ionicons
                  name={obscurePassword ? 'eye' : 'eye-off'}
                  size={18}
                  color="#fff7"
                />
              }
              onSuffixPress={() => setObscurePassword(!obscurePassword)}
              style={styles.field}
            />

            {/* Remember Me & Forgot */}
            <View style={styles.row}>
              <View style={styles.rememberRow}>
                <Switch
                  value={remember}
                  onValueChange={setRemember}
                  trackColor={{ false: '#767577', true: '#2C82FF' }}
                  thumbColor="#fff"
                  ios_backgroundColor="#3e3e3e"
                />
                <Text style={styles.rememberText}>Remember me</Text>
              </View>
              <TouchableOpacity>
                <Text style={styles.forgotText}>Forgot?</Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#2C82FF', '#0EA5FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginGradient}
              >
                <Text style={styles.loginButtonText}>LOGIN</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* OR Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.divider} />
            </View>

            {/* Social Login */}
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleDiscordLogin}
              >
                <FontAwesome5 name="discord" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleAppleLogin}
              >
                <FontAwesome5 name="apple" size={24} color="white" />
              </TouchableOpacity>
            </View>

            {/* Terms */}
            <Text style={styles.termsText}>
              By continuing you agree to our Terms
            </Text>
          </View>
        </GlassCard>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 48,
  },
  logoContainer: {
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
    elevation: 10,
  },
  card: {
    alignSelf: 'center',
  },
  cardContent: {
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginTop: 10,
  },
  underline: {
    width: 120,
    height: 3,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 20,
  },
  field: {
    width: '100%',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberText: {
    color: '#fff7',
    marginLeft: 8,
  },
  forgotText: {
    color: '#fff7',
  },
  loginButton: {
    width: '100%',
    marginBottom: 14,
  },
  loginGradient: {
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#2C82FF',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 5,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  orText: {
    color: 'rgba(255, 255, 255, 0.54)',
    marginHorizontal: 8,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  socialButton: {
    marginHorizontal: 16,
    padding: 8,
  },
  termsText: {
    color: 'rgba(255, 255, 255, 0.38)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
});
