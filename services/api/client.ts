import { API_CONFIG } from '../../constants/config';
import { ApiError } from '../../types/api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions {
  method?: HttpMethod;
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      body,
      headers = {},
      timeout = API_CONFIG.REQUEST_TIMEOUT,
    } = options;

    const url = `${this.baseUrl}${endpoint}`;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.authToken) {
      requestHeaders['Authorization'] = `Bearer ${this.authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error: ApiError = {
          message: data.message || data.error || 'An error occurred',
          status: response.status,
          error: data.error,
        };
        throw error;
      }

      return data as T;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw {
          message: 'Request timeout',
          status: 408,
        } as ApiError;
      }

      if (error.status) {
        throw error;
      }

      throw {
        message: error.message || 'Network error',
        status: 0,
      } as ApiError;
    }
  }

  async get<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  async put<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async delete<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE', body });
  }

  async patch<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  // Upload with FormData (for files)
  async upload<T>(endpoint: string, formData: FormData, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const requestHeaders: Record<string, string> = {
      ...options?.headers,
    };

    if (this.authToken) {
      requestHeaders['Authorization'] = `Bearer ${this.authToken}`;
    }

    const controller = new AbortController();
    const timeout = options?.timeout || API_CONFIG.REQUEST_TIMEOUT;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error: ApiError = {
          message: data.message || data.error || 'An error occurred',
          status: response.status,
          error: data.error,
        };
        throw error;
      }

      return data as T;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw {
          message: 'Request timeout',
          status: 408,
        } as ApiError;
      }

      if (error.status) {
        throw error;
      }

      throw {
        message: error.message || 'Network error',
        status: 0,
      } as ApiError;
    }
  }
}

export const apiClient = new ApiClient();
