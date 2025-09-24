const BASE_URL = 'https://api.syncre.xyz/v1';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

export class ApiService {
  public static readonly baseUrl = BASE_URL;

  static async post<T = any>(endpoint: string, data: any, token?: string): Promise<ApiResponse<T>> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

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
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
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

  static async put<T = any>(endpoint: string, data: any, token?: string): Promise<ApiResponse<T>> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

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
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

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
}
