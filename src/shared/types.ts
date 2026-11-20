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

import type { QuestionFormat } from './formats';
export type { QuestionFormat } from './formats';

/** What the client needs to show the difficulty and run the focus pull. */
export type TierInfo = {
  level: 1 | 2 | 3 | 4;
  name: string;
  choices: number;
  guessSeconds: number;
  startBlur: number;
  startZoom: number;
  multiplier: number;
};

export type GuessPayload = {
  /**
   * Blend of day postDay − 1. Before the clock starts `values` is a coarse
   * teaser (TEASER_BLOCK² averages); after `started` it is the real blend.
   */
  blend: BlendPayload;
  /** null until the player starts the clock. */
  choices: Choice[] | null;
  tier: TierInfo;
  /** How the blend is revealed today (D-25). */
  format: QuestionFormat;
  /** Seeds the tile order / zoom point (same for every player). */
  formatSeed: number;
  started: boolean;
  /** Ms left on the guess clock when this payload was built (null before start). */
  remainingMs: number | null;
};

export type GuessStartRequest = { day: DayIndex };
export type GuessStartResponse = { guess: GuessPayload };

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
  /** The clock ran out before an answer. */
  timedOut: boolean;
  /** How long the guess took (null when there was no guess). */
  elapsedMs: number | null;
  tier: TierInfo | null;
  format: QuestionFormat;
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
  /** Longest active streaks among players who drew on `day` (score = streak). */
  streaks: LeaderboardEntry[];
  /** Top PODIUM_SIZE of day − 1 ("yesterday's winners"). */
  yesterday: LeaderboardEntry[];
  rankToday: number | null;
  rankAllTime: number | null;
  rankStreak: number | null;
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
  /** Spoiler-free summary for sharing / "comment my result" (built by the server). */
  shareText: string;
  /** The player already commented their result today. */
  commented: boolean;
};

export type CommentResultResponse = { ok: true; text: string };

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
  /** Brand-new player (never played, no hints dismissed). */
  firstTime: boolean;
  /** Hints this player already dismissed. */
  seenHints: HintId[];
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
  /** The tier of this post (shown in the top bar). */
  tier: TierInfo;
  /** Today's question format. */
  format: QuestionFormat;
  /** A duel invite this player opened from a shared link (see /api/duel/remember). */
  pendingDuelId: string | null;
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

/** choiceId null = the guess clock ran out. */
export type GuessRequest = { day: DayIndex; choiceId: string | null };
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
  | 'RATE_LIMITED'
  | 'SERVER';

export type ApiError = { error: string; code: ApiErrorCode };

export type ForgetResponse = { ok: true };

// ---------- Duels (D-22) ----------

export type DuelSide = 'host' | 'guest';

/** One player's view of a round: null = not answered yet. */
export type DuelRoundMark = { correct: boolean; points: number } | null;

export type DuelPlayer = {
  username: string;
  score: number;
  marks: DuelRoundMark[];
  done: boolean;
};

export type DuelStatus = 'waiting' | 'playing' | 'finished';

export type DuelView = {
  id: string;
  /** Which side the caller is on; null = not in this duel (can join if waiting). */
  me: DuelSide | null;
  host: DuelPlayer;
  guest: DuelPlayer | null;
  rounds: number;
  status: DuelStatus;
  winner: DuelSide | 'tie' | null;
  /** Index of the caller's next round (= rounds when done). */
  myNextRound: number;
  /** A round the caller started and has not answered yet. */
  openRound: DuelRoundPayload | null;
};

export type DuelRoundPayload = {
  duelId: string;
  round: number;
  format: QuestionFormat;
  /** Seeds the tile order / zoom point. */
  seed: number;
  /** The blend to read (for 'pick': the answer's blend is one of `options`). */
  blend: BlendPayload;
  /** Word buttons, or for 'pick' one entry per option (opaque ids o0…o3). */
  choices: Choice[];
  /** 'pick' only: the word to find. */
  word?: string;
  /** 'pick' only: the candidate blends. */
  options?: { id: string; blend: BlendPayload }[];
  seconds: number;
  startBlur: number;
  startZoom: number;
  remainingMs: number;
};

export type DuelAnswerRequest = { id: string; round: number; choiceId: string | null };
export type DuelAnswerResponse = {
  correct: boolean;
  timedOut: boolean;
  answerId: string;
  answerWord: string;
  points: number;
  elapsedMs: number;
  duel: DuelView;
};

/** Realtime nudge on channel `duel_{id}`: clients refetch the duel on any message. */
export type DuelNudge = { duelId: string; kind: 'joined' | 'answered' | 'finished' };

/** POST /api/subscribe. `joined: false` = Reddit refused (unreviewed app); the client opens the subreddit. */
export type SubscribeResponse = { ok: true; joined: boolean };
