/**
 * Scoring + streaks (spec §4.5, §4.6). Pure functions.
 */
import { POINTS, STREAK_MILESTONES } from './config';
import type { DayIndex } from './types';

export const guessPoints = (correct: boolean): number => (correct ? POINTS.correctGuess : POINTS.wrongGuess);

export const syncBonus = (sync: number): number => Math.round(Math.min(1, Math.max(0, sync)) * POINTS.syncMax);

export const streakBonus = (streak: number): number => POINTS.streakPerDay * Math.min(Math.max(0, streak), POINTS.streakCap);

export type StreakState = { streak: number; bestStreak: number; lastPlayedDay: DayIndex | null };

/**
 * A day counts when the player SUBMITS A DRAWING that day.
 *  - played yesterday → streak + 1
 *  - already played today → unchanged (idempotent)
 *  - otherwise (first day, or a gap) → 1
 */
export const nextStreak = (prev: StreakState, today: DayIndex): StreakState => {
  if (prev.lastPlayedDay === today) return prev;
  const streak = prev.lastPlayedDay === today - 1 ? prev.streak + 1 : 1;
  return { streak, bestStreak: Math.max(prev.bestStreak, streak), lastPlayedDay: today };
};

/** Streak to display on a given day: it's broken if the player missed yesterday and hasn't played today. */
export const displayStreak = (s: StreakState, today: DayIndex): number =>
  s.lastPlayedDay !== null && s.lastPlayedDay >= today - 1 ? s.streak : 0;

/** Returns the milestone just reached, or null. */
export const milestoneReached = (prevStreak: number, newStreak: number): number | null => {
  if (newStreak <= prevStreak) return null;
  return STREAK_MILESTONES.find((m) => m === newStreak) ?? null;
};

/** Points for submitting a drawing on a day where the streak becomes `streak`. */
export const drawDayPoints = (streak: number): number => POINTS.drawing + streakBonus(streak);
