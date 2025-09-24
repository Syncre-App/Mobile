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

import { GlassCard } from '../components/GlassCard';
import { TransparentField } from '../components/TransparentField';
import { ApiService } from '../services/ApiService';
import { notificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';

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
        
        const { token, user } = response.data;
        
        // Save token and user data
        await StorageService.setAuthToken(token);
        await StorageService.setObject('user_data', user);
        
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
    <View style={styles.container}>
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
        <GlassCard style={styles.card}>
          <View style={styles.content}>
            <Text style={styles.title}>VERIFY</Text>
            <Text style={styles.description}>
              A verification code was sent to {email}
            </Text>
            
            <TransparentField
              placeholder="Code"
              value={code}
              onChangeText={setCode}
              keyboardType="numeric"
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
    </View>
  );
};

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
  card: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  content: {
    padding: 20,
  },
  title: {
    color: 'white',
    fontWeight: 'bold',
    letterSpacing: 2,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 14,
  },
  inputField: {
    marginBottom: 12,
  },
  verifyButton: {
    width: '100%',
    marginTop: 8,
  },
  verifyButtonGradient: {
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
  },
  verifyButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
