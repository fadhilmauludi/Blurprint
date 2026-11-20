/**
 * All gameplay tunables live here so playtests can change them in one place.
 * See BLURPRINT_BUILD_SPEC.md §4.
 */

/** Drawing and blend grid is GRID_SIZE × GRID_SIZE. */
export const GRID_SIZE = 10;
export const GRID_CELLS = GRID_SIZE * GRID_SIZE;

/** Seconds to draw, after the 3-2-1 countdown. */
export const DRAW_SECONDS = 20;
export const COUNTDOWN_SECONDS = 3;
/** Timer bar turns amber at this many seconds left. */
export const TIMER_WARN_SECONDS = 5;

/** Fewer filled cells → submit disabled. */
export const MIN_CELLS = 3;
/** Stops "fill everything" griefing; extra taps do nothing. */
export const MAX_CELLS = 70;

/** Below this many drawings a blend is never shown publicly. */
export const MIN_BLEND_DRAWINGS = 5;
/** 1 correct + 3 decoys (tier 1). Later tiers show more — see DIFFICULTY_TIERS. */
export const GUESS_CHOICES = 4;
/** Every prompt group has 6 members, so 6 is the most choices a guess can offer. */
export const MAX_GUESS_CHOICES = 6;

/**
 * Progressive difficulty (D-19). The tier is chosen by the post's day, so every
 * player faces the same puzzle on the same day (fair leaderboards).
 *  - choices: how many options (the answer + same-silhouette decoys)
 *  - guessSeconds: the guess clock. The blend starts at startBlur × the normal
 *    blur and pulls into focus over the clock ("focus pull"), so fast guessers
 *    read a blurrier picture and earn more.
 *  - multiplier: applied to the correct-guess points.
 */
export type DifficultyTier = {
  level: 1 | 2 | 3 | 4;
  name: string;
  /** First post day of this tier. */
  fromDay: number;
  choices: number;
  guessSeconds: number;
  startBlur: number;
  /** Zoom-out format: how far zoomed in the clock starts. */
  startZoom: number;
  multiplier: number;
};
export const DIFFICULTY_TIERS: readonly DifficultyTier[] = [
  { level: 1, name: 'Warm-up', fromDay: Number.NEGATIVE_INFINITY, choices: 4, guessSeconds: 20, startBlur: 5, startZoom: 2.6, multiplier: 1 },
  { level: 2, name: 'Tricky', fromDay: 4, choices: 5, guessSeconds: 16, startBlur: 5.5, startZoom: 3, multiplier: 1.25 },
  { level: 3, name: 'Hard', fromDay: 8, choices: 6, guessSeconds: 13, startBlur: 6, startZoom: 3.4, multiplier: 1.5 },
  { level: 4, name: 'Expert', fromDay: 15, choices: 6, guessSeconds: 10, startBlur: 6.5, startZoom: 3.8, multiplier: 2 },
];
/** Network allowance on top of the guess clock before a guess counts as timed out. */
export const GUESS_GRACE_MS = 2500;
/** A correct guess at the very last moment still earns this share of the points. */
export const MIN_SPEED_FACTOR = 0.5;
/** Before the clock starts, the blend is shown averaged over TEASER_BLOCK² cells (splash + pre-start). */
export const TEASER_BLOCK = 2;

/**
 * Duels (D-22): 5 rounds that get harder each round. Blends come from past days
 * (never yesterday's, which is today's daily puzzle) and the seed bank.
 */
export type DuelRoundSpec = { choices: number; seconds: number; startBlur: number; startZoom: number };
export const DUEL_ROUNDS: readonly DuelRoundSpec[] = [
  { choices: 4, seconds: 12, startBlur: 5, startZoom: 2.6 },
  { choices: 4, seconds: 11, startBlur: 5.5, startZoom: 3 },
  { choices: 5, seconds: 10, startBlur: 6, startZoom: 3.2 },
  { choices: 6, seconds: 9, startBlur: 6.5, startZoom: 3.5 },
  { choices: 6, seconds: 8, startBlur: 7, startZoom: 3.8 },
];
/** Points for a correct duel round, before the speed factor. */
export const DUEL_ROUND_POINTS = 100;
/** Duels (and their user ids) are deleted after this many days. */
export const DUEL_TTL_DAYS = 7;
/** After this long, unplayed rounds count as missed and the duel is settled. */
export const DUEL_SETTLE_HOURS = 24;
/** Anti-spam: duels one player may create per game day. */
export const DUEL_CREATES_PER_DAY = 10;
/** Duel screen refresh while waiting for the opponent (realtime nudges make it instant when available). */
export const DUEL_POLL_MS = 4000;

/** New day at 00:00 UTC (= 07:00 WIB). */
export const ROLLOVER_UTC_HOUR = 0;
export const DAY_MS = 86_400_000;

/** Normalisation: a target cell is filled when the source covers at least this share of it. */
export const COVERAGE_THRESHOLD = 0.5;
/**
 * Normalisation: isolated cells (no filled 8-neighbour) are treated as stray taps and
 * dropped, but only when they are at most this share of the drawing (so dotted
 * drawings survive). Without this one stray tap in a corner shrinks the whole shape.
 */
export const STRAY_MAX_SHARE = 0.15;

/** Display value d = v ^ BLEND_GAMMA so weak agreement stays visible. */
export const BLEND_GAMMA = 0.8;
/**
 * Display contrast stretch: intensities are divided by the day's peak agreement and
 * anything under BLEND_FLOOR (share of the peak) fades to the background. Keeps the
 * shape readable whether 5 or 500 people drew.
 */
export const BLEND_FLOOR = 0.2;
/** CSS blur (px, at 300 px display size) for the signature blur. Scaled with the canvas. */
export const BLEND_BLUR_PX = 6;

/** Seed for the one-time shuffle of the prompt bank. Chosen so launch days are iconic shapes (day −2 sun, −1 crown, 0 heart, 1 ghost). Change only between seasons. */
export const PROMPT_SHUFFLE_SEED = 0xb1_19_ac;
/** Salt mixed with the day index to pick decoys. */
export const DECOY_SEED_SALT = 0x5eed_d3c0;

export const POINTS = {
  correctGuess: 100,
  wrongGuess: 0,
  drawing: 20,
  /** Crowd-sync bonus = round(sync × syncMax). */
  syncMax: 50,
  /** Streak bonus = streakPerDay × min(streak, streakCap). */
  streakPerDay: 10,
  streakCap: 7,
} as const;

export const STREAK_MILESTONES = [3, 7, 14, 30] as const;

/** Live blend polling interval on the result screen. */
export const BLEND_POLL_MS = 10_000;

/** Per-user per-day data is deleted after this many days (Devvit Rules recommend ≤ 30). */
export const USER_DAY_TTL_DAYS = 30;

/** How many leaderboard rows to show. */
export const LEADERBOARD_SIZE = 5;
/** "Yesterday's winners" podium size. */
export const PODIUM_SIZE = 3;

/** Feature flags (off by default; see docs/DECISIONS.md). */
export const FEATURES = {
  /** Set user flair "🔥 N" on streak milestones. Needs mod permissions for the app account. */
  streakFlair: false,
  /** Sticky the new day's post and unsticky the previous one. */
  stickyDailyPost: true,
  /** Playtest builds: "Copy drawing" button on the result card to collect seed drawings (spec §11). */
  devTools: false,
} as const;

export const CREDIT = 'by XenixWave';
