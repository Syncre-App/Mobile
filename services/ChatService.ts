import { ApiResponse, ApiService } from './ApiService';
import { StorageService } from './StorageService';

export interface UploadableAsset {
  uri: string;
  name?: string;
  type?: string;
}

const resolveToken = async (token?: string): Promise<string | null> => {
  if (token) return token;
  return StorageService.getAuthToken();
};

const unauthenticatedResponse = (): ApiResponse => ({
  success: false,
  error: 'Not authenticated',
  statusCode: 401,
});

export class ChatService {
  static async createGroupChat(
    payload: { name?: string; members: string[]; avatar?: UploadableAsset | null },
    token?: string
  ): Promise<ApiResponse> {
    const authToken = await resolveToken(token);
    if (!authToken) {
      return unauthenticatedResponse();
    }

    const formData = new FormData();
    formData.append('members', JSON.stringify(payload.members || []));
    if (payload.name) {
      formData.append('name', payload.name);
    }
    if (payload.avatar?.uri) {
      formData.append('avatar', {
        uri: payload.avatar.uri,
        name: payload.avatar.name || `group-${Date.now()}.jpg`,
        type: payload.avatar.type || 'image/jpeg',
      } as any);
    }

    return ApiService.upload('/chat/group', formData, authToken);
  }

  static async addMembers(
    chatId: string,
    members: string[],
    token?: string
  ): Promise<ApiResponse> {
    const authToken = await resolveToken(token);
    if (!authToken) {
      return unauthenticatedResponse();
    }
    return ApiService.post(`/chat/${chatId}/members`, { members }, authToken);
  }

  static async removeMember(
    chatId: string,
    memberId: string,
    token?: string
  ): Promise<ApiResponse> {
    const authToken = await resolveToken(token);
    if (!authToken) {
      return unauthenticatedResponse();
    }
    return ApiService.delete(`/chat/${chatId}/members/${memberId}`, authToken);
  }

  static async updateGroupName(
    chatId: string,
    name: string,
    token?: string
  ): Promise<ApiResponse> {
    const authToken = await resolveToken(token);
    if (!authToken) {
      return unauthenticatedResponse();
    }
    return ApiService.put(`/chat/${chatId}`, { name }, authToken);
  }

  static async updateGroupAvatar(
    chatId: string,
    avatar: UploadableAsset,
    token?: string
  ): Promise<ApiResponse> {
    const authToken = await resolveToken(token);
    if (!authToken) {
      return unauthenticatedResponse();
    }
    const formData = new FormData();
    formData.append('avatar', {
      uri: avatar.uri,
      name: avatar.name || `group-${Date.now()}.jpg`,
      type: avatar.type || 'image/jpeg',
    } as any);
    return ApiService.upload(`/chat/${chatId}/avatar`, formData, authToken);
  }

  static async deleteGroup(chatId: string, token?: string): Promise<ApiResponse> {
    const authToken = await resolveToken(token);
    if (!authToken) {
      return unauthenticatedResponse();
    }
    return ApiService.delete(`/chat/${chatId}`, authToken);
  }

  static async uploadAttachment(
    chatId: string,
    file: UploadableAsset,
    token?: string
  ): Promise<ApiResponse> {
    const authToken = await resolveToken(token);
    if (!authToken) {
      return unauthenticatedResponse();
    }

    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name || `attachment-${Date.now()}`,
      type: file.type || 'application/octet-stream',
    } as any);

    return ApiService.upload(`/chat/${chatId}/attachments`, formData, authToken);
  }

  static async deleteAttachment(attachmentId: string, token?: string): Promise<ApiResponse> {
    const authToken = await resolveToken(token);
    if (!authToken) {
      return unauthenticatedResponse();
    }
    return ApiService.delete(`/chat/attachments/${attachmentId}`, authToken);
  }
}
