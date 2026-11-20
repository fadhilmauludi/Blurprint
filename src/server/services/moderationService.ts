/**
 * Moderator tools for a single bad drawing (D-31). Coordinated rude shapes
 * are handled by hiding the whole blend (dayService.setHidden).
 *
 * Removing takes a drawing's cells out of the day's aggregate counts and
 * parks its bits in `dayRemoved` (same TTL as the drawings) so it can be put
 * back and is never subtracted twice. The player's own record stays: they
 * keep their streak and still see what they drew. Moderators are never shown
 * individual drawings; the app picks the ones least like the crowd.
 */
import { GRID_CELLS } from '../../shared/config';
import { countsFromHash } from '../../shared/blend';
import { rankOutliers } from '../../shared/moderation';
import type { DayIndex } from '../../shared/types';
import { ApiFail, type Deps } from '../deps';
import { keys } from '../redisKeys';
import { getToday } from './dayService';
import { USER_DAY_TTL_SECONDS } from './userService';

export const MAX_REMOVE_AT_ONCE = 5;

const totalOf = async ({ store }: Deps, day: DayIndex): Promise<number> =>
  Math.max(0, Number((await store.get(keys.dayTotal(day))) ?? 0) || 0);

const applyCells = async ({ store }: Deps, day: DayIndex, cells: readonly number[], delta: 1 | -1): Promise<void> => {
  await Promise.all([
    ...cells.map((i) => store.hIncrBy(keys.dayCells(day), String(i), delta)),
    store.incrBy(keys.dayTotal(day), delta),
  ]);
};

/** Take the `count` drawings least like the crowd out of day `day`'s blend. */
export const removeOutliers = async (
  deps: Deps,
  day: DayIndex,
  count: number
): Promise<{ removed: number; total: number }> => {
  const today = await getToday(deps);
  if (!Number.isInteger(day) || day > today) throw new ApiFail('BAD_INPUT', 'Pick today or an earlier day.');
  if (!Number.isInteger(count) || count < 1 || count > MAX_REMOVE_AT_ONCE)
    throw new ApiFail('BAD_INPUT', `Remove between 1 and ${MAX_REMOVE_AT_ONCE} drawings at a time.`);
  const { store } = deps;
  const [drawings, removed, cellHash] = await Promise.all([
    store.hGetAll(keys.dayDrawings(day)),
    store.hGetAll(keys.dayRemoved(day)),
    store.hGetAll(keys.dayCells(day)),
  ]);
  const candidates = Object.entries(drawings).filter(([userId]) => removed[userId] === undefined);
  const ranked = rankOutliers(candidates, countsFromHash(cellHash, GRID_CELLS), await totalOf(deps, day));
  let done = 0;
  for (const o of ranked.slice(0, count)) {
    // hSetNX: two moderators pressing at once can't subtract the same drawing twice.
    if ((await store.hSetNX(keys.dayRemoved(day), o.userId, drawings[o.userId]!)) !== 1) continue;
    await applyCells(deps, day, o.cells, -1);
    done++;
  }
  if (done > 0) await store.expire(keys.dayRemoved(day), USER_DAY_TTL_SECONDS);
  return { removed: done, total: await totalOf(deps, day) };
};

/** Put every removed drawing for `day` back into its blend. */
export const restoreRemoved = async (deps: Deps, day: DayIndex): Promise<{ restored: number; total: number }> => {
  const { store } = deps;
  const removed = await store.hGetAll(keys.dayRemoved(day));
  let done = 0;
  for (const [userId, bits] of Object.entries(removed)) {
    if ((await store.hDel(keys.dayRemoved(day), [userId])) !== 1) continue;
    const cells: number[] = [];
    for (let i = 0; i < bits.length; i++) if (bits[i] === '1') cells.push(i);
    await applyCells(deps, day, cells, 1);
    done++;
  }
  return { restored: done, total: await totalOf(deps, day) };
};
