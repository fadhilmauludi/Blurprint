import { DAY_MS, USER_DAY_TTL_DAYS } from '../../shared/config';
import { bitsToGrid, gridToIndices } from '../../shared/normalize';
import { displayStreak, nextStreak, type StreakState } from '../../shared/scoring';
import type { DayIndex, HintId, UserSummary } from '../../shared/types';
import type { Deps, Who } from '../deps';
import { DRAWING_TIMEOUT, keys } from '../redisKeys';

export type UserState = StreakState & { totalScore: number; daysPlayed: number; seenHints: HintId[] };

const HINTS: readonly HintId[] = ['squint', 'draw'];
const isHint = (s: string): s is HintId => HINTS.some((h) => h === s);
const int = (s: string | undefined): number => {
  const n = Number(s ?? 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

export const getUserState = async ({ store }: Deps, userId: string): Promise<UserState> => {
  const h = await store.hGetAll(keys.user(userId));
  const last = h.lastPlayedDay;
  return {
    streak: int(h.streak),
    bestStreak: int(h.bestStreak),
    lastPlayedDay: last === undefined || last === '' ? null : int(last),
    totalScore: int(h.totalScore),
    daysPlayed: int(h.daysPlayed),
    seenHints: (h.seenHints ?? '').split(',').filter(isHint),
  };
};

export const userSummary = (who: Who, state: UserState, today: DayIndex): UserSummary => ({
  username: who.username ?? 'you',
  streak: displayStreak(state, today),
  bestStreak: state.bestStreak,
  totalScore: state.totalScore,
});

export const markHintSeen = async (deps: Deps, userId: string, hint: HintId): Promise<void> => {
  const state = await getUserState(deps, userId);
  if (state.seenHints.includes(hint)) return;
  await deps.store.hSet(keys.user(userId), { seenHints: [...state.seenHints, hint].join(',') });
};

/** Apply today's drawing to the streak. Returns the previous and next streak state. */
export const recordDrawDay = async (
  deps: Deps,
  userId: string,
  today: DayIndex
): Promise<{ prev: UserState; next: StreakState }> => {
  const prev = await getUserState(deps, userId);
  const next = nextStreak(prev, today);
  if (next !== prev) {
    await deps.store.hSet(keys.user(userId), {
      streak: String(next.streak),
      bestStreak: String(next.bestStreak),
      lastPlayedDay: String(next.lastPlayedDay),
      daysPlayed: String(prev.daysPlayed + 1),
    });
  }
  return { prev, next };
};

/** The player's normalized drawing cells for a day ([] if none / timed out). */
export const getMyCells = async ({ store }: Deps, day: DayIndex, userId: string | undefined): Promise<number[] | null> => {
  if (!userId) return null;
  const raw = await store.hGet(keys.dayDrawings(day), userId);
  if (raw === undefined) return null;
  if (raw === DRAWING_TIMEOUT) return [];
  return gridToIndices(bitsToGrid(raw));
};

/**
 * Remove everything tied to a user (self-service "forget me" and the
 * deleted-account sweep). Their drawings are also subtracted from the blends
 * that still hold them, so nothing derived from their content is retained
 * beyond aggregate counts older than USER_DAY_TTL_DAYS.
 */
export const forgetUser = async (deps: Deps, userId: string, today: DayIndex): Promise<void> => {
  const { store } = deps;
  const lookback = USER_DAY_TTL_DAYS + 2;
  for (let d = today - lookback; d <= today; d++) {
    const raw = await store.hGet(keys.dayDrawings(d), userId);
    if (raw !== undefined && raw !== DRAWING_TIMEOUT) {
      const cells = gridToIndices(bitsToGrid(raw));
      await Promise.all([
        ...cells.map((i) => store.hIncrBy(keys.dayCells(d), String(i), -1)),
        store.incrBy(keys.dayTotal(d), -1),
      ]);
    }
    await Promise.all([
      store.hDel(keys.dayDrawings(d), [userId]),
      store.hDel(keys.dayGuesses(d), [userId]),
      store.hDel(keys.daySyncs(d), [userId]),
      store.zRem(keys.lbDay(d), [userId]),
    ]);
  }
  await Promise.all([
    store.zRem(keys.lbAll(), [userId]),
    store.hDel(keys.usernames(), [userId]),
    store.del(keys.user(userId)),
  ]);
};

export const USER_DAY_TTL_SECONDS = (USER_DAY_TTL_DAYS * DAY_MS) / 1000;
