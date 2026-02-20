import React from 'react';
import { View, Text, StyleSheet, Pressable, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCall, CallSession } from '../hooks/useCall';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');

interface CallScreenProps {
  session: CallSession;
}

export const CallScreen: React.FC<CallScreenProps> = ({ session }) => {
  const { endCall, toggleMute, toggleVideo, switchCamera } = useCall();
  
  const isVideo = session.callType === 'video';
  const isConnected = session.status === 'connected';
  const isRinging = session.status === 'ringing' || session.status === 'calling';

  const handleEndCall = () => {
    endCall();
    router.back();
  };

  const handleMute = () => {
    toggleMute();
  };

  const handleVideo = () => {
    if (isVideo) {
      toggleVideo();
    }
  };

  const handleSwitchCamera = () => {
    switchCamera();
  };

  const getStatusText = () => {
    switch (session.status) {
      case 'calling':
        return 'Calling...';
      case 'ringing':
        return 'Ringing...';
      case 'connected':
        return isVideo ? 'In video call' : 'In call';
      case 'ended':
        return 'Call ended';
      default:
        return 'Unknown';
    }
  };

  return (
    <View style={styles.container}>
      {/* Background */}
      <View style={styles.background}>
        <View style={styles.gradient} />
      </View>

      {/* Header info */}
      <View style={styles.header}>
        <Text style={styles.statusText}>{getStatusText()}</Text>
        {session.callType === 'video' && (
          <Text style={styles.callTypeText}>Video call</Text>
        )}
      </View>

      {/* Remote video / Avatar */}
      <View style={styles.remoteContainer}>
        {isVideo && isConnected ? (
          <View style={styles.remoteVideo}>
            {/* Remote video stream would go here */}
            <View style={styles.videoPlaceholder}>
              <Ionicons name="videocam" size={64} color="rgba(255,255,255,0.3)" />
            </View>
          </View>
        ) : (
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={80} color="#FFFFFF" />
            </View>
            <Text style={styles.usernameText}>
              {session.participants[0]?.id || 'User'}
            </Text>
          </View>
        )}
      </View>

      {/* Local video preview (picture-in-picture) */}
      {isVideo && isConnected && (
        <View style={styles.localVideo}>
          <View style={styles.localVideoPlaceholder}>
            <Ionicons name="person" size={32} color="rgba(255,255,255,0.5)" />
          </View>
        </View>
      )}

      {/* Call controls */}
      <View style={styles.controls}>
        {isConnected && (
          <>
            <Pressable
              style={[styles.controlButton, styles.muteButton]}
              onPress={handleMute}
            >
              <Ionicons name="mic-off" size={28} color="#FFFFFF" />
            </Pressable>

            {isVideo && (
              <Pressable
                style={[styles.controlButton, styles.videoButton]}
                onPress={handleVideo}
              >
                <Ionicons name="videocam-off" size={28} color="#FFFFFF" />
              </Pressable>
            )}

            {isVideo && (
              <Pressable
                style={[styles.controlButton, styles.switchButton]}
                onPress={handleSwitchCamera}
              >
                <Ionicons name="camera-reverse" size={28} color="#FFFFFF" />
              </Pressable>
            )}
          </>
        )}

        <Pressable
          style={[styles.controlButton, styles.endCallButton]}
          onPress={handleEndCall}
        >
          <Ionicons name="call" size={32} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  statusText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  callTypeText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  remoteContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  remoteVideo: {
    width: width,
    height: height * 0.5,
    backgroundColor: '#2a2a3e',
    borderRadius: 16,
    overflow: 'hidden',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(30, 132, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  usernameText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 20,
  },
  localVideo: {
    position: 'absolute',
    top: 120,
    right: 20,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2a2a3e',
  },
  localVideoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 50,
    gap: 16,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  muteButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  videoButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  switchButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  endCallButton: {
    backgroundColor: '#FF3B30',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
});

export default CallScreen;
