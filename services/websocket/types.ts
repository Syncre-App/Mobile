// WebSocket message types

export interface WSMessage {
  type: string;
  [key: string]: any;
}

// Outgoing messages
export interface WSAuthMessage extends WSMessage {
  type: 'auth';
  token: string;
  timezone?: string;
}

export interface WSChatJoinMessage extends WSMessage {
  type: 'chat_join';
  chatId: number;
  deviceId?: string;
}

export interface WSChatLeaveMessage extends WSMessage {
  type: 'chat_leave';
  chatId: number;
}

export interface WSChatMessage extends WSMessage {
  type: 'chat_message';
  chatId: number;
  content?: string;
  message_type?: string;
  attachments?: number[];
  replyMetadata?: {
    messageId: string;
    senderId: string;
    preview: string;
    senderLabel: string;
  };
  // E2EE fields
  senderDeviceId?: string;
  envelopes?: any[];
  preview?: string;
  expiresIn?: string;
}

export interface WSTypingMessage extends WSMessage {
  type: 'typing' | 'stop-typing';
  chatId: number;
}

export interface WSMessageSeenMessage extends WSMessage {
  type: 'message_seen';
  chatId: number;
  messageId: number;
}

export interface WSPingMessage extends WSMessage {
  type: 'ping';
}

// Incoming messages
export interface WSAuthSuccessMessage extends WSMessage {
  type: 'auth_success';
  message: string;
  user: {
    id: number;
    username: string;
    email: string;
  };
  socketId: string;
}

export interface WSNewMessage extends WSMessage {
  type: 'new_message' | 'message_envelope';
  messageId: number;
  chatId: number;
  senderId: number;
  senderUsername: string;
  senderAvatar?: string;
  senderBadges?: string[];
  content?: string;
  message_type: string;
  created_at: string;
  createdAt: string;
  reply?: any;
  attachments?: any[];
  editedAt?: string;
  deletedAt?: string;
  envelopes?: any[];
}

export interface WSTypingEvent extends WSMessage {
  type: 'typing' | 'stop-typing';
  chatId: number;
  userId: number;
  username: string;
}

export interface WSMessageStatusEvent extends WSMessage {
  type: 'message_status';
  chatId: number;
  messageId: number;
  status: 'sent' | 'delivered' | 'seen';
  timestamp: string;
  deliveredAt?: string;
  seenAt?: string;
  viewerId?: string;
  viewerUsername?: string;
  viewerAvatar?: string;
}

export interface WSMessageEditedEvent extends WSMessage {
  type: 'message_edited';
  messageId: number;
  chatId: number;
  senderId: number;
  senderUsername: string;
  content?: string;
  message_type: string;
  editedAt: string;
  attachments?: any[];
  envelopes?: any[];
}

export interface WSMessageDeletedEvent extends WSMessage {
  type: 'message_deleted';
  chatId: number;
  messageId: number;
  deletedBy: number;
  deletedByName: string;
  deletedAt: string;
}

export interface WSMessageReactionEvent extends WSMessage {
  type: 'message_reaction';
  action: 'add' | 'remove';
  chatId: number;
  messageId: number;
  reactions: Array<{
    reaction: string;
    count: number;
    userIds: string[];
  }>;
  actorId: number;
}

export interface WSFriendStatusChangeEvent extends WSMessage {
  type: 'friend_status_change';
  userId: number;
  username: string;
  status: 'online' | 'offline' | 'idle';
  timestamp: string;
  lastSeen?: string;
}

export interface WSChatUpdatedEvent extends WSMessage {
  type: 'chat_updated' | 'chat_group_created' | 'chat_deleted';
  chat?: any;
  chatId?: number;
  actorId?: number;
}

export interface WSErrorMessage extends WSMessage {
  type: 'error';
  message: string;
}

export interface WSPongMessage extends WSMessage {
  type: 'pong';
}

// Re-encryption request (when a new device is added)
export interface WSRequestReencryptEvent extends WSMessage {
  type: 'request_reencrypt';
  targetUserId: number;
  targetDeviceId: string | null;
  chatId: number;
  reason: 'new_device' | 'device_rotated';
  timestamp: string;
}

// Envelopes appended notification
export interface WSEnvelopesAppendedEvent extends WSMessage {
  type: 'envelopes_appended';
  messageId: number;
  chatId: number;
  timestamp: string;
}
