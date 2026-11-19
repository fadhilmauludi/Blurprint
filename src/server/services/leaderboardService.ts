import { DAY_MS, LEADERBOARD_SIZE, PODIUM_SIZE, USER_DAY_TTL_DAYS } from '../../shared/config';
import type { DayIndex, LeaderboardEntry, LeaderboardPayload } from '../../shared/types';
import type { Deps } from '../deps';
import { keys } from '../redisKeys';

const TTL_SECONDS = (USER_DAY_TTL_DAYS * DAY_MS) / 1000;

/** Credit points for `day` to the daily board, the all-time board and the user's total. */
export const addPoints = async (
  { store }: Deps,
  userId: string,
  username: string | undefined,
  day: DayIndex,
  points: number
): Promise<void> => {
  const writes: Promise<unknown>[] = [
    store.zIncrBy(keys.lbDay(day), userId, points),
    store.zIncrBy(keys.lbAll(), userId, points),
    store.hIncrBy(keys.user(userId), 'totalScore', points),
  ];
  if (username) writes.push(store.hSet(keys.usernames(), { [userId]: username }));
  await Promise.all(writes);
  await store.expire(keys.lbDay(day), TTL_SECONDS + DAY_MS / 1000);
};

/** 1-based descending rank, or null if not on the board. */
export const rankOf = async ({ store }: Deps, key: string, userId: string | undefined): Promise<number | null> => {
  if (!userId) return null;
  const [asc, card] = await Promise.all([store.zRank(key, userId), store.zCard(key)]);
  return asc === undefined ? null : card - asc;
};

const topEntries = async (
  deps: Deps,
  key: string,
  userId: string | undefined,
  size: number = LEADERBOARD_SIZE,
  appendMe = true
): Promise<LeaderboardEntry[]> => {
  const rows = await deps.store.zRange(key, 0, size - 1, { by: 'rank', reverse: true });
  if (rows.length === 0) return [];
  const names = await deps.store.hMGet(
    keys.usernames(),
    rows.map((r) => r.member)
  );
  const entries: LeaderboardEntry[] = rows.map((r, i) => ({
    rank: i + 1,
    username: names[i] ?? 'redditor',
    score: r.score,
    isMe: r.member === userId,
  }));
  // Append "you" below the top rows when you're not in them.
  if (appendMe && userId && !entries.some((e) => e.isMe)) {
    const [rank, score, me] = await Promise.all([
      rankOf(deps, key, userId),
      deps.store.zScore(key, userId),
      deps.store.hGet(keys.usernames(), userId),
    ]);
    if (rank !== null && score !== undefined) entries.push({ rank, username: me ?? 'you', score, isMe: true });
  }
  return entries;
};

export const getLeaderboard = async (deps: Deps, day: DayIndex, userId: string | undefined): Promise<LeaderboardPayload> => {
  const [today, allTime, streaks, yesterday, rankToday, rankAllTime, rankStreak] = await Promise.all([
    topEntries(deps, keys.lbDay(day), userId),
    topEntries(deps, keys.lbAll(), userId),
    topEntries(deps, keys.lbStreakDay(day), userId),
    topEntries(deps, keys.lbDay(day - 1), userId, PODIUM_SIZE, false),
    rankOf(deps, keys.lbDay(day), userId),
    rankOf(deps, keys.lbAll(), userId),
    rankOf(deps, keys.lbStreakDay(day), userId),
  ]);
  return { day, today, allTime, streaks, yesterday, rankToday, rankAllTime, rankStreak };
};

export const scoreForDay = async ({ store }: Deps, day: DayIndex, userId: string | undefined): Promise<number> =>
  userId ? ((await store.zScore(keys.lbDay(day), userId)) ?? 0) : 0;
