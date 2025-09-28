import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, Stack } from 'expo-router';
import React from 'react';
import {
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { GlassCard } from '../components/GlassCard';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#03040A', '#071026']}
        style={StyleSheet.absoluteFillObject}
      />
      
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Page Not Found' }} />
        
        <View style={styles.content}>
          <GlassCard style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="alert-circle-outline" size={80} color="rgba(255, 255, 255, 0.6)" />
            </View>
            
            <Text style={styles.title}>Oops!</Text>
            <Text style={styles.subtitle}>Page Not Found</Text>
            <Text style={styles.description}>
              The page you're looking for doesn't exist or has been moved.
            </Text>
            
            <Link href="/" asChild>
              <TouchableOpacity style={styles.homeButton}>
                <Ionicons name="home" size={20} color="#ffffff" />
                <Text style={styles.homeButtonText}>Go to Home</Text>
              </TouchableOpacity>
            </Link>
          </GlassCard>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#03040A',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    padding: 40,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C82FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  homeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
