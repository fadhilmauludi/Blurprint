import { countsFromHash, intensities } from '../../shared/blend';
import { GRID_CELLS, MIN_BLEND_DRAWINGS } from '../../shared/config';
import { getDayIndex, startOfGameDayUtc } from '../../shared/schedule';
import type { BlendPayload, DayIndex } from '../../shared/types';
import type { Deps } from '../deps';
import { keys } from '../redisKeys';

export const getEpoch = async ({ store }: Deps): Promise<number | null> => {
  const raw = await store.get(keys.launchEpoch());
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
};

/** Returns the launch epoch, creating it (today's rollover moment) on first use. */
export const ensureEpoch = async (deps: Deps): Promise<number> => {
  const existing = await getEpoch(deps);
  if (existing !== null) return existing;
  const epoch = startOfGameDayUtc(deps.now());
  await deps.store.set(keys.launchEpoch(), String(epoch));
  return epoch;
};

/** Dev only: make today Day 1 again. */
export const resetEpoch = async (deps: Deps): Promise<number> => {
  const epoch = startOfGameDayUtc(deps.now());
  await deps.store.set(keys.launchEpoch(), String(epoch));
  return epoch;
};

export const getToday = async (deps: Deps): Promise<DayIndex> => getDayIndex(deps.now(), await ensureEpoch(deps));

/** The day a post belongs to: Redis mapping first, then the post's postData. */
export const getPostDay = async (
  { store }: Deps,
  postId: string | undefined,
  postData: unknown
): Promise<DayIndex | null> => {
  if (postId) {
    const raw = await store.get(keys.postDay(postId));
    if (raw !== undefined && Number.isInteger(Number(raw))) return Number(raw);
  }
  if (typeof postData === 'object' && postData !== null && 'day' in postData) {
    const day = postData.day;
    if (typeof day === 'number' && Number.isInteger(day)) return day;
  }
  return null;
};

export const getDayPostId = async ({ store }: Deps, day: DayIndex): Promise<string | null> =>
  (await store.get(keys.dayPostId(day))) ?? null;

export const getBlend = async ({ store }: Deps, day: DayIndex): Promise<BlendPayload> => {
  const [totalRaw, hiddenRaw] = await store.mGet([keys.dayTotal(day), keys.dayHidden(day)]);
  const total = Math.max(0, Number(totalRaw ?? 0) || 0);
  const hidden = hiddenRaw === '1';
  if (hidden || total < MIN_BLEND_DRAWINGS) return { day, total, values: null, hidden };
  const counts = countsFromHash(await store.hGetAll(keys.dayCells(day)), GRID_CELLS);
  return { day, total, values: intensities(counts, total), hidden };
};

export const setHidden = async ({ store }: Deps, day: DayIndex, hidden: boolean): Promise<void> => {
  if (hidden) await store.set(keys.dayHidden(day), '1');
  else await store.del(keys.dayHidden(day));
};
