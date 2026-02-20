import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCall } from '../hooks/useCall';
import type { CallSession } from '../services/CallService';

const { width } = Dimensions.get('window');

interface IncomingCallScreenProps {
  session: CallSession;
}

export const IncomingCallScreen: React.FC<IncomingCallScreenProps> = ({ session }) => {
  const { answerCall, endCall } = useCall();
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const handleAccept = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await answerCall();
    router.replace('/(tabs)/chats' as any);
  };

  const handleDecline = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await endCall();
    router.back();
  };

  const isVideo = session.callType === 'video';

  return (
    <View style={styles.container}>
      <View style={styles.backgroundGradient}>
        <View style={styles.topSection}>
          <Text style={styles.callerName}>
            {session.initiatorId || 'Unknown'}
          </Text>
          <Text style={styles.incomingText}>
            {isVideo ? 'Incoming video call...' : 'Incoming voice call...'}
          </Text>
        </View>

        <Animated.View 
          style={[
            styles.avatarContainer,
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <View style={styles.avatar}>
            <Ionicons name="person" size={80} color="#FFFFFF" />
          </View>
        </Animated.View>

        <View style={styles.callActions}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.declineButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleDecline}
          >
            <Ionicons name="call" size={28} color="#FFFFFF" />
            <Text style={styles.actionText}>Decline</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.acceptButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleAccept}
          >
            <Ionicons name="call" size={28} color="#FFFFFF" />
            <Text style={styles.actionText}>Accept</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundGradient: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 50,
  },
  topSection: {
    alignItems: 'center',
  },
  callerName: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  incomingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  avatarContainer: {
    marginVertical: 40,
  },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(30, 132, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(30, 132, 255, 0.5)',
  },
  callActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 60,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default IncomingCallScreen;
