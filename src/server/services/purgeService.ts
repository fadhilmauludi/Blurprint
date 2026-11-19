import type { Deps } from '../deps';
import { keys } from '../redisKeys';
import { getToday } from './dayService';
import { forgetUser } from './userService';

/**
 * Devvit Rules — account deletions: walk the player index (lb:all) in small
 * batches and purge users whose account no longer exists. Called hourly by the
 * scheduler; each call checks `batch` users and saves a cursor.
 */
export const sweepDeletedUsers = async (deps: Deps, batch = 40): Promise<{ checked: number; purged: number }> => {
  const { store } = deps;
  const cursor = Math.max(0, Number((await store.get(keys.purgeCursor())) ?? 0) || 0);
  const rows = await store.zRange(keys.lbAll(), cursor, cursor + batch - 1, { by: 'rank' });
  const today = await getToday(deps);
  let purged = 0;
  for (const { member } of rows) {
    let exists: boolean;
    try {
      exists = await deps.platform.userExists(member);
    } catch {
      exists = true; // never delete on a lookup error
    }
    if (!exists) {
      await forgetUser(deps, member, today);
      purged++;
    }
  }
  const next = rows.length < batch ? 0 : cursor + rows.length - purged;
  await store.set(keys.purgeCursor(), String(next));
  return { checked: rows.length, purged };
};
