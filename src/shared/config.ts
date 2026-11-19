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
/** 1 correct + 3 decoys. */
export const GUESS_CHOICES = 4;

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
