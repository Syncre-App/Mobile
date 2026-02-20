import { Platform } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
  MediaStreamTrack,
} from 'react-native-webrtc';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export type CallType = 'audio' | 'video';

export interface SFUParticipant {
  id: string;
  userId: string;
  producerId?: string;
  consumerId?: string;
  stream?: MediaStream;
  isMuted: boolean;
  isVideoEnabled: boolean;
}

export interface SFURoomState {
  roomId: string;
  isConnected: boolean;
  localProducerId: string | null;
  participants: Map<string, SFUParticipant>;
}

type SFUEventCallback = (event: string, data: any) => void;

class SFUService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private localProducerId: string | null = null;
  private roomId: string | null = null;
  private participants: Map<string, SFUParticipant> = new Map();
  private eventCallback: SFUEventCallback | null = null;
  private isConnected = false;

  setEventCallback(callback: SFUEventCallback): void {
    this.eventCallback = callback;
  }

  private emit(event: string, data: any): void {
    if (this.eventCallback) {
      this.eventCallback(event, data);
    }
  }

  async startLocalStream(callType: CallType): Promise<MediaStream | null> {
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
      console.error('[SFU] Error starting local stream:', error);
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

  async joinRoom(roomId: string, serverUrl: string): Promise<boolean> {
    this.roomId = roomId;
    
    try {
      // Create peer connection for consuming remote streams
      const config: RTCConfiguration = {
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 10,
      };

      this.peerConnection = new RTCPeerConnection(config);

      (this.peerConnection as any).onicecandidate = (event: any) => {
        if (event.candidate) {
          this.emit('ice-candidate', {
            candidate: event.candidate,
            roomId: this.roomId,
          });
        }
      };

      (this.peerConnection as any).ontrack = (event: any) => {
        const streams = event.streams;
        if (streams && streams[0]) {
          const participantId = streams[0].id || 'unknown';
          const participant = this.participants.get(participantId);
          if (participant) {
            participant.stream = streams[0];
            this.emit('remote-stream', {
              participantId,
              stream: streams[0],
            });
          }
        }
      };

      (this.peerConnection as any).oniceconnectionstatechange = () => {
        const state = this.peerConnection?.iceConnectionState;
        console.log('[SFU] ICE connection state:', state);
        this.emit('connection-state', { state });
      };

      this.isConnected = true;
      this.emit('joined', { roomId });
      
      return true;
    } catch (error) {
      console.error('[SFU] Error joining room:', error);
      return false;
    }
  }

  async createProducerTransport(): Promise<any> {
    // Request transport params from server
    // This would typically be an API call to get WebRTC transport parameters
    return {
      iceServers: ICE_SERVERS,
    };
  }

  async produce(kind: 'audio' | 'video'): Promise<string | null> {
    if (!this.localStream || !this.roomId) {
      console.error('[SFU] No local stream or not in room');
      return null;
    }

    const track = kind === 'audio' 
      ? this.localStream.getAudioTracks()[0]
      : this.localStream.getVideoTracks()[0];

    if (!track) {
      console.error('[SFU] No track found for kind:', kind);
      return null;
    }

    // In a full implementation, we would send the offer to the SFU
    // and get back the answer with producer ID
    this.localProducerId = `producer_${Date.now()}`;
    
    this.emit('produced', {
      producerId: this.localProducerId,
      kind,
    });

    return this.localProducerId;
  }

  async consume(peerId: string, producerId: string): Promise<boolean> {
    if (!this.peerConnection) {
      console.error('[SFU] No peer connection');
      return false;
    }

    try {
      // Request consumer from server
      // The server would create a consumer and send us the params
      const consumerParams = await this.requestConsumerFromServer(peerId, producerId);
      
      if (consumerParams) {
        const consumer = await this.peerConnection.addTrack(consumerParams.track, this.localStream!);
        
        const participant: SFUParticipant = {
          id: peerId,
          userId: peerId,
          producerId,
          consumerId: consumer.id,
          stream: this.localStream || undefined,
          isMuted: false,
          isVideoEnabled: true,
        };

        this.participants.set(peerId, participant);
        this.emit('consumer-created', { peerId, producerId });
      }

      return true;
    } catch (error) {
      console.error('[SFU] Error creating consumer:', error);
      return false;
    }
  }

  private async requestConsumerFromServer(peerId: string, producerId: string): Promise<any> {
    // Placeholder - in production this would call the SFU API
    // The SFU would create a consumer and return the parameters
    return null;
  }

  async addIceCandidate(candidate: RTCIceCandidate): Promise<boolean> {
    if (!this.peerConnection) {
      return false;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      return true;
    } catch (error) {
      console.error('[SFU] Error adding ICE candidate:', error);
      return false;
    }
  }

  async setRemoteDescription(description: RTCSessionDescription): Promise<boolean> {
    if (!this.peerConnection) {
      return false;
    }

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(description));
      return true;
    } catch (error) {
      console.error('[SFU] Error setting remote description:', error);
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
        // @ts-ignore - _switchCamera exists but not in types
        videoTracks[0]._switchCamera();
      }
    }
  }

  getParticipants(): Map<string, SFUParticipant> {
    return this.participants;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRoomId(): string | null {
    return this.roomId;
  }

  isInRoom(): boolean {
    return this.isConnected;
  }

  async leaveRoom(): Promise<void> {
    this.stopLocalStream();

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.localProducerId = null;
    this.participants.clear();
    this.roomId = null;
    this.isConnected = false;

    this.emit('left', { roomId: this.roomId });
  }

  cleanup(): void {
    this.leaveRoom();
  }
}

export const sfuService = new SFUService();
export default sfuService;
