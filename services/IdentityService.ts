import { ApiService } from './ApiService';
import { StorageService } from './StorageService';
import { NotificationService } from './NotificationService';

class IdentityServiceClass {
  private verificationCache: { token: string; timestamp: number; requiresBootstrap: boolean } | null =
    null;
  private static CACHE_TTL_MS = 60_000;
  private bootstrapWatcher: NodeJS.Timer | null = null;

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
      const needsBootstrap = !response.data?.encryptedPrivateKey;
      this.setCache(authToken, needsBootstrap);
      return needsBootstrap;
    }

    const needsBootstrap = response.statusCode === 404;
    this.setCache(authToken, needsBootstrap);
    return needsBootstrap;
  }

  clearCache() {
    this.verificationCache = null;
  }

  startBootstrapWatcher(options?: { intervalMs?: number; onComplete?: () => void }) {
    if (this.bootstrapWatcher) {
      return;
    }
    const intervalMs = options?.intervalMs ?? 3000;
    this.bootstrapWatcher = setInterval(async () => {
      try {
        const needs = await this.requiresBootstrap();
        if (!needs) {
          NotificationService.show('success', 'Identity restored. You can continue.');
          this.stopBootstrapWatcher();
          options?.onComplete?.();
        }
      } catch (err) {
        // swallow; will retry on next tick
      }
    }, intervalMs);
  }

  stopBootstrapWatcher() {
    if (this.bootstrapWatcher) {
      clearInterval(this.bootstrapWatcher);
      this.bootstrapWatcher = null;
    }
  }
}

export const IdentityService = new IdentityServiceClass();
