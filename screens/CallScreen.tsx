import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Dimensions, Animated, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RTCView, mediaStream } from 'react-native-webrtc';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { callService, CallSession } from '../services/CallService';
import { webRTCService } from '../services/WebRTCService';
import { useCall } from '../hooks/useCall';

const { width, height } = Dimensions.get('window');

export const CallScreen: React.FC = () => {
  const { currentSession, endCall, toggleMute, toggleVideo, switchCamera } = useCall();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [participants, setParticipants] = useState<any[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (currentSession?.status === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentSession?.status]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
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

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await endCall();
    router.back();
  };

  const handleMute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMuted = toggleMute();
    setIsMuted(newMuted);
  };

  const handleVideo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newVideoEnabled = toggleVideo();
    setIsVideoEnabled(newVideoEnabled);
  };

  const handleSpeaker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSpeakerOn(!isSpeakerOn);
  };

  const handleSwitchCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await switchCamera();
  };

  if (!currentSession) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No active call</Text>
      </View>
    );
  }

  const isVideo = currentSession.callType === 'video';
  const isConnected = currentSession.status === 'connected';
  const isRinging = currentSession.status === 'ringing' || currentSession.status === 'calling';

  const localStream = webRTCService.getLocalStream();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleEndCall} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {isVideo ? 'Video Call' : 'Voice Call'}
          </Text>
          {isConnected && (
            <Text style={styles.durationText}>{formatDuration(callDuration)}</Text>
          )}
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Main content */}
      <View style={styles.content}>
        {isConnected ? (
          <>
            {/* Remote video / participant grid */}
            {isVideo ? (
              <View style={styles.videoContainer}>
                {participants.length > 0 ? (
                  <ScrollView horizontal pagingEnabled>
                    {participants.map((participant) => (
                      <View key={participant.id} style={styles.remoteVideo}>
                        <View style={styles.videoPlaceholder}>
                          <Ionicons name="person" size={64} color="rgba(255,255,255,0.3)" />
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.remoteVideo}>
                    <View style={styles.videoPlaceholder}>
                      <Ionicons name="person" size={80} color="rgba(255,255,255,0.3)" />
                    </View>
                  </View>
                )}
              </View>
            ) : (
              /* Voice call - show avatar */
              <View style={styles.voiceContainer}>
                <Animated.View 
                  style={[
                    styles.avatarWrapper,
                    { transform: [{ scale: isRinging ? pulseAnim : 1 }] }
                  ]}
                >
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={80} color="#FFFFFF" />
                  </View>
                </Animated.View>
                <Text style={styles.participantName}>
                  {currentSession.participants[0]?.id || 'User'}
                </Text>
                <Text style={styles.callStatus}>
                  {isConnected ? 'Connected' : 'Connecting...'}
                </Text>
              </View>
            )}

            {/* Local video preview (PiP) */}
            {isVideo && isVideoEnabled && localStream && (
              <View style={styles.localVideo}>
                <RTCView
                  streamURL={localStream.toURL()}
                  style={styles.localVideoInner}
                  objectFit="cover"
                  mirror={true}
                />
              </View>
            )}
          </>
        ) : (
          /* Ringing state */
          <View style={styles.ringingContainer}>
            <Animated.View 
              style={[
                styles.avatarWrapper,
                { transform: [{ scale: pulseAnim }] }
              ]}
            >
              <View style={styles.avatar}>
                <Ionicons name="person" size={80} color="#FFFFFF" />
              </View>
            </Animated.View>
            <Text style={styles.ringingText}>
              {currentSession.status === 'calling' ? 'Calling...' : 'Ringing...'}
            </Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {isConnected && (
          <>
            {/* Mute */}
            <Pressable
              style={[styles.controlButton, isMuted && styles.controlButtonActive]}
              onPress={handleMute}
            >
              <Ionicons 
                name={isMuted ? 'mic-off' : 'mic'} 
                size={24} 
                color="#FFFFFF" 
              />
            </Pressable>

            {/* Video toggle (only for video calls) */}
            {isVideo && (
              <Pressable
                style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]}
                onPress={handleVideo}
              >
                <Ionicons 
                  name={isVideoEnabled ? 'videocam' : 'videocam-off'} 
                  size={24} 
                  color="#FFFFFF" 
                />
              </Pressable>
            )}

            {/* Speaker */}
            <Pressable
              style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
              onPress={handleSpeaker}
            >
              <Ionicons 
                name={isSpeakerOn ? 'volume-high' : 'volume-medium'} 
                size={24} 
                color="#FFFFFF" 
              />
            </Pressable>

            {/* Switch camera */}
            {isVideo && isVideoEnabled && (
              <Pressable
                style={styles.controlButton}
                onPress={handleSwitchCamera}
              >
                <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
              </Pressable>
            )}
          </>
        )}

        {/* End call */}
        <Pressable
          style={[styles.controlButton, styles.endCallButton]}
          onPress={handleEndCall}
        >
          <Ionicons name="call" size={28} color="#FFFFFF" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  durationText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  headerRight: {
    width: 36,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  remoteVideo: {
    width: width,
    height: height * 0.5,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceContainer: {
    alignItems: 'center',
  },
  avatarWrapper: {
    marginBottom: 20,
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
  participantName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  callStatus: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  ringingContainer: {
    alignItems: 'center',
  },
  ringingText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 20,
  },
  localVideo: {
    position: 'absolute',
    top: 100,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2a2a3e',
  },
  localVideoInner: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    gap: 20,
    paddingBottom: 50,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF3B30',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
});

export default CallScreen;
