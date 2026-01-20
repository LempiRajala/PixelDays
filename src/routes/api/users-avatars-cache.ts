import type { User } from "../../db/schema";
import { getUserAvatarId } from "../../db/utils/users";
import { LRUCache } from 'lru-cache';

type CacheValueType = Pick<User, 'avatarId'> | Promise<Pick<User, 'avatarId'>>;

export class UsersAvatarsCache {
  private static readonly cache = new LRUCache<number, CacheValueType>({
    max: 1024,
    ttl: 10 * 60 * 1000, // 10 minutes
    ttlAutopurge: true,
    updateAgeOnGet: true,
  });

  public static async get(userId: number): Promise<Pick<User, 'avatarId'>> {
    let cached = this.cache.get(userId);
    if(cached === undefined) {
      cached = getUserAvatarId(userId)
        .then(result => {
          if(result === undefined) {
            throw new Error(`user (${userId}) avatar not found`);
          } else {
            this.cache.set(userId, result);
            return result;
          }
        })
        .catch(e => {
          this.cache.delete(userId);
          throw e;
        });
      this.cache.set(userId, cached);
    }

    return cached;
  }

  public static set(userId: number, avatarId: User['avatarId']) {
    this.cache.set(userId, { avatarId });
  }

  public static has(userId: number) {
    return this.cache.has(userId);
  }
}