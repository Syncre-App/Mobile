import { Platform, AppState, AppStateStatus } from 'react-native';
import CallKeep from 'react-native-callkeep';
import { webRTCService, CallType, CallStatus, CallParticipant } from './WebRTCService';
import { WebSocketService } from './WebSocketService';
import { CryptoService } from './CryptoService';
import { StorageService } from './StorageService';
import { e2eEncryptionService } from './E2EEncryptionService';
import { voipPushService } from './VoIPPushService';

export { CallType, CallStatus } from './WebRTCService';

export interface CallSession {
  callId: string;
  roomId: string;
  chatId: string;
  initiatorId: string;
  callType: CallType;
  status: CallStatus;
  participants: CallParticipant[];
  startedAt?: Date;
  isE2EEnabled?: boolean;
  isGroupCall?: boolean;
  isScreenSharing?: boolean;
  chatName?: string;
}

const CALL_KEEP_OPTIONS = {
  appName: 'Syncre',
} as const;

class CallService {
  private currentSession: CallSession | null = null;
  private callListeners: Set<(session: CallSession | null) => void> = new Set();
  private wsService: WebSocketService | null = null;
  private callKeepInitialized = false;
  private appStateSubscription: any = null;

  async initialize(): Promise<void> {
    if (this.callKeepInitialized) return;

    try {
      await CallKeep.setup(CALL_KEEP_OPTIONS as any);
      CallKeep.setAvailable(true);

      this.setupCallKeepEvents();
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
      
      try {
        await voipPushService.initialize();
      } catch (e) {
        console.warn('[CallService] VoIP push init failed:', e);
      }

      this.callKeepInitialized = true;
      console.log('[CallService] Initialized successfully');
    } catch (error) {
      console.warn('[CallService] Failed to initialize CallKeep:', error);
      // Continue without CallKeep - calls will still work but without native UI
    }
  }

  setWebSocketService(ws: WebSocketService): void {
    this.wsService = ws;
    this.setupWebSocketListeners();
  }

  private setupCallKeepEvents(): void {
    CallKeep.addEventListener('answerCall', (data: { callUUID: string }) => {
      console.log('[CallService] Answer call:', data.callUUID);
      this.handleAnswerCall(data.callUUID);
    });

    CallKeep.addEventListener('endCall', (data: { callUUID: string }) => {
      console.log('[CallService] End call:', data.callUUID);
      this.handleEndCall(data.callUUID);
    });
  }

  private setupWebSocketListeners(): void {
    if (!this.wsService) return;

    this.wsService.addMessageListener((message: any) => {
      switch (message.type) {
        case 'call_ringing':
          this.handleIncomingCallRinging(message);
          break;
        case 'call_offer':
          this.handleIncomingCallOffer(message);
          break;
        case 'call_answered':
          this.handleCallAnswered(message);
          break;
        case 'call_ice':
          this.handleIceCandidate(message);
          break;
        case 'call_ended':
          this.handleCallEnded(message);
          break;
        case 'call_participant_joined':
          this.handleParticipantJoined(message);
          break;
        case 'call_participant_left':
          this.handleParticipantLeft(message);
          break;
        case 'call_mute_changed':
          this.handleMuteChanged(message);
          break;
      }
    });
  }

  async initiateCall(chatId: string, callType: CallType, enableE2E: boolean = true): Promise<boolean> {
    try {
      let stream = null;
      try {
        stream = await webRTCService.startLocalStream(callType);
      } catch (streamError) {
        console.warn('[CallService] Could not start local stream:', streamError);
        // Continue anyway - stream is optional for basic call UI
      }

      // E2E encryption is handled at the WebRTC level

      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const roomId = `room_${chatId}_${callId}`;

      this.currentSession = {
        callId,
        roomId,
        chatId,
        initiatorId: '',
        callType,
        status: 'calling',
        participants: [],
        isE2EEnabled: enableE2E,
      };

      this.notifyListeners();

      // Send call initiation via WebSocket
      if (this.wsService) {
        this.wsService.send({
          type: 'call_initiate',
          chatId,
          callId,
          roomId,
          callType,
          e2eEnabled: enableE2E,
        });
      }

      // Show outgoing call UI via CallKeep (wrapped in try-catch to prevent crashes)
      try {
        if (Platform.OS === 'ios') {
          // iOS: startCall(uuid, handle, contactIdentifier, handleType, hasVideo)
          (CallKeep as any).startCall(
            callId,
            'Syncre User', // handle - needs to be a phone number or identifier
            'Syncre', // contactIdentifier
            'generic', // handleType
            callType === 'video' // hasVideo
          );
        } else if (Platform.OS === 'android') {
          (CallKeep as any).startCall(callId, 'Syncre', 'Syncre Call');
        }
      } catch (callKeepError) {
        console.warn('[CallService] CallKeep startCall failed:', callKeepError);
      }

      console.log('[CallService] Call initiated:', callId);
      return true;
    } catch (error) {
      console.error('[CallService] Error initiating call:', error);
      return false;
    }
  }

  async answerCall(callId: string): Promise<boolean> {
    try {
      console.log('[CallService] Answering call:', callId);

      const stream = await webRTCService.startLocalStream(this.currentSession?.callType || 'audio');
      if (!stream) {
        console.error('[CallService] Failed to start local stream');
        return false;
      }

      if (this.currentSession) {
        this.currentSession.status = 'connected';
      }

      // Answer via WebSocket
      if (this.wsService) {
        const offer = await webRTCService.createOffer();
        if (offer) {
          this.wsService.send({
            type: 'call_answer',
            callId,
            sdp: offer,
          });
        }
      }

      // Update CallKeep - answerCall may not be available in v4
      try {
        (CallKeep as any).answerCall(callId);
      } catch (e) {
        console.log('[CallService] CallKeep answerCall not available');
      }

      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('[CallService] Error answering call:', error);
      return false;
    }
  }

  async endCall(callId?: string): Promise<void> {
    const targetCallId = callId || this.currentSession?.callId;
    if (!targetCallId) return;

    console.log('[CallService] Ending call:', targetCallId);

    // Cleanup WebRTC
    webRTCService.cleanup();

    // Notify via WebSocket
    if (this.wsService) {
      this.wsService.send({
        type: 'call_end',
        callId: targetCallId,
      });
    }

    // End CallKeep call
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      CallKeep.endCall(targetCallId);
    }

    this.currentSession = null;
    this.notifyListeners();
  }

  toggleMute(): boolean {
    const isMuted = webRTCService.toggleMute();
    if (this.currentSession && this.wsService) {
      this.wsService.send({
        type: 'call_mute',
        callId: this.currentSession.callId,
        muted: isMuted,
        mediaType: 'audio',
      });
    }
    return isMuted;
  }

  async startScreenShare(): Promise<boolean> {
    try {
      const screenStream = await webRTCService.startScreenShare();
      if (!screenStream) {
        return false;
      }

      webRTCService.addScreenShareTrack(screenStream);

      if (this.currentSession) {
        this.currentSession.isScreenSharing = true;
        this.notifyListeners();
      }

      if (this.wsService) {
        this.wsService.send({
          type: 'call_screen_share',
          callId: this.currentSession?.callId,
          action: 'started',
        });
      }

      return true;
    } catch (error) {
      console.error('[CallService] Error starting screen share:', error);
      return false;
    }
  }

  stopScreenShare(): void {
    webRTCService.stopScreenShare();

    if (this.currentSession) {
      this.currentSession.isScreenSharing = false;
      this.notifyListeners();
    }

    if (this.wsService) {
      this.wsService.send({
        type: 'call_screen_share',
        callId: this.currentSession?.callId,
        action: 'stopped',
      });
    }
  }

  toggleVideo(): boolean {
    const isVideoEnabled = webRTCService.toggleVideo();
    if (this.currentSession && this.wsService) {
      this.wsService.send({
        type: 'call_mute',
        callId: this.currentSession.callId,
        muted: !isVideoEnabled,
        mediaType: 'video',
      });
    }
    return isVideoEnabled;
  }

  async switchCamera(): Promise<void> {
    await webRTCService.switchCamera();
  }

  // Event Handlers
  private handleAnswerCall(callUUID: string): void {
    if (this.currentSession?.callId === callUUID) {
      this.answerCall(callUUID);
    }
  }

  private handleEndCall(callUUID: string): void {
    this.endCall(callUUID);
  }

  private handleIncomingCallRinging(payload: any): void {
    console.log('[CallService] Call ringing:', payload);
    if (this.currentSession) {
      this.currentSession.status = 'ringing';
      this.notifyListeners();
    }
  }

  private async handleIncomingCallOffer(payload: any): Promise<void> {
    console.log('[CallService] Received offer:', payload);
    
    const { callId, sdp, from } = payload;
    
    this.currentSession = {
      callId,
      roomId: payload.roomId || `room_${payload.chatId}_${callId}`,
      chatId: payload.chatId,
      initiatorId: from,
      callType: payload.callType || 'audio',
      status: 'ringing',
      participants: [],
    };

    this.notifyListeners();

    // Show incoming call UI
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      CallKeep.displayIncomingCall(
        callId,
        'Syncre',
        from,
        'generic',
        payload.callType === 'video'
      );
    }

    // Set remote description
    await webRTCService.setRemoteDescription(sdp);

    // Create and send answer
    const answer = await webRTCService.createAnswer();
    if (answer && this.wsService) {
      this.wsService.send({
        type: 'call_answer',
        callId,
        sdp: answer,
      });
    }
  }

  private handleCallAnswered(payload: any): void {
    console.log('[CallService] Call answered:', payload);
    if (this.currentSession) {
      this.currentSession.status = 'connected';
      this.notifyListeners();
    }
  }

  private async handleIceCandidate(payload: any): Promise<void> {
    console.log('[CallService] ICE candidate received');
    await webRTCService.addIceCandidate(payload.candidate);
  }

  private handleCallEnded(payload: any): void {
    console.log('[CallService] Call ended:', payload);
    webRTCService.cleanup();
    this.currentSession = null;
    this.notifyListeners();

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      CallKeep.endCall(payload.callId);
    }
  }

  private handleParticipantJoined(payload: any): void {
    console.log('[CallService] Participant joined:', payload);
  }

  private handleParticipantLeft(payload: any): void {
    console.log('[CallService] Participant left:', payload);
  }

  private handleMuteChanged(payload: any): void {
    console.log('[CallService] Mute changed:', payload);
  }

  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState === 'active') {
      // App became active
    } else if (nextAppState === 'background') {
      // App went to background - keep call alive
    }
  };

  // Listener management
  subscribe(listener: (session: CallSession | null) => void): () => void {
    this.callListeners.add(listener);
    return () => this.callListeners.delete(listener);
  }

  private notifyListeners(): void {
    this.callListeners.forEach((listener) => listener(this.currentSession));
  }

  getCurrentSession(): CallSession | null {
    return this.currentSession;
  }

  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    webRTCService.cleanup();
    this.currentSession = null;
    this.callListeners.clear();
  }
}

export const callService = new CallService();
export default callService;
