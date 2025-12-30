import { API_CONFIG } from '../../constants/config';
import {
  WSMessage,
  WSAuthMessage,
  WSChatJoinMessage,
  WSChatLeaveMessage,
  WSChatMessage,
  WSTypingMessage,
  WSMessageSeenMessage,
  WSPingMessage,
} from './types';

type MessageHandler = (message: WSMessage) => void;
type ConnectionHandler = () => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private isConnected = false;
  private isAuthenticated = false;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private connectHandlers: Set<ConnectionHandler> = new Set();
  private disconnectHandlers: Set<ConnectionHandler> = new Set();
  private authResolve: (() => void) | null = null;
  private authReject: ((error: Error) => void) | null = null;

  /**
   * Connect to WebSocket server
   */
  async connect(token: string): Promise<void> {
    if (this.ws && this.isConnected) {
      console.log('WebSocket already connected');
      return;
    }

    this.token = token;
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(API_CONFIG.WS_URL);

        // Auth timeout
        const authTimeout = setTimeout(() => {
          reject(new Error('Authentication timeout'));
          this.disconnect();
        }, API_CONFIG.WS_AUTH_TIMEOUT);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;

          // Send auth message
          this.send({
            type: 'auth',
            token: this.token,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          } as WSAuthMessage);

          // Set up auth resolve
          this.authResolve = () => {
            clearTimeout(authTimeout);
            resolve();
          };
          this.authReject = (error) => {
            clearTimeout(authTimeout);
            reject(error);
          };
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.handleDisconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.stopPing();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.isAuthenticated = false;
  }

  /**
   * Send a message through WebSocket
   */
  send(message: WSMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message');
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Join a chat room
   */
  joinChat(chatId: number, deviceId?: string): void {
    this.send({
      type: 'chat_join',
      chatId,
      deviceId,
    } as WSChatJoinMessage);
  }

  /**
   * Leave a chat room
   */
  leaveChat(chatId: number): void {
    this.send({
      type: 'chat_leave',
      chatId,
    } as WSChatLeaveMessage);
  }

  /**
   * Send a chat message
   */
  sendMessage(params: Omit<WSChatMessage, 'type'>): void {
    this.send({
      type: 'chat_message',
      ...params,
    } as WSChatMessage);
  }

  /**
   * Send typing indicator
   */
  sendTyping(chatId: number, isTyping: boolean): void {
    this.send({
      type: isTyping ? 'typing' : 'stop-typing',
      chatId,
    } as WSTypingMessage);
  }

  /**
   * Mark message as seen
   */
  markMessageSeen(chatId: number, messageId: number): void {
    this.send({
      type: 'message_seen',
      chatId,
      messageId,
    } as WSMessageSeenMessage);
  }

  /**
   * Register a message handler for a specific type
   */
  on(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  /**
   * Register a connection handler
   */
  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  /**
   * Register a disconnection handler
   */
  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  /**
   * Check if connected and authenticated
   */
  isReady(): boolean {
    return this.isConnected && this.isAuthenticated;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WSMessage): void {
    // Handle auth response
    if (message.type === 'auth_success') {
      this.isAuthenticated = true;
      this.startPing();
      this.connectHandlers.forEach(handler => handler());
      this.authResolve?.();
      return;
    }

    if (message.type === 'error' && !this.isAuthenticated) {
      this.authReject?.(new Error(message.message || 'Authentication failed'));
      return;
    }

    if (message.type === 'pong') {
      // Pong received, connection is alive
      return;
    }

    // Dispatch to registered handlers
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }

    // Also dispatch to wildcard handlers
    const wildcardHandlers = this.messageHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => handler(message));
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    this.isConnected = false;
    this.isAuthenticated = false;
    this.stopPing();
    
    this.disconnectHandlers.forEach(handler => handler());

    // Attempt reconnection
    if (this.token && this.reconnectAttempts < API_CONFIG.WS_MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      const delay = API_CONFIG.WS_RECONNECT_DELAY * this.reconnectAttempts;
      
      console.log(`Attempting reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      this.reconnectTimeout = setTimeout(() => {
        if (this.token) {
          this.connect(this.token).catch(error => {
            console.error('Reconnection failed:', error);
          });
        }
      }, delay);
    }
  }

  /**
   * Start ping interval
   */
  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping' } as WSPingMessage);
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

export const wsClient = new WebSocketClient();
