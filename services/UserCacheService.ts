interface User {
  id: string;
  username: string;
  email: string;
  profile_picture?: string | null;
  [key: string]: any;
}

class UserCache {
  private cache: Map<string, User> = new Map();

  addUser(user: User) {
    if (user && user.id) {
      this.cache.set(user.id, user);
    }
  }

  getUser(userId: string): User | null {
    return this.cache.get(userId) || null;
  }

  addUsers(users: User[]) {
    if (users && Array.isArray(users)) {
      for (const user of users) {
        this.addUser(user);
      }
    }
  }
}

export const UserCacheService = new UserCache();
