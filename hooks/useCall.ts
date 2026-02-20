import { useState, useEffect, useCallback } from 'react';
import { callService, CallSession, CallType } from '../services/CallService';
import { useFocusEffect } from '@react-navigation/native';

export interface UseCallReturn {
  currentSession: CallSession | null;
  isInCall: boolean;
  callStatus: string;
  initiateCall: (chatId: string, callType: CallType) => Promise<boolean>;
  answerCall: () => Promise<boolean>;
  endCall: () => Promise<void>;
  toggleMute: () => boolean;
  toggleVideo: () => boolean;
  switchCamera: () => Promise<void>;
}

export const useCall = (): UseCallReturn => {
  const [currentSession, setCurrentSession] = useState<CallSession | null>(null);

  useFocusEffect(
    useCallback(() => {
      // Initialize call service when screen is focused
      callService.initialize();

      // Subscribe to session updates
      const unsubscribe = callService.subscribe((session) => {
        setCurrentSession(session);
      });

      return () => {
        unsubscribe();
      };
    }, [])
  );

  useEffect(() => {
    // Set initial session state
    setCurrentSession(callService.getCurrentSession());
  }, []);

  const initiateCall = useCallback(async (chatId: string, callType: CallType): Promise<boolean> => {
    return await callService.initiateCall(chatId, callType);
  }, []);

  const answerCall = useCallback(async (): Promise<boolean> => {
    if (!currentSession) return false;
    return await callService.answerCall(currentSession.callId);
  }, [currentSession]);

  const endCall = useCallback(async (): Promise<void> => {
    await callService.endCall();
  }, []);

  const toggleMute = useCallback((): boolean => {
    return callService.toggleMute();
  }, []);

  const toggleVideo = useCallback((): boolean => {
    return callService.toggleVideo();
  }, []);

  const switchCamera = useCallback(async (): Promise<void> => {
    await callService.switchCamera();
  }, []);

  return {
    currentSession,
    isInCall: currentSession?.status === 'connected',
    callStatus: currentSession?.status || 'idle',
    initiateCall,
    answerCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera,
  };
};

export default useCall;
