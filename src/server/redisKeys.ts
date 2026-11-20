/**
 * ALL Redis key builders in one place (spec §8.5, adapted — see docs/DECISIONS.md D-07).
 *
 * Per-user per-day data lives in per-day HASHES (field = userId) instead of
 * per-user string keys so that (a) `hSetNX` gives a verified atomic
 * one-per-user guard and (b) one `expire` per day deletes it all after
 * USER_DAY_TTL_DAYS (Devvit Rules: delete user data within ~30 days).
 */
import type { DayIndex } from '../shared/types';

export const keys = {
  /** string: UTC ms of Day 1 00:00. */
  launchEpoch: () => 'config:launchEpoch',
  /** hash: day → creation lock timestamp (rollover idempotency). */
  rolloverLocks: () => 'config:rolloverLocks',
  /** hash: seed day → timestamp, so seed data loads once per day. */
  seedLoaded: () => 'config:seedLoaded',

  /** string: post id for day N. */
  dayPostId: (day: DayIndex) => `day:${day}:postId`,
  /** string: day N for a post. */
  postDay: (postId: string) => `post:${postId}:day`,

  /** hash: cell index → count of normalized drawings with that cell filled. Kept forever (archive). */
  dayCells: (day: DayIndex) => `day:${day}:cells`,
  /** string (int): number of drawings that day. Kept forever. */
  dayTotal: (day: DayIndex) => `day:${day}:total`,
  /** string: "1" if a moderator hid this blend. */
  dayHidden: (day: DayIndex) => `day:${day}:hidden`,

  /** hash: userId → bits of a drawing a moderator took out of the blend (undo + no double subtract). TTL. */
  dayRemoved: (day: DayIndex) => `day:${day}:removed`,
  /** hash: userId → normalized drawing as GRID² '0'/'1' chars, or "timeout". hSetNX = one per day. TTL. */
  dayDrawings: (day: DayIndex) => `day:${day}:drawings`,
  /** hash: userId → "{choiceId}|{0|1}". hSetNX = one per day. TTL. Keyed by the BLEND day being guessed. */
  dayGuesses: (day: DayIndex) => `day:${day}:guesses`,
  /** string: id of the app's pinned "results thread" comment on day N's post. */
  dayResultsComment: (day: DayIndex) => `day:${day}:resultsComment`,
  /** hash: userId → id of their "comment my result" reply (one per day). TTL. */
  dayCommented: (day: DayIndex) => `day:${day}:commented`,
  /** hash: userId → ms the player started the guess clock for the BLEND day. hSetNX. TTL. */
  dayGuessStarts: (day: DayIndex) => `day:${day}:guessStarts`,
  /** hash: total, correct (live guesses only, not archive). */
  dayGuessStats: (day: DayIndex) => `day:${day}:guessStats`,
  /** hash: userId → sync (0..1) once awarded (prevents double award). TTL. */
  daySyncs: (day: DayIndex) => `day:${day}:syncs`,

  /** hash: streak, bestStreak, lastPlayedDay, totalScore, daysPlayed, seenHints, duels (recent ids, CSV), duelWins. */
  user: (userId: string) => `user:${userId}`,
  /** zset: userId → score for day N. TTL. */
  lbDay: (day: DayIndex) => `lb:day:${day}`,
  /** zset: userId → streak after drawing on day N (today's streak board). TTL. */
  lbStreakDay: (day: DayIndex) => `lb:streak:${day}`,
  /** zset: userId → total score. Doubles as the index of every player (for deletion sweeps). */
  lbAll: () => 'lb:all',
  /** hash: userId → username (display only, top entries). */
  usernames: () => 'usernames',
  /** string: cursor (rank offset) for the deleted-account sweep. */
  purgeCursor: () => 'config:purgeCursor',

  /**
   * hash: one duel. Fields: meta (JSON rounds), host / guest (JSON {userId, username}),
   * createdAt, joinedAt, `{userId}:s{n}` (round start ms), `{userId}:a{n}` (answer). TTL DUEL_TTL_DAYS.
   */
  duel: (id: string) => `duel:${id}`,
  /** hash: userId → duel id opened from a share link (handoff splash → game). TTL. */
  duelInvites: () => 'duel:invites',
  /** hash: userId → duels created that game day (rate limit). TTL. */
  duelCreates: (day: DayIndex) => `duel:creates:${day}`,
} as const;

export const DRAWING_TIMEOUT = 'timeout';
