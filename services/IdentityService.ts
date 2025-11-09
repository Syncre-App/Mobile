import { ApiService } from './ApiService';
import { StorageService } from './StorageService';

class IdentityServiceClass {
  private verificationCache: { token: string; timestamp: number; requiresBootstrap: boolean } | null =
    null;
  private static CACHE_TTL_MS = 60_000;

  private isCacheValid(token: string): boolean {
    if (!this.verificationCache) {
      return false;
    }
    if (this.verificationCache.token !== token) {
      return false;
    }
    return Date.now() - this.verificationCache.timestamp < IdentityServiceClass.CACHE_TTL_MS;
  }

  private setCache(token: string, requiresBootstrap: boolean) {
    this.verificationCache = {
      token,
      requiresBootstrap,
      timestamp: Date.now(),
    };
  }

  async requiresBootstrap(token?: string | null): Promise<boolean> {
    const authToken = token || (await StorageService.getAuthToken());
    if (!authToken) {
      return false;
    }

    if (this.isCacheValid(authToken)) {
      return this.verificationCache?.requiresBootstrap ?? false;
    }

    const response = await ApiService.get('/keys/identity', authToken);
    if (response.success) {
      this.setCache(authToken, false);
      return false;
    }

    const needsBootstrap = response.statusCode === 404;
    this.setCache(authToken, needsBootstrap);
    return needsBootstrap;
  }

  clearCache() {
    this.verificationCache = null;
  }
}

export const IdentityService = new IdentityServiceClass();
