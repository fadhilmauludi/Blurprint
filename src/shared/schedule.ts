/**
 * Day index + deterministic prompt schedule (spec §4.1, §4.2).
 * Pure functions only: the server is the single caller that matters, the
 * client never computes a prompt.
 */
import { DAY_MS, DECOY_SEED_SALT, GUESS_CHOICES, MAX_GUESS_CHOICES, PROMPT_SHUFFLE_SEED, ROLLOVER_UTC_HOUR } from './config';
import { SEASONS, SEASON_1_SIZE, promptsInGroup, type Prompt } from './prompts';
import type { Choice, DayIndex } from './types';

/** Start of the UTC "game day" (ROLLOVER_UTC_HOUR) that contains `ms`. */
export const startOfGameDayUtc = (ms: number): number => {
  const offset = ROLLOVER_UTC_HOUR * 3_600_000;
  return Math.floor((ms - offset) / DAY_MS) * DAY_MS + offset;
};

/**
 * Day 1 is the launch day. `epochMs` is the UTC ms of Day 1's rollover moment
 * (always stored already aligned with startOfGameDayUtc).
 */
export const getDayIndex = (nowMs: number, epochMs: number): DayIndex =>
  Math.floor((nowMs - epochMs) / DAY_MS) + 1;

/** UTC ms when `day` starts. */
export const dayStartMs = (day: DayIndex, epochMs: number): number => epochMs + (day - 1) * DAY_MS;

/** UTC ms of the next rollover after `nowMs`. */
export const nextRolloverMs = (nowMs: number): number => startOfGameDayUtc(nowMs) + DAY_MS;

/** mulberry32: tiny, fast, deterministic 32-bit PRNG. */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Fisher–Yates with an injected PRNG. Returns a new array. */
export const seededShuffle = <T>(items: readonly T[], rand: () => number): T[] => {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
};

let shuffledBank: Prompt[] | null = null;
/**
 * The play order: each season shuffled on its own (season 1 with
 * PROMPT_SHUFFLE_SEED, exactly as it always was), then concatenated. Adding a
 * season only appends days; it never moves one already scheduled.
 */
export const getShuffledBank = (): Prompt[] => {
  shuffledBank ??= SEASONS.flatMap((season, i) => seededShuffle(season, mulberry32((PROMPT_SHUFFLE_SEED + i * 0x9e37) >>> 0)));
  return shuffledBank;
};

const mod = (n: number, m: number): number => ((n % m) + m) % m;

/**
 * Prompt for day N. Pre-launch days (N ≤ 0) count back from the end of
 * season 1, as they always have: the shipped seed drawings are for those words.
 */
export const promptForDay = (day: DayIndex): Prompt => {
  const bank = getShuffledBank();
  if (day <= 0) return bank[mod(day - 1, SEASON_1_SIZE)]!;
  return bank[mod(day - 1, bank.length)]!;
};

/**
 * Choices for an answer: the answer + (count − 1) decoys from the same
 * silhouette group, in an order fixed by `seed`. Same for every player.
 */
export const choicesFor = (answer: Prompt, count: number, seed: number): Choice[] => {
  const n = Math.max(2, Math.min(MAX_GUESS_CHOICES, Math.trunc(count)));
  const rand = mulberry32(seed >>> 0);
  const others = promptsInGroup(answer.group).filter((p) => p.id !== answer.id);
  const decoys = seededShuffle(others, rand).slice(0, n - 1);
  return seededShuffle([answer, ...decoys], rand).map(({ id, word }) => ({ id, word }));
};

/** Choices for guessing day N's blend (`count` from the difficulty tier). */
export const choicesForDay = (day: DayIndex, count: number = GUESS_CHOICES): Choice[] =>
  choicesFor(promptForDay(day), count, (Math.imul(day, 0x9e3779b1) ^ DECOY_SEED_SALT) >>> 0);
