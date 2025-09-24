export interface UserStatus {
  [userId: string]: 'online' | 'offline' | 'away';
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private messageListeners: ((message: WebSocketMessage) => void)[] = [];
  private statusListeners: ((statuses: UserStatus) => void)[] = [];
  private userStatuses: UserStatus = {};
  private isConnected = false;
  private currentToken: string | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private maxReconnectAttempts = 5;
  private reconnectAttempts = 0;

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('🌐 WebSocket already connected');
      return;
    }

    try {
      console.log('🌐 Connecting to WebSocket...');
      
      // Import StorageService dynamically to avoid circular dependency
      const { StorageService } = await import('./StorageService');
      const token = await StorageService.getAuthToken();
      
      if (!token) {
        console.log('❌ No auth token found for WebSocket');
        return;
      }

      this.currentToken = token;
      
      // Connect to WebSocket
      this.ws = new WebSocket('wss://api.syncre.xyz/ws');
      
      this.ws.onopen = () => {
        console.log('🌐 WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Authenticate
        this.send({
          type: 'auth',
          data: { token: this.currentToken }
        });
        
        // Start ping/pong
        this.startPingPong();
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

      this.ws.onclose = () => {
        console.log('🌐 WebSocket disconnected');
        this.isConnected = false;
        this.cleanup();
        
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnected = false;
      };

    } catch (error) {
      console.error('❌ Failed to connect to WebSocket:', error);
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
    this.currentToken = null;
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
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    console.log(`🔄 Scheduling WebSocket reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectInterval = setTimeout(() => {
      this.connect();
    }, delay);
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
      case 'pong':
        // Pong received, connection is alive
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
        
      case 'message':
        // Handle chat messages
        break;
        
      default:
        console.log('🌐 Received WebSocket message:', message);
    }
  }

  private notifyStatusListeners(): void {
    this.statusListeners.forEach(listener => listener(this.userStatuses));
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ Cannot send message: WebSocket not connected');
    }
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
    this.send({
      type: 'request_friends_status'
    });
  }
}

// Export singleton instance
export const webSocketService = WebSocketService.getInstance();
