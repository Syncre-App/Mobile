export interface UserStatus {
  [userId: string]: 'online' | 'offline' | 'away';
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
  token?: string; // For auth messages
  chatId?: string | number;
  [key: string]: any;
}

import { DeviceEventEmitter } from 'react-native';
import { ReencryptionService } from './ReencryptionService';
import { TimezoneService } from './TimezoneService';

export class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private messageListeners: ((message: WebSocketMessage) => void)[] = [];
  private statusListeners: ((statuses: UserStatus) => void)[] = [];
  private userStatuses: UserStatus = {};
  private isConnected = false;
  private isConnecting = false;
  private isAuthenticated = false;
  private currentToken: string | null = null;
  private reconnectInterval: number | null = null;
  private pingInterval: number | null = null;
  private authFlushTimer: number | null = null;
  private maxReconnectAttempts = 5;
  private reconnectAttempts = 0;
  private joinedChats: Map<string, string | undefined> = new Map();
  private typingListeners: Map<string, ((payload: { userId: string; username: string }) => void)[]> = new Map();
  private stopTypingListeners: Map<string, ((payload: { userId: string }) => void)[]> = new Map();
  private connectionStatusListeners: ((isConnected: boolean) => void)[] = [];
  private pendingMessages: WebSocketMessage[] = [];

  public get socket(): WebSocket | null {
    return this.ws;
  }

  public get connected(): boolean {
    return this.isConnected;
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) {
      if (this.isConnected) {
        console.log('🌐 WebSocket already connected');
      }
      return;
    }

    this.isConnecting = true;

    try {
      console.log('🌐 Connecting to WebSocket...');
      
      // Import StorageService dynamically to avoid circular dependency
      const { StorageService } = await import('./StorageService');
      const token = await StorageService.getAuthToken();
      
      if (!token) {
        console.log('❌ No auth token found for WebSocket');
        this.isConnecting = false;
        return;
      }

      this.currentToken = token;
      
      // According to the WebSocket API documentation, connect first then authenticate with auth message
      // Don't include token in URL - server expects auth message within 5 seconds
      const wsUrl = `wss://api.syncre.xyz/ws`;
      console.log('🌐 WebSocket URL:', wsUrl);

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (err) {
        console.error('❌ WebSocket constructor failed:', err);
        throw err;
      }
      
      this.ws.onopen = () => {
        console.log('🌐 WebSocket connected');
        this.isAuthenticated = false;
        // Send authentication immediately as per API documentation
        // Must authenticate within 5 seconds or connection will close with code 4001
        if (this.currentToken) {
          this.sendAuthRaw(this.currentToken);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
          
          // Notify message listeners
          this.messageListeners.forEach(listener => listener(message));
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('🌐 WebSocket disconnected', event?.code, event?.reason);
        this.isConnected = false;
        this.isConnecting = false;
        this.isAuthenticated = false;
        this.cleanup();
        this.notifyConnectionStatusListeners(false);
        
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnected = false;
        this.isConnecting = false;
        this.isAuthenticated = false;
        this.notifyConnectionStatusListeners(false);
      };

    } catch (error) {
      console.error('❌ Failed to connect to WebSocket:', error);
      this.isConnecting = false;
    }
  }

  disconnect(): void {
    console.log('🌐 Disconnecting WebSocket...');
    this.cleanup();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    this.isAuthenticated = false;
    this.currentToken = null;
    this.notifyConnectionStatusListeners(false);
  }

  private cleanup(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.authFlushTimer) {
      clearTimeout(this.authFlushTimer);
      this.authFlushTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s

    console.log(`🔄 Scheduling WebSocket reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    // Use setTimeout (returns number) and store id
    this.reconnectInterval = setTimeout(() => {
      this.connect();
    }, delay) as unknown as number;
  }

  private sendAuth(token: string): void {
    const authPayload: WebSocketMessage = {
      type: 'auth',
      token,
      data: { token },
      timezone: TimezoneService.getTimezone(),
    };
    this.send(authPayload);
    console.log('🌐 Sent auth message with token payload');
  }

  // Send without queuing, used immediately on open to avoid auth timeout
  private sendAuthRaw(token: string): void {
    const payload = {
      type: 'auth',
      token,
      data: { token },
      timezone: TimezoneService.getTimezone(),
    };
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(payload));
        console.log('🌐 Sent auth message with token payload (raw)');
      } else {
        this.sendAuth(token);
      }
    } catch (error) {
      console.error('❌ Failed to send raw auth payload:', error);
      this.sendAuth(token);
    }
  }

  private startPingPong(): void {
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Ping every 30 seconds
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'auth_success':
        this.isConnected = true;
        this.isConnecting = false;
        this.isAuthenticated = true;
        this.reconnectAttempts = 0;
        this.notifyConnectionStatusListeners(true);
        this.startPingPong();
        if (this.authFlushTimer) {
          clearTimeout(this.authFlushTimer);
        }
        this.authFlushTimer = setTimeout(() => {
          this.flushPendingMessages();
          this.rejoinChats();
        }, 100) as unknown as number;
        break;
      case 'error':
        console.error('❌ WebSocket server error:', message);
        if (/auth/i.test(message.message || '') || /token/i.test(message.message || '')) {
          this.isConnected = false;
          this.isAuthenticated = false;
          this.notifyConnectionStatusListeners(false);
        }
        break;
      case 'pong':
        break;
      case 'user_status_update':
        if (message.data) {
          this.userStatuses[message.data.userId] = message.data.status;
          this.notifyStatusListeners();
        }
        break;
      case 'bulk_status_update':
        if (message.data && message.data.statuses) {
          this.userStatuses = { ...this.userStatuses, ...message.data.statuses };
          this.notifyStatusListeners();
        }
        break;
      case 'friend_status_change':
        if (message.userId && message.status) {
          this.userStatuses = {
            ...this.userStatuses,
            [message.userId]: message.status,
          };
          this.notifyStatusListeners();
        }
        break;
      case 'typing':
        this.handleTyping(message);
        break;
      case 'stop-typing':
        this.handleStopTyping(message);
        break;
      case 'request_reencrypt':
        ReencryptionService.handleRequest({
          chatId: message.chatId ?? message.data?.chatId,
          targetUserId: message.targetUserId ?? message.data?.targetUserId,
          targetDeviceId: message.targetDeviceId ?? message.data?.targetDeviceId,
        });
        break;
      case 'envelopes_appended':
        DeviceEventEmitter.emit('chat:envelopes_appended', {
          chatId: message.chatId ?? message.data?.chatId,
          messageId: message.messageId ?? message.data?.messageId,
        });
        break;
      default:
        break;
    }
  }

  private notifyStatusListeners(): void {
    this.statusListeners.forEach(listener => listener(this.userStatuses));
  }

  private flushPendingMessages(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    while (this.pendingMessages.length) {
      const next = this.pendingMessages.shift();
      if (next) {
        try {
          const payload = this.enrichWithTimezone(next);
          this.ws.send(JSON.stringify(payload));
        } catch (error) {
          console.error('❌ Failed to send pending WebSocket message:', error);
          this.pendingMessages.unshift(next);
          break;
        }
      }
    }
  }

  send(message: WebSocketMessage): void {
    if (!this.isConnected && !this.isConnecting) {
      // Best-effort connect so queued messages can flush
      this.connect().catch((error) => console.error('❌ WebSocket connect failed during send:', error));
    }
    const payload = this.enrichWithTimezone(message);
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isConnected) {
      this.ws.send(JSON.stringify(payload));
      return;
    }

    console.warn('⚠️ WebSocket not ready, queueing message', message.type);
    this.pendingMessages.push(payload);
  }

  private enrichWithTimezone(message: WebSocketMessage): WebSocketMessage {
    const timezone = TimezoneService.getTimezone();
    if (!timezone || (message && typeof message === 'object' && 'timezone' in message)) {
      return message;
    }
    return { ...message, timezone };
  }

  joinChat(chatId: string, deviceId?: string): void {
    if (!chatId) return;
    if (this.joinedChats.has(chatId)) {
      return;
    }
    this.joinedChats.set(chatId, deviceId);
    this.send({ type: 'chat_join', chatId, deviceId });
  }

  leaveChat(chatId: string): void {
    if (!chatId) return;
    if (!this.joinedChats.has(chatId)) {
      return;
    }
    this.joinedChats.delete(chatId);
    this.send({ type: 'chat_leave', chatId });
  }

  private rejoinChats(): void {
    if (!this.joinedChats.size) {
      return;
    }
    this.joinedChats.forEach((deviceId, chatId) => {
      this.send({ type: 'chat_join', chatId, deviceId });
    });
  }

  private handleTyping(message: WebSocketMessage) {
    console.log('Received typing event:', message);
    const { chatId, userId, username } = message;
    if (chatId) {
      const chatIdStr = chatId.toString();
      if (this.typingListeners.has(chatIdStr)) {
        this.typingListeners.get(chatIdStr)?.forEach(listener => listener({ userId, username }));
      }
    }
  }

  private handleStopTyping(message: WebSocketMessage) {
    console.log('Received stop-typing event:', message);
    const { chatId, userId } = message;
    if (chatId) {
      const chatIdStr = chatId.toString();
      if (this.stopTypingListeners.has(chatIdStr)) {
        this.stopTypingListeners.get(chatIdStr)?.forEach(listener => listener({ userId }));
      }
    }
  }

  public onTyping(chatId: string, callback: (payload: { userId: string; username: string }) => void): () => void {
    if (!this.typingListeners.has(chatId)) {
      this.typingListeners.set(chatId, []);
    }
    this.typingListeners.get(chatId)?.push(callback);

    return () => {
      const listeners = this.typingListeners.get(chatId)?.filter(l => l !== callback);
      this.typingListeners.set(chatId, listeners || []);
    };
  }

  public onStopTyping(chatId: string, callback: (payload: { userId: string }) => void): () => void {
    if (!this.stopTypingListeners.has(chatId)) {
      this.stopTypingListeners.set(chatId, []);
    }
    this.stopTypingListeners.get(chatId)?.push(callback);

    return () => {
      const listeners = this.stopTypingListeners.get(chatId)?.filter(l => l !== callback);
      this.stopTypingListeners.set(chatId, listeners || []);
    };
  }

  public sendTyping(chatId: string) {
    this.send({ type: 'typing', chatId });
  }

  public sendStopTyping(chatId: string) {
    this.send({ type: 'stop-typing', chatId });
  }

  // Message listeners
  addMessageListener(listener: (message: WebSocketMessage) => void): () => void {
    this.messageListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.messageListeners.indexOf(listener);
      if (index > -1) {
        this.messageListeners.splice(index, 1);
      }
    };
  }

  // Status listeners
  addStatusListener(listener: (statuses: UserStatus) => void): () => void {
    this.statusListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.statusListeners.indexOf(listener);
      if (index > -1) {
        this.statusListeners.splice(index, 1);
      }
    };
  }

  // Get current user statuses
  getUserStatuses(): UserStatus {
    return { ...this.userStatuses };
  }

  // Request fresh status for all friends
  refreshFriendsStatus(): void {
    // Disabled until the backend supports this message type
    // this.send({ type: 'request_friends_status' });
  }

  addConnectionStatusListener(listener: (isConnected: boolean) => void): () => void {
    this.connectionStatusListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.connectionStatusListeners.indexOf(listener);
      if (index > -1) {
        this.connectionStatusListeners.splice(index, 1);
      }
    };
  }

  private notifyConnectionStatusListeners(isConnected: boolean): void {
    this.connectionStatusListeners.forEach(listener => listener(isConnected));
  }
}

export const webSocketService = WebSocketService.getInstance();
