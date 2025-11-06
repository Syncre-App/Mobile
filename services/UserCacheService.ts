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
    if (user && user.id !== undefined && user.id !== null) {
      const id = user.id.toString();
      this.cache.set(id, { ...user, id });
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

  getAllUsers(): User[] {
    return Array.from(this.cache.values());
  }
}

export const UserCacheService = new UserCache();
