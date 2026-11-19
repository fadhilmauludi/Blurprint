import { CREDIT, FEATURES } from '../../shared/config';
import type { DayIndex } from '../../shared/types';
import type { Deps } from '../deps';
import { keys } from '../redisKeys';
import { getDayPostId, getToday } from './dayService';

export const dayPostTitle = (day: DayIndex): string => `Blurprint #${day} — what did the crowd draw?`;

const FALLBACK_TEXT =
  'Blurprint is a daily drawing game: guess what the crowd drew from yesterday’s blurry blend, ' +
  'then draw today’s secret prompt in 20 seconds. Open this post in the Reddit app or on new Reddit to play. ' +
  CREDIT;

export type CreatedPost = { postId: string; url: string | null; created: boolean };

/**
 * Create the post for `day` exactly once (scheduler, install trigger and the
 * mod menu all call this). A per-day lock in a hash (hSetNX) prevents doubles
 * when two callers race.
 */
export const createDayPost = async (deps: Deps, day: DayIndex): Promise<CreatedPost> => {
  const existing = await getDayPostId(deps, day);
  if (existing) return { postId: existing, url: null, created: false };

  const locked = await deps.store.hSetNX(keys.rolloverLocks(), String(day), String(deps.now()));
  if (locked === 0) {
    const raced = await getDayPostId(deps, day);
    if (raced) return { postId: raced, url: null, created: false };
    throw new Error(`Post for day ${day} is already being created`);
  }

  try {
    const post = await deps.platform.createDayPost({ day, title: dayPostTitle(day), fallbackText: FALLBACK_TEXT });
    await Promise.all([
      deps.store.set(keys.dayPostId(day), post.id),
      deps.store.set(keys.postDay(post.id), String(day)),
    ]);
    if (FEATURES.stickyDailyPost) await rotateSticky(deps, day, post.id);
    console.log(JSON.stringify({ event: 'rollover_ok', day }));
    return { postId: post.id, url: post.url, created: true };
  } catch (e) {
    await deps.store.hDel(keys.rolloverLocks(), [String(day)]);
    throw e;
  }
};

const rotateSticky = async (deps: Deps, day: DayIndex, newPostId: string): Promise<void> => {
  const prev = await getDayPostId(deps, day - 1);
  try {
    if (prev) await deps.platform.unstickyPost(prev);
  } catch (e) {
    console.warn('unsticky failed', e instanceof Error ? e.message : e);
  }
  try {
    await deps.platform.stickyPost(newPostId);
  } catch (e) {
    console.warn('sticky failed (app account may not be a mod)', e instanceof Error ? e.message : e);
  }
};

export const rollover = async (deps: Deps): Promise<CreatedPost & { day: DayIndex }> => {
  const day = await getToday(deps);
  return { day, ...(await createDayPost(deps, day)) };
};
