import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../components/GlassCard';

export const MaintenanceScreen: React.FC = () => {
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
            <Ionicons name="construct" size={48} color="#fff7" />
            <Text style={styles.title}>Under Maintenance</Text>
            <LinearGradient colors={['#2C82FF', '#0EA5FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.underline} />
            <Text style={styles.message}>
              We are currently performing maintenance. We will be back shortly.
            </Text>
          </View>
        </GlassCard>
      </ScrollView>
    </LinearGradient>
  );
};

export default MaintenanceScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 48 },
  logoContainer: { marginBottom: 32, alignItems: 'center' },
  logo: { width: 120, height: 120 },
  card: { alignSelf: 'center' },
  cardContent: { alignItems: 'center', padding: 20 },
  title: { color: 'white', fontSize: 16, fontWeight: 'bold', letterSpacing: 2, marginTop: 20, marginBottom: 10 },
  underline: { width: 60, height: 2, borderRadius: 1, marginBottom: 30 },
  message: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 14, textAlign: 'center' },
});
