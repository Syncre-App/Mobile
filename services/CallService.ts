import { Platform, AppState, AppStateStatus } from 'react-native';
import CallKeep, { RNCallKeep } from 'react-native-callkeep';
import { webRTCService, CallType, CallStatus, CallParticipant } from './WebRTCService';
import WebSocketService from './WebSocketService';
import CryptoService from './CryptoService';
import { StorageService } from './StorageService';
import { e2eEncryptionService } from './E2EEncryptionService';
import { voipPushService } from './VoIPPushService';

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
  ios: {
    appName: 'Syncre',
    imageName: 'syncre_icon',
    supportsVideo: true,
    maximumCallGroups: 1,
    maximumCallsPerCallGroup: 1,
    audioSessionMode: 'voiceChat',
    audioSessionCategory: 'playAndRecord',
    audioSessionCategoryOptions: 'allowBluetooth allowBluetoothA2DP',
    audioSessionActive: true,
    acceptsHeldCalls: false,
    supportsDTMF: true,
    supportsGrouping: false,
    supportsUngrouping: false,
    ringtoneSound: 'ringtone.caf',
  },
  android: {
    appName: 'Syncre',
    imageName: 'syncre_icon',
    supportsVideo: true,
    maximumCallGroups: 1,
    maximumCallsPerCallGroup: 1,
    autoAcceptSameContacts: true,
    audioSessionMode: 'voiceChat',
    audioSessionActive: true,
    acceptsHeldCalls: false,
    supportsDTMF: true,
    supportsGrouping: false,
    supportsUngrouping: false,
  },
};

class CallService {
  private currentSession: CallSession | null = null;
  private callListeners: Set<(session: CallSession | null) => void> = new Set();
  private wsService: WebSocketService | null = null;
  private callKeepInitialized = false;
  private appStateSubscription: any = null;

  async initialize(): Promise<void> {
    if (this.callKeepInitialized) return;

    try {
      if (Platform.OS === 'ios') {
        await CallKeep.setup(CALL_KEEP_OPTIONS.ios);
        CallKeep.setAvailable(true);
      } else if (Platform.OS === 'android') {
        await CallKeep.setup(CALL_KEEP_OPTIONS.android);
        CallKeep.setAvailable(true);
      }

      this.setupCallKeepEvents();
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
      
      await voipPushService.initialize();

      this.callKeepInitialized = true;
      console.log('[CallService] Initialized successfully');
    } catch (error) {
      console.error('[CallService] Failed to initialize:', error);
    }
  }

  setWebSocketService(ws: WebSocketService): void {
    this.wsService = ws;
    this.setupWebSocketListeners();
  }

  private setupCallKeepEvents(): void {
    CallKeep.addEventListener('answerCall', ({ callUUID }) => {
      console.log('[CallService] Answer call:', callUUID);
      this.handleAnswerCall(callUUID);
    });

    CallKeep.addEventListener('endCall', ({ callUUID }) => {
      console.log('[CallService] End call:', callUUID);
      this.handleEndCall(callUUID);
    });

    CallKeep.addEventListener('didPerformSetHeldCall', ({ callUUID, held }) => {
      console.log('[CallService] Held call:', callUUID, held);
    });

    CallKeep.addEventListener('didPerformDTMFCallAction', ({ callUUID, digits }) => {
      console.log('[CallService] DTMF:', callUUID, digits);
    });

    CallKeep.addEventListener('didDisplayIncomingCall', ({ error }) => {
      if (error) {
        console.error('[CallService] Display incoming call error:', error);
      }
    });

    CallKeep.addEventListener('didConfirmCall', ({ callUUID }) => {
      console.log('[CallService] Confirmed call:', callUUID);
    });
  }

  private setupWebSocketListeners(): void {
    if (!this.wsService) return;

    this.wsService.on('call_ringing', (payload: any) => {
      this.handleIncomingCallRinging(payload);
    });

    this.wsService.on('call_offer', (payload: any) => {
      this.handleIncomingCallOffer(payload);
    });

    this.wsService.on('call_answered', (payload: any) => {
      this.handleCallAnswered(payload);
    });

    this.wsService.on('call_ice', (payload: any) => {
      this.handleIceCandidate(payload);
    });

    this.wsService.on('call_ended', (payload: any) => {
      this.handleCallEnded(payload);
    });

    this.wsService.on('call_participant_joined', (payload: any) => {
      this.handleParticipantJoined(payload);
    });

    this.wsService.on('call_participant_left', (payload: any) => {
      this.handleParticipantLeft(payload);
    });

    this.wsService.on('call_mute_changed', (payload: any) => {
      this.handleMuteChanged(payload);
    });
  }

  async initiateCall(chatId: string, callType: CallType, enableE2E: boolean = true): Promise<boolean> {
    try {
      const stream = await webRTCService.startLocalStream(callType);
      if (!stream) {
        console.error('[CallService] Failed to start local stream');
        return false;
      }

      if (enableE2E) {
        await webRTCService.enableE2EEncryption('');
      }

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

      // Show outgoing call UI via CallKeep
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        CallKeep.startCall(callId, 'Syncre', 'Syncre Call', 'generic', callType === 'video');
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

      // Update CallKeep
      CallKeep.answerCall(callId);

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

    if (this.currentSession?.isE2EEnabled) {
      webRTCService.disableE2EEncryption();
    }

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
        type: 'audio',
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
        type: 'video',
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
