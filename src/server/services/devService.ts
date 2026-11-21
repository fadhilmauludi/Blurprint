/**
 * Test-community tools (D-32). Moderator menu only, and only in subreddits
 * whose name ends in `_dev` (Devvit's playtest communities), so a real
 * community's day count can never be moved by accident.
 */
import { DAY_MS } from '../../shared/config';
import { startOfGameDayUtc } from '../../shared/schedule';
import type { DayIndex } from '../../shared/types';
import { ApiFail, type Deps } from '../deps';
import { keys } from '../redisKeys';
import { createDayPost } from './postService';
import { loadSeedForDay } from './seedService';

export const MAX_JUMP_DAY = 365;

export const canUseDevTools = (subredditName: string): boolean => /_dev$/i.test(subredditName);

/**
 * Make today Day `day`: moves the launch epoch back, loads the stand-in
 * drawings for the day before (so there's a blur to guess) and creates
 * today's post. Days already played keep their data.
 */
export const jumpToDay = async (
  deps: Deps,
  day: DayIndex
): Promise<{ day: DayIndex; seeded: number; postId: string; created: boolean }> => {
  if (!Number.isInteger(day) || day < 1 || day > MAX_JUMP_DAY)
    throw new ApiFail('BAD_INPUT', `Pick a day from 1 to ${MAX_JUMP_DAY}.`);
  const epoch = startOfGameDayUtc(deps.now()) - (day - 1) * DAY_MS;
  await deps.store.set(keys.launchEpoch(), String(epoch));
  const seed = await loadSeedForDay(deps, day - 1);
  const post = await createDayPost(deps, day);
  return { day, seeded: seed.loaded, postId: post.postId, created: post.created };
};
