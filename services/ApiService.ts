import { UserCacheService } from './UserCacheService';
import { TimezoneService } from './TimezoneService';

const resolveBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    const normalized = envUrl.endsWith('/v1') ? envUrl : `${envUrl.replace(/\/+$/, '')}/v1`;
    return normalized;
  }
  return 'https://api.syncre.xyz/v1';
};

const BASE_URL = resolveBaseUrl();

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

export class ApiService {
  public static readonly baseUrl = BASE_URL;

  private static buildHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    TimezoneService.applyHeader(headers);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  static async post<T = any>(endpoint: string, data: any, token?: string): Promise<ApiResponse<T>> {
    try {
      const headers = this.buildHeaders(token);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      let responseData: any = undefined;
      try {
        responseData = await response.json();
      } catch (e) {
        // Non-JSON response — capture text for debugging
        const text = await response.text();
        console.warn('ApiService: Non-JSON response:', text);
        responseData = { text };
      }

      return {
        success: response.ok,
        data: response.ok ? responseData : undefined,
        error: !response.ok ? (responseData?.message || responseData?.error || responseData?.text || `Request failed with status ${response.status}`) : undefined,
        statusCode: response.status,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Network error',
        statusCode: 0,
      };
    }
  }

  static async get<T = any>(endpoint: string, token?: string): Promise<ApiResponse<T>> {
    try {
      const headers = this.buildHeaders(token);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers,
      });

      let responseData: any = undefined;
      try {
        responseData = await response.json();
      } catch (e) {
        const text = await response.text();
        console.warn('ApiService.get: Non-JSON response:', text);
        responseData = { text };
      }

      if (response.ok && responseData) {
        if (responseData.users) {
          UserCacheService.addUsers(responseData.users);
        } else if (responseData.user) {
          UserCacheService.addUser(responseData.user);
        } else if (Array.isArray(responseData)) {
          UserCacheService.addUsers(responseData);
        }

        if (responseData.friends && Array.isArray(responseData.friends)) {
          UserCacheService.addUsers(responseData.friends);
        }

        if (responseData.pending && typeof responseData.pending === 'object') {
          const pendingUsers: any[] = [];
          if (Array.isArray(responseData.pending.incoming)) {
            pendingUsers.push(...responseData.pending.incoming);
          }
          if (Array.isArray(responseData.pending.outgoing)) {
            pendingUsers.push(...responseData.pending.outgoing);
          }
          if (pendingUsers.length) {
            UserCacheService.addUsers(pendingUsers);
          }
        }
      }

      return {
        success: response.ok,
        data: response.ok ? responseData : undefined,
        error: !response.ok ? (responseData?.message || responseData?.error || responseData?.text || `Request failed with status ${response.status}`) : undefined,
        statusCode: response.status,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Network error',
        statusCode: 0,
      };
    }
  }

  static async getUserById(userId: string, token: string): Promise<ApiResponse<any>> {
    const cachedUser = UserCacheService.getUser(userId);
    const shouldRevalidate = UserCacheService.isStale(userId);

    if (cachedUser) {
      // Return cached immediately; refresh in background if stale to keep names/avatars current
      if (shouldRevalidate) {
        this.get(`/user/${userId}`, token)
          .then((response) => {
            if (response.success && response.data) {
              UserCacheService.addUser(response.data);
            }
          })
          .catch((err) => console.warn('[ApiService] Background user refresh failed:', err));
      }
      return {
        success: true,
        data: cachedUser,
        statusCode: 200,
      };
    }

    const response = await this.get(`/user/${userId}`, token);
    if (response.success && response.data) {
      UserCacheService.addUser(response.data);
    }

    return response;
  }

  static async put<T = any>(endpoint: string, data: any, token?: string): Promise<ApiResponse<T>> {
    try {
      const headers = this.buildHeaders(token);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });

      const responseData = await response.json();
      
      return {
        success: response.ok,
        data: response.ok ? responseData : undefined,
        error: !response.ok ? (responseData.message || responseData.error || `Request failed with status ${response.status}`) : undefined,
        statusCode: response.status,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Network error',
        statusCode: 0,
      };
    }
  }

  static async delete<T = any>(endpoint: string, token?: string): Promise<ApiResponse<T>> {
    try {
      const headers = this.buildHeaders(token);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers,
      });

      const responseData = await response.json();
      
      return {
        success: response.ok,
        data: response.ok ? responseData : undefined,
        error: !response.ok ? (responseData.message || responseData.error || `Request failed with status ${response.status}`) : undefined,
        statusCode: response.status,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Network error',
        statusCode: 0,
      };
    }
  }

  static async upload<T = any>(endpoint: string, formData: FormData, token?: string): Promise<ApiResponse<T>> {
    try {
      const headerRecord: Record<string, string> = {};
      TimezoneService.applyHeader(headerRecord);

      if (token) {
        headerRecord.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: headerRecord as HeadersInit,
        body: formData,
      });

      let responseData: any;
      try {
        responseData = await response.json();
      } catch (error) {
        const text = await response.text();
        responseData = { text };
      }

      return {
        success: response.ok,
        data: response.ok ? responseData : undefined,
        error: !response.ok ? (responseData?.message || responseData?.error || `Request failed with status ${response.status}`) : undefined,
        statusCode: response.status,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Network error',
        statusCode: 0,
      };
    }
  }
}
