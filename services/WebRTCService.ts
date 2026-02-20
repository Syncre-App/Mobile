import { Platform, PermissionsAndroid, Alert } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
  MediaStreamTrack,
  AudioVideoFacade,
  RTCRtpSender,
  RTCRtpReceiver,
} from 'react-native-webrtc';
import { e2eEncryptionService } from './E2EEncryptionService';
import { sframeManager } from './SFrameManager';

export type CallType = 'audio' | 'video';
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

export interface CallParticipant {
  id: string;
  stream: MediaStream | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
}

export interface CallState {
  callId: string | null;
  roomId: string | null;
  status: CallStatus;
  callType: CallType;
  participants: Map<string, CallParticipant>;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeakerOn: boolean;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private onRemoteStream: ((userId: string, stream: MediaStream | null) => void) | null = null;
  private onConnectionStateChange: ((state: string) => void) | null = null;

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      return true;
    }

    try {
      const cameraGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'Syncre needs camera access for video calls',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      const micGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'Syncre needs microphone access for voice calls',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      return (
        cameraGranted === PermissionsAndroid.RESULTS.GRANTED &&
        micGranted === PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (err) {
      console.error('Permission request error:', err);
      return false;
    }
  }

  async startLocalStream(callType: CallType): Promise<MediaStream | null> {
    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      Alert.alert('Permission Required', 'Camera and microphone permissions are required for calls');
      return null;
    }

    try {
      const constraints: any = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: callType === 'video' ? {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        } : false,
      };

      const stream = await mediaDevices.getUserMedia(constraints);
      this.localStream = stream as MediaStream;
      return this.localStream;
    } catch (error) {
      console.error('Error starting local stream:', error);
      return null;
    }
  }

  stopLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
      });
      this.localStream = null;
    }
  }

  createPeerConnection(
    onRemoteStreamCallback: (userId: string, stream: MediaStream | null) => void,
    onStateChange?: (state: string) => void
  ): RTCPeerConnection {
    this.onRemoteStream = onRemoteStreamCallback;
    this.onConnectionStateChange = onStateChange || null;

    const config: RTCConfiguration = {
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    };

    this.peerConnection = new RTCPeerConnection(config);

    this.peerConnection.onicecandidate = (event: any) => {
      if (event.candidate) {
        this.handleIceCandidate(event.candidate);
      }
    };

    this.peerConnection.ontrack = (event: any) => {
      const streams = event.streams;
      if (streams && streams[0]) {
        const userId = streams[0].id || 'unknown';
        this.remoteStreams.set(userId, streams[0]);
        if (this.onRemoteStream) {
          this.onRemoteStream(userId, streams[0]);
        }
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('ICE Connection State:', state);
      if (this.onConnectionStateChange && state) {
        this.onConnectionStateChange(state);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('Peer Connection State:', state);
      if (this.onConnectionStateChange && state) {
        this.onConnectionStateChange(state);
      }
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach((track: MediaStreamTrack) => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });
    }

    return this.peerConnection;
  }

  async enableE2EEncryption(userId: string): Promise<boolean> {
    try {
      await e2eEncryptionService.generateKey();
      
      console.log('[WebRTC] E2E encryption enabled');
      return true;
    } catch (error) {
      console.error('[WebRTC] Failed to enable E2E encryption:', error);
      return false;
    }
  }

  disableE2EEncryption(): void {
    e2eEncryptionService.clearKeys();
    sframeManager.reset();
    console.log('[WebRTC] E2E encryption disabled');
  }

  getE2EKeyForSharing(): Promise<ArrayBuffer | null> {
    const keyId = e2eEncryptionService.getCurrentKeyId();
    if (!keyId) return Promise.resolve(null);
    return e2eEncryptionService.exportKey(keyId);
  }

  async importE2EKey(keyId: string, keyData: ArrayBuffer): Promise<boolean> {
    return e2eEncryptionService.importKey(keyId, keyData);
  }

  private handleIceCandidate(candidate: RTCIceCandidate): void {
    // Will be implemented with signaling
    console.log('ICE Candidate:', candidate);
  }

  async createOffer(): Promise<RTCSessionDescription | null> {
    if (!this.peerConnection) {
      console.error('Peer connection not initialized');
      return null;
    }

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this.peerConnection.setLocalDescription(offer);
      return offer as RTCSessionDescription;
    } catch (error) {
      console.error('Error creating offer:', error);
      return null;
    }
  }

  async createAnswer(): Promise<RTCSessionDescription | null> {
    if (!this.peerConnection) {
      console.error('Peer connection not initialized');
      return null;
    }

    try {
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      return answer as RTCSessionDescription;
    } catch (error) {
      console.error('Error creating answer:', error);
      return null;
    }
  }

  async setRemoteDescription(description: RTCSessionDescription): Promise<boolean> {
    if (!this.peerConnection) {
      console.error('Peer connection not initialized');
      return false;
    }

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(description));
      return true;
    } catch (error) {
      console.error('Error setting remote description:', error);
      return false;
    }
  }

  async addIceCandidate(candidate: RTCIceCandidate): Promise<boolean> {
    if (!this.peerConnection) {
      console.error('Peer connection not initialized');
      return false;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      return true;
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
      return false;
    }
  }

  toggleMute(): boolean {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach((track: MediaStreamTrack) => {
        track.enabled = !track.enabled;
      });
      return !audioTracks[0]?.enabled;
    }
    return false;
  }

  toggleVideo(): boolean {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach((track: MediaStreamTrack) => {
        track.enabled = !track.enabled;
      });
      return !videoTracks[0]?.enabled;
    }
    return false;
  }

  async switchCamera(): Promise<void> {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        // @ts-ignore - _switchCamera is not in types but exists
        videoTracks[0]._switchCamera();
      }
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStreams(): Map<string, MediaStream> {
    return this.remoteStreams;
  }

  closePeerConnection(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteStreams.clear();
    this.onRemoteStream = null;
    this.onConnectionStateChange = null;
  }

  cleanup(): void {
    this.stopLocalStream();
    this.closePeerConnection();
  }
}

export const webRTCService = new WebRTCService();
export default webRTCService;
