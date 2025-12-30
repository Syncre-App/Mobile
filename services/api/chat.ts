import { apiClient } from './client';
import { Chat, Message, Attachment, UnreadSummary, StreakInfo } from '../../types/chat';
import { ChatListResponse, MessagesResponse, AttachmentUploadResponse, ChunkedUploadStartResponse } from '../../types/api';

export const chatApi = {
  /**
   * Get all chats
   */
  getChats: async (): Promise<Chat[]> => {
    const response = await apiClient.get<ChatListResponse>('/chat');
    return response.chats || [];
  },

  /**
   * Get chat by ID
   */
  getChat: async (chatId: number): Promise<Chat> => {
    return apiClient.get<Chat>(`/chat/${chatId}`);
  },

  /**
   * Get unread message summary
   */
  getUnreadSummary: async (): Promise<UnreadSummary> => {
    return apiClient.get<UnreadSummary>('/chat/unread/summary');
  },

  /**
   * Get messages for a chat
   */
  getMessages: async (
    chatId: number,
    options?: { deviceId?: string; before?: string; limit?: number }
  ): Promise<MessagesResponse> => {
    const params = new URLSearchParams();
    if (options?.deviceId) params.append('deviceId', options.deviceId);
    if (options?.before) params.append('before', options.before);
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    const endpoint = `/chat/${chatId}/messages${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<MessagesResponse>(endpoint);
  },

  /**
   * Mark chat as seen
   */
  markChatSeen: async (chatId: number): Promise<{ message: string }> => {
    return apiClient.post(`/chat/${chatId}/seen`);
  },

  /**
   * Delete a message
   */
  deleteMessage: async (chatId: number, messageId: number): Promise<{ message: string }> => {
    return apiClient.delete(`/chat/${chatId}/messages/${messageId}`);
  },

  /**
   * Add reaction to message
   */
  addReaction: async (chatId: number, messageId: number, reaction: string): Promise<{ message: string }> => {
    return apiClient.post(`/chat/${chatId}/messages/${messageId}/reactions`, { reaction });
  },

  /**
   * Remove reaction from message
   */
  removeReaction: async (chatId: number, messageId: number, reaction: string): Promise<{ message: string }> => {
    return apiClient.delete(`/chat/${chatId}/messages/${messageId}/reactions?reaction=${encodeURIComponent(reaction)}`);
  },

  /**
   * Upload attachment
   */
  uploadAttachment: async (chatId: number, uri: string, mimeType: string): Promise<AttachmentUploadResponse> => {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'file';

    formData.append('file', {
      uri,
      name: filename,
      type: mimeType,
    } as any);

    return apiClient.upload<AttachmentUploadResponse>(`/chat/${chatId}/attachments`, formData);
  },

  /**
   * Start chunked upload
   */
  startChunkedUpload: async (
    chatId: number,
    fileName: string,
    fileSize: number,
    mimeType?: string
  ): Promise<ChunkedUploadStartResponse> => {
    return apiClient.post(`/chat/${chatId}/attachments/chunk/start`, {
      fileName,
      fileSize,
      mimeType,
    });
  },

  /**
   * Upload chunk
   */
  uploadChunk: async (
    chatId: number,
    uploadId: string,
    chunk: Blob,
    chunkIndex: number
  ): Promise<{ message: string }> => {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('chunkIndex', chunkIndex.toString());

    return apiClient.upload(`/chat/${chatId}/attachments/chunk/${uploadId}`, formData);
  },

  /**
   * Complete chunked upload
   */
  completeChunkedUpload: async (chatId: number, uploadId: string): Promise<AttachmentUploadResponse> => {
    return apiClient.post(`/chat/${chatId}/attachments/chunk/${uploadId}/complete`);
  },

  /**
   * Delete attachment
   */
  deleteAttachment: async (attachmentId: number): Promise<{ message: string }> => {
    return apiClient.delete(`/chat/attachments/${attachmentId}`);
  },

  /**
   * Create group chat
   */
  createGroup: async (members: string[], name?: string, avatarUri?: string): Promise<Chat> => {
    if (avatarUri) {
      const formData = new FormData();
      formData.append('members', JSON.stringify(members));
      if (name) formData.append('name', name);
      
      const filename = avatarUri.split('/').pop() || 'avatar.jpg';
      formData.append('avatar', {
        uri: avatarUri,
        name: filename,
        type: 'image/jpeg',
      } as any);

      return apiClient.upload<Chat>('/chat/group', formData);
    }

    return apiClient.post<Chat>('/chat/group', { members, name });
  },

  /**
   * Update group name
   */
  updateGroupName: async (chatId: number, name: string): Promise<{ message: string }> => {
    return apiClient.put(`/chat/${chatId}`, { name });
  },

  /**
   * Update group avatar
   */
  updateGroupAvatar: async (chatId: number, avatarUri: string): Promise<{ message: string }> => {
    const formData = new FormData();
    const filename = avatarUri.split('/').pop() || 'avatar.jpg';

    formData.append('avatar', {
      uri: avatarUri,
      name: filename,
      type: 'image/jpeg',
    } as any);

    return apiClient.upload(`/chat/${chatId}/avatar`, formData);
  },

  /**
   * Add members to group
   */
  addGroupMembers: async (chatId: number, members: string[]): Promise<{ message: string }> => {
    return apiClient.post(`/chat/${chatId}/members`, { members });
  },

  /**
   * Remove member from group
   */
  removeGroupMember: async (chatId: number, memberId: string): Promise<{ message: string }> => {
    return apiClient.delete(`/chat/${chatId}/members/${memberId}`);
  },

  /**
   * Delete group
   */
  deleteGroup: async (chatId: number): Promise<{ message: string }> => {
    return apiClient.delete(`/chat/${chatId}`);
  },

  /**
   * Get streak info
   */
  getStreak: async (chatId: number): Promise<StreakInfo> => {
    return apiClient.get<StreakInfo>(`/chat/${chatId}/streak`);
  },

  /**
   * Get bulk streaks
   */
  getBulkStreaks: async (chatIds: number[]): Promise<StreakInfo[]> => {
    const response = await apiClient.post<{ streaks: StreakInfo[] }>('/chat/streaks', { chatIds });
    return response.streaks || [];
  },
};
