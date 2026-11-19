/**
 * The data contract between client and server (spec §8.3).
 * Written as type aliases to follow the template's code style (AGENTS.md).
 */

export type DayIndex = number;

export type Choice = { id: string; word: string };

export type BlendPayload = {
  day: DayIndex;
  /** Number of drawings so far. */
  total: number;
  /** GRID² intensities 0..1, or null when total < MIN_BLEND_DRAWINGS or hidden. */
  values: number[] | null;
  /** A moderator hid this blend. */
  hidden: boolean;
};

export type UserSummary = {
  username: string;
  streak: number;
  bestStreak: number;
  totalScore: number;
};

export type Phase = 'guess' | 'draw' | 'done';

export type GuessPayload = {
  /** Blend of day postDay − 1. */
  blend: BlendPayload;
  choices: Choice[];
};

export type DrawPayload = {
  promptWord: string;
  seconds: number;
  grid: number;
};

export type RevealPayload = {
  /** null when there was nothing to guess (no blend yet). */
  correct: boolean | null;
  /** The choice the player picked (null when skipped). */
  pickedId: string | null;
  answerId: string | null;
  answerWord: string | null;
  choices: Choice[] | null;
  /** 0..100, null when no one has guessed or no blend. */
  pctCorrect: number | null;
  blend: BlendPayload | null;
  /** 0..100, crowd sync for the player's drawing on day postDay − 1. */
  syncPct: number | null;
  syncBonus: number;
  pointsEarned: number;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  score: number;
  isMe: boolean;
};

export type LeaderboardPayload = {
  day: DayIndex;
  today: LeaderboardEntry[];
  allTime: LeaderboardEntry[];
  rankToday: number | null;
  rankAllTime: number | null;
};

export type ResultPayload = {
  /** Today's blend (may have values: null if under MIN). */
  liveBlend: BlendPayload;
  /** The player's normalized cells (indices), for the highlight flash. Empty in archive mode. */
  myCells: number[];
  scoreToday: number;
  streak: number;
  bestStreak: number;
  rankToday: number | null;
  leaderboard: LeaderboardPayload;
  /** The player's drawing was accepted today (false after a timeout with too few cells). */
  drew: boolean;
  /** A new milestone was reached with this drawing (3/7/14/30). */
  streakMilestone: number | null;
};

export type InitResponse = {
  /** The day this post belongs to. */
  postDay: DayIndex;
  /** Current day (for archive detection). */
  today: DayIndex;
  isArchive: boolean;
  /** Post id of today's Blurprint (for the archive banner link), if known. */
  todayPostId: string | null;
  subredditName: string;
  /** null = logged out. */
  user: UserSummary | null;
  /** Show first-time hints. */
  firstTime: boolean;
  phase: Phase;
  /** Present when phase = 'guess'. */
  guess?: GuessPayload;
  /** Present when phase is 'draw' or 'done' (the reveal the user has earned). */
  reveal?: RevealPayload;
  /** Present only when phase = 'draw'. */
  draw?: DrawPayload;
  /** Present only when phase = 'done'. */
  result?: ResultPayload;
  nextRolloverUtcMs: number;
};

/** Light payload for the inline splash. */
export type SplashResponse = {
  postDay: DayIndex;
  isArchive: boolean;
  blend: BlendPayload | null;
  /** Yesterday's drawing count, shown as "{players} players". */
  players: number;
  doneToday: boolean;
  streak: number;
  loggedIn: boolean;
};

export type GuessRequest = { day: DayIndex; choiceId: string };
export type GuessResponse = { reveal: RevealPayload; draw: DrawPayload | null; result: ResultPayload | null };

export type SkipGuessResponse = { draw: DrawPayload | null; reveal: RevealPayload };

/** cells = indices of filled cells (raw, un-normalized). Empty + timedOut = time ran out under MIN. */
export type DrawRequest = { day: DayIndex; cells: number[]; timedOut?: boolean };
export type DrawResponse = { result: ResultPayload };

export type HintRequest = { hint: HintId };
export type HintId = 'squint' | 'draw';

export type ApiErrorCode =
  | 'NOT_LOGGED_IN'
  | 'ALREADY_DONE'
  | 'BAD_INPUT'
  | 'WRONG_PHASE'
  | 'NOT_FOUND'
  | 'SERVER';

export type ApiError = { error: string; code: ApiErrorCode };

export type ForgetResponse = { ok: true };
