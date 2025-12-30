export interface ChatParticipant {
  id: string;
  username: string;
  profile_picture: string | null;
  status?: 'online' | 'offline' | 'idle';
}

export interface Chat {
  id: number;
  users: string;
  userIds: string[];
  participants: ChatParticipant[];
  participantCount: number;
  isGroup: boolean;
  ownerId: string | null;
  name: string | null;
  displayName: string;
  avatarUrl: string | null;
  created_at: string;
  updated_at: string;
  lastMessage?: Message | null;
  unreadCount?: number;
}

export interface MessageReaction {
  reaction: string;
  count: number;
  userIds: string[];
}

export interface MessageSeenBy {
  userId: string;
  username: string;
  avatarUrl: string | null;
  seenAt: string;
}

export interface MessageReply {
  messageId: string;
  senderId: string;
  preview: string;
  senderLabel: string;
}

export interface Attachment {
  id: number;
  messageId: number | null;
  chatId: number;
  name: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: 'pending' | 'active' | 'expired';
  isImage: boolean;
  isVideo: boolean;
  lastAccessedAt: string;
  expiresAt: string;
  previewPath: string;
  downloadPath: string;
  publicViewPath?: string;
  publicDownloadPath?: string;
}

export interface Message {
  id: number;
  chatId: number;
  senderId: number;
  senderDeviceId: string | null;
  senderName: string;
  senderAvatar: string | null;
  senderBadges: string[];
  isEncrypted: boolean;
  messageType: 'text' | 'image' | 'video' | 'e2ee' | 'system' | 'poll';
  content: string | null;
  envelopes?: MessageEnvelope[];
  createdAt: string;
  createdAtLocal: string;
  deliveredAt: string | null;
  deliveredAtLocal: string | null;
  seenAt: string | null;
  seenAtLocal: string | null;
  editedAt: string | null;
  editedAtLocal: string | null;
  editCount: number;
  deletedAt: string | null;
  deletedAtLocal: string | null;
  isDeleted: boolean;
  deletedBy: string | null;
  deletedByName: string | null;
  reply: MessageReply | null;
  attachments: Attachment[];
  seenBy: MessageSeenBy[];
  reactions: MessageReaction[];
  timezone: string;
  // Local state
  pending?: boolean;
  failed?: boolean;
  localId?: string;
}

export interface MessageEnvelope {
  recipientId: string;
  recipientDevice: string;
  payload: string;
  nonce: string;
  keyVersion: number;
  alg: string;
  senderIdentityKey: string;
  senderDeviceId: string;
  version: number;
}

export interface TypingUser {
  chatId: number;
  userId: number;
  username: string;
  timestamp: number;
}

export interface UnreadSummary {
  total: number;
  chats: Record<string, number>;
}

export interface StreakInfo {
  chatId: number;
  currentStreak: number;
  longestStreak: number;
  participantsActive: boolean;
  lastActivityDate: string;
}
