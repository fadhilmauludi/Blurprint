import type { RedisClient } from '@devvit/web/server';

/**
 * The exact subset of the Devvit Redis client the services use.
 * Production passes `redis` from `@devvit/web/server`; tests and the local
 * harness pass `MemoryStore`. Add a command here AND in MemoryStore.
 */
export type Store = Pick<
  RedisClient,
  | 'get'
  | 'set'
  | 'del'
  | 'incrBy'
  | 'mGet'
  | 'expire'
  | 'hGet'
  | 'hSet'
  | 'hSetNX'
  | 'hGetAll'
  | 'hIncrBy'
  | 'hDel'
  | 'hMGet'
  | 'zAdd'
  | 'zIncrBy'
  | 'zRange'
  | 'zRank'
  | 'zScore'
  | 'zCard'
  | 'zRem'
>;
