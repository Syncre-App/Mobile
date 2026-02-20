import { Platform, PermissionsAndroid, Alert } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
  MediaStreamTrack,
} from 'react-native-webrtc';

export type CallType = 'audio' | 'video';
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

export interface CallParticipant {
  id: string;
  userId: string;
  stream: MediaStream | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing?: boolean;
  audioLevel?: number;
}

export interface CallState {
  callId: string | null;
  roomId: string | null;
  status: CallStatus;
  callType: CallType;
  participants: Map<string, CallParticipant>;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeakerOn: boolean;
  isScreenSharing: boolean;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

class ScreenShareService {
  private screenStream: MediaStream | null = null;
  private isSharing: boolean = false;

  async startScreenShare(): Promise<MediaStream | null> {
    try {
      if (Platform.OS === 'ios') {
        // iOS requires native implementation for screen capture
        // For now, use front camera as placeholder
        console.log('[ScreenShare] iOS screen share not fully implemented');
        return null;
      }

      if (Platform.OS === 'android') {
        const hasPermissions = await this.requestAndroidPermissions();
        if (!hasPermissions) {
          Alert.alert('Permission Required', 'Screen capture permission is required');
          return null;
        }
      }

      const stream = await (mediaDevices as any).getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
        },
        audio: false,
      });

      this.screenStream = stream as MediaStream;
      this.isSharing = true;

      // Handle stream ended event
      this.screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      return this.screenStream;
    } catch (error) {
      console.error('[ScreenShare] Error starting screen share:', error);
      return null;
    }
  }

  private async requestAndroidPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Screen Capture Permission',
          message: 'Syncre needs screen capture permission to share your screen',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      return false;
    }
  }

  stopScreenShare(): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
      });
      this.screenStream = null;
    }
    this.isSharing = false;
  }

  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  isScreenSharing(): boolean {
    return this.isSharing;
  }
}

export const screenShareService = new ScreenShareService();

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private onRemoteStream: ((userId: string, stream: MediaStream | null) => void) | null = null;
  private onConnectionStateChange: ((state: string) => void) | null = null;
  private participants: Map<string, CallParticipant> = new Map();

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
        
        // Update participant info
        if (this.participants.has(userId)) {
          const participant = this.participants.get(userId)!;
          participant.stream = streams[0];
        } else {
          this.participants.set(userId, {
            id: userId,
            userId,
            stream: streams[0],
            isMuted: false,
            isVideoEnabled: true,
          });
        }
        
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

  addScreenShareTrack(screenStream: MediaStream): void {
    if (this.peerConnection && screenStream) {
      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        const sender = this.peerConnection.getSenders().find((s) => 
          s.track?.kind === 'video'
        );
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      }
    }
  }

  removeScreenShareTrack(): void {
    if (this.peerConnection && this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        const sender = this.peerConnection.getSenders().find((s) => 
          s.track?.kind === 'video'
        );
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      }
    }
  }

  private handleIceCandidate(candidate: RTCIceCandidate): void {
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

  async startScreenShare(): Promise<MediaStream | null> {
    return await screenShareService.startScreenShare();
  }

  stopScreenShare(): void {
    screenShareService.stopScreenShare();
    this.removeScreenShareTrack();
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStreams(): Map<string, MediaStream> {
    return this.remoteStreams;
  }

  getParticipants(): Map<string, CallParticipant> {
    return this.participants;
  }

  addParticipant(participant: CallParticipant): void {
    this.participants.set(participant.id, participant);
  }

  removeParticipant(participantId: string): void {
    this.participants.delete(participantId);
    this.remoteStreams.delete(participantId);
  }

  updateParticipant(participantId: string, updates: Partial<CallParticipant>): void {
    const participant = this.participants.get(participantId);
    if (participant) {
      this.participants.set(participantId, { ...participant, ...updates });
    }
  }

  closePeerConnection(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteStreams.clear();
    this.participants.clear();
    this.onRemoteStream = null;
    this.onConnectionStateChange = null;
  }

  cleanup(): void {
    this.stopLocalStream();
    screenShareService.stopScreenShare();
    this.closePeerConnection();
  }
}

export const webRTCService = new WebRTCService();
export default webRTCService;
