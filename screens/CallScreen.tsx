import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Animated, ScrollView, SafeAreaView, StatusBar, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RTCView, mediaStream } from 'react-native-webrtc';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { webRTCService, CallParticipant } from '../services/WebRTCService';
import { useCall } from '../hooks/useCall';

const { width, height } = Dimensions.get('window');

const ParticipantTile: React.FC<{ participant: CallParticipant; isLocal?: boolean; isMuted?: boolean }> = ({
  participant,
  isLocal = false,
  isMuted = false,
}) => {
  const [showName, setShowName] = useState(true);

  return (
    <View style={styles.participantTile}>
      {participant.stream ? (
        <RTCView
          streamURL={participant.stream.toURL()}
          style={styles.participantVideo}
          objectFit="cover"
          mirror={isLocal}
        />
      ) : (
        <View style={styles.participantPlaceholder}>
          <Ionicons name="person" size={40} color="rgba(255,255,255,0.3)" />
        </View>
      )}
      
      <View style={styles.participantOverlay}>
        {participant.isMuted && (
          <View style={styles.mutedIndicator}>
            <Ionicons name="mic-off" size={14} color="#FFFFFF" />
          </View>
        )}
        <Text style={styles.participantName} numberOfLines={1}>
          {isLocal ? 'You' : participant.userId}
        </Text>
      </View>
    </View>
  );
};

export const CallScreen: React.FC = () => {
  const { currentSession, endCall, toggleMute, toggleVideo, switchCamera } = useCall();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (currentSession?.status === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      const interval = setInterval(() => {
        const parts = Array.from(webRTCService.getParticipants().values());
        setParticipants(parts);
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        clearInterval(interval);
      };
    }
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

  const handleScreenShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isScreenSharing) {
      webRTCService.stopScreenShare();
      setIsScreenSharing(false);
    } else {
      const success = await webRTCService.startScreenShare();
      setIsScreenSharing(!!success);
    }
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
  const remoteStreams = webRTCService.getRemoteStreams();
  
  const allParticipants: CallParticipant[] = [
    { id: 'local', userId: 'You', stream: localStream || null, isMuted, isVideoEnabled: isVideoEnabled },
    ...participants,
  ];

  const getGridLayout = (count: number) => {
    if (count === 1) return { cols: 1, rows: 1 };
    if (count === 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    return { cols: 4, rows: Math.ceil(count / 4) };
  };

  const { cols, rows } = getGridLayout(allParticipants.length);
  const tileWidth = (width - 32 - (cols - 1) * 8) / cols;
  const tileHeight = tileWidth * 1.3;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Pressable onPress={handleEndCall} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {currentSession.chatName || (isVideo ? 'Video Call' : 'Voice Call')}
          </Text>
          {isConnected && (
            <Text style={styles.durationText}>
              {formatDuration(callDuration)} • {allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        {isConnected ? (
          <>
            {isVideo ? (
              <ScrollView 
                contentContainerStyle={styles.gridContainer}
                horizontal={false}
                pagingEnabled={false}
              >
                <View style={[styles.grid, { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }]}>
                  {allParticipants.map((participant, index) => (
                    <View 
                      key={participant.id} 
                      style={[
                        styles.tile, 
                        { width: tileWidth, height: tileHeight }
                      ]}
                    >
                      <ParticipantTile 
                        participant={participant} 
                        isLocal={participant.id === 'local'}
                        isMuted={participant.isMuted}
                      />
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <FlatList
                data={allParticipants}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.voiceParticipant}>
                    <View style={styles.voiceAvatar}>
                      <Ionicons name="person" size={32} color="#FFFFFF" />
                    </View>
                    <Text style={styles.voiceName}>
                      {item.id === 'local' ? 'You' : item.userId}
                    </Text>
                    {item.isMuted && (
                      <Ionicons name="mic-off" size={16} color="#FF3B30" />
                    )}
                  </View>
                )}
                contentContainerStyle={styles.voiceList}
              />
            )}
          </>
        ) : (
          <View style={styles.ringingContainer}>
            <Animated.View 
              style={[styles.avatarWrapper, { transform: [{ scale: pulseAnim }] }]}
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

      <View style={styles.controls}>
        {isConnected && (
          <>
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

            {isVideo && (
              <Pressable
                style={[styles.controlButton, isScreenSharing && styles.screenShareButton]}
                onPress={handleScreenShare}
              >
                <Ionicons 
                  name={isScreenSharing ? 'tv' : 'tv-outline'} 
                  size={24} 
                  color="#FFFFFF" 
                />
              </Pressable>
            )}

            {isVideo && (
              <Pressable
                style={styles.controlButton}
                onPress={handleSwitchCamera}
              >
                <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
              </Pressable>
            )}
          </>
        )}

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
  },
  gridContainer: {
    padding: 16,
  },
  grid: {
    justifyContent: 'flex-start',
  },
  tile: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
  },
  participantTile: {
    flex: 1,
  },
  participantVideo: {
    flex: 1,
  },
  participantPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a3e',
  },
  participantOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mutedIndicator: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
    borderRadius: 10,
    padding: 4,
  },
  participantName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flex: 1,
    marginLeft: 4,
  },
  voiceList: {
    padding: 16,
  },
  voiceParticipant: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 8,
  },
  voiceAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 132, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  voiceName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  ringingContainer: {
    flex: 1,
    justifyContent: 'center',
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
  ringingText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    gap: 12,
    paddingBottom: 50,
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  screenShareButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.8)',
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
