import { StorageService } from './StorageService';

interface User {
  id: string;
  username: string;
  email: string;
  profile_picture?: string | null;
  status?: string | null;
  last_seen?: string | null;
  [key: string]: any;
}

interface CachedUser extends User {
  lastFetched: number;
}

const STORAGE_KEY = 'user_cache_v1';
const STALE_AGE_MS = 5 * 60 * 1000; // 5 minutes

class UserCache {
  private cache: Map<string, CachedUser> = new Map();
  private hydrating: Promise<void> | null = null;
  private hydrated = false;
  private persistTimer: number | null = null;

  constructor() {
    this.startHydration();
  }

  private startHydration() {
    if (this.hydrating || this.hydrated) {
      return;
    }
    this.hydrating = (async () => {
      try {
        const stored = await StorageService.getObject<Record<string, CachedUser>>(STORAGE_KEY);
        if (stored && typeof stored === 'object') {
          Object.values(stored).forEach((user) => {
            if (user?.id != null) {
              const id = user.id.toString();
              this.cache.set(id, { ...user, id });
            }
          });
        }
      } catch (error) {
        console.warn('[UserCache] Failed to hydrate cache:', error);
      } finally {
        this.hydrated = true;
        this.hydrating = null;
      }
    })();
  }

  private schedulePersist() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      const payload: Record<string, CachedUser> = {};
      this.cache.forEach((user, id) => {
        payload[id] = user;
      });
      StorageService.setObject(STORAGE_KEY, payload).catch((err) =>
        console.warn('[UserCache] Failed to persist cache:', err)
      );
    }, 200) as unknown as number;
  }

  async hydrate(): Promise<void> {
    this.startHydration();
    if (this.hydrating) {
      await this.hydrating;
    }
  }

  addUser(user: User) {
    if (user && user.id !== undefined && user.id !== null) {
      const id = user.id.toString();
      this.cache.set(id, { ...user, id, lastFetched: Date.now() });
      this.schedulePersist();
    }
  }

  getUser(userId: string): CachedUser | null {
    this.startHydration();
    return this.cache.get(userId) || null;
  }

  addUsers(users: User[]) {
    if (users && Array.isArray(users)) {
      for (const user of users) {
        this.addUser(user);
      }
    }
  }

  getAllUsers(): CachedUser[] {
    return Array.from(this.cache.values());
  }

  isStale(userId: string, maxAgeMs: number = STALE_AGE_MS): boolean {
    const cached = this.cache.get(userId);
    if (!cached) {
      return true;
    }
    return Date.now() - cached.lastFetched > maxAgeMs;
  }
}

export const UserCacheService = new UserCache();
