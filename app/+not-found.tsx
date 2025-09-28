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
      <StatusBar barStyle="light-content" />
      
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Nem található', headerShown: false }} />
        
        <View style={styles.content}>
          <View style={styles.cardWrapper}>
            <GlassCard style={styles.card} intensity={16}>
              <Text style={styles.title}>404</Text>
              <Text style={styles.subtitle}>Page not found</Text>
              <Text style={styles.description}>
                The requested page does not exist or has been moved.
              </Text>

              <Link href="/home" asChild>
                <TouchableOpacity style={styles.homeButton}>
                  <Text style={styles.homeButtonText}>Back to home</Text>
                </TouchableOpacity>
              </Link>
            </GlassCard>
          </View>
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 40,
    borderRadius: 15,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 24,
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
    backgroundColor: '#2C82FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  homeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
