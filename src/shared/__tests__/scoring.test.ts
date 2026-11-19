import { describe, expect, it } from 'vitest';
import {
  displayStreak,
  drawDayPoints,
  guessPoints,
  milestoneReached,
  nextStreak,
  streakBonus,
  syncBonus,
  type StreakState,
} from '../scoring';

const fresh: StreakState = { streak: 0, bestStreak: 0, lastPlayedDay: null };

describe('points', () => {
  it('guess', () => {
    expect(guessPoints(true)).toBe(100);
    expect(guessPoints(false)).toBe(0);
  });
  it('sync bonus is round(sync × 50), clamped', () => {
    expect(syncBonus(0.78)).toBe(39);
    expect(syncBonus(1)).toBe(50);
    expect(syncBonus(-1)).toBe(0);
    expect(syncBonus(2)).toBe(50);
  });
  it('streak bonus caps at 7 days', () => {
    expect(streakBonus(1)).toBe(10);
    expect(streakBonus(7)).toBe(70);
    expect(streakBonus(30)).toBe(70);
    expect(drawDayPoints(3)).toBe(20 + 30);
  });
});

describe('nextStreak', () => {
  it('first day → 1', () => {
    expect(nextStreak(fresh, 5)).toEqual({ streak: 1, bestStreak: 1, lastPlayedDay: 5 });
  });
  it('consecutive days increment', () => {
    let s = nextStreak(fresh, 5);
    s = nextStreak(s, 6);
    s = nextStreak(s, 7);
    expect(s).toEqual({ streak: 3, bestStreak: 3, lastPlayedDay: 7 });
  });
  it('a gap resets to 1 but keeps bestStreak', () => {
    let s = nextStreak(nextStreak(nextStreak(fresh, 1), 2), 3);
    s = nextStreak(s, 5);
    expect(s).toEqual({ streak: 1, bestStreak: 3, lastPlayedDay: 5 });
  });
  it('playing twice in one day is idempotent', () => {
    const s = nextStreak(fresh, 9);
    expect(nextStreak(s, 9)).toBe(s);
  });
  it('UTC boundary: day index is the only clock, so 23:59 → 00:00 counts as consecutive', () => {
    const s = nextStreak({ streak: 4, bestStreak: 4, lastPlayedDay: 10 }, 11);
    expect(s.streak).toBe(5);
  });
});

describe('displayStreak', () => {
  it('shows the streak if played today or yesterday, else 0', () => {
    const s: StreakState = { streak: 4, bestStreak: 4, lastPlayedDay: 10 };
    expect(displayStreak(s, 10)).toBe(4);
    expect(displayStreak(s, 11)).toBe(4);
    expect(displayStreak(s, 12)).toBe(0);
    expect(displayStreak(fresh, 1)).toBe(0);
  });
});

describe('milestoneReached', () => {
  it('detects 3/7/14/30 only when crossing', () => {
    expect(milestoneReached(2, 3)).toBe(3);
    expect(milestoneReached(6, 7)).toBe(7);
    expect(milestoneReached(3, 3)).toBeNull();
    expect(milestoneReached(3, 4)).toBeNull();
    expect(milestoneReached(29, 30)).toBe(30);
  });
});
