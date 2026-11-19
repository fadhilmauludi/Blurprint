/**
 * Progressive difficulty + timed "focus pull" guessing (D-19, D-20). Pure functions.
 */
import {
  DIFFICULTY_TIERS,
  GUESS_GRACE_MS,
  MIN_SPEED_FACTOR,
  POINTS,
  type DifficultyTier,
} from './config';
import type { DayIndex } from './types';

/** The tier for a post day. Days before launch use tier 1. */
export const tierForDay = (postDay: DayIndex): DifficultyTier => {
  let tier = DIFFICULTY_TIERS[0]!;
  for (const t of DIFFICULTY_TIERS) if (postDay >= t.fromDay) tier = t;
  return tier;
};

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/**
 * Blur multiplier at `elapsedMs` into a `seconds`-long clock: starts at
 * `startBlur` and reaches 1 (normal blur) when the clock runs out. Ease-IN, so
 * the picture stays murky for most of the first half: an early guess is a real
 * gamble, waiting costs points.
 */
export const focusBlurAt = (elapsedMs: number, seconds: number, startBlur: number): number => {
  const t = clamp01(elapsedMs / (seconds * 1000));
  return startBlur - (startBlur - 1) * t * t;
};

/** 1.0 for an instant answer, falling linearly to MIN_SPEED_FACTOR at the end of the clock. */
export const speedFactor = (elapsedMs: number, seconds: number): number =>
  1 - (1 - MIN_SPEED_FACTOR) * clamp01(elapsedMs / (seconds * 1000));

/** True when the answer arrived after the clock (plus network grace). */
export const isLate = (elapsedMs: number, seconds: number): boolean => elapsedMs > seconds * 1000 + GUESS_GRACE_MS;

const round5 = (n: number): number => Math.round(n / 5) * 5;

/** Points for a timed answer: base × multiplier × speed, rounded to 5. Wrong or late = 0. */
export const timedPoints = (correct: boolean, elapsedMs: number, seconds: number, multiplier = 1, base: number = POINTS.correctGuess): number => {
  if (!correct || isLate(elapsedMs, seconds)) return 0;
  return round5(base * multiplier * speedFactor(elapsedMs, seconds));
};
