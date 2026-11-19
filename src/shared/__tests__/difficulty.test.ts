import { describe, expect, it } from 'vitest';
import { coarsen } from '../blend';
import { DIFFICULTY_TIERS, GUESS_GRACE_MS } from '../config';
import { focusBlurAt, isLate, speedFactor, tierForDay, timedPoints } from '../difficulty';
import { promptForDay, choicesForDay } from '../schedule';

describe('tiers', () => {
  it('ramp with the day and never go backwards', () => {
    expect(tierForDay(-2).level).toBe(1);
    expect(tierForDay(1).name).toBe('Warm-up');
    expect(tierForDay(3).level).toBe(1);
    expect(tierForDay(4).level).toBe(2);
    expect(tierForDay(8).level).toBe(3);
    expect(tierForDay(15).level).toBe(4);
    expect(tierForDay(400).level).toBe(4);
    let prev = tierForDay(1);
    for (let d = 2; d < 40; d++) {
      const t = tierForDay(d);
      expect(t.level).toBeGreaterThanOrEqual(prev.level);
      expect(t.choices).toBeGreaterThanOrEqual(prev.choices);
      expect(t.guessSeconds).toBeLessThanOrEqual(prev.guessSeconds);
      prev = t;
    }
  });

  it('choices grow with the tier and always contain the answer once', () => {
    for (const t of DIFFICULTY_TIERS) {
      for (let day = 1; day < 80; day++) {
        const c = choicesForDay(day, t.choices);
        expect(c).toHaveLength(t.choices);
        expect(c.filter((x) => x.id === promptForDay(day).id)).toHaveLength(1);
        expect(new Set(c.map((x) => x.id)).size).toBe(t.choices);
      }
    }
  });

  it('4-choice order is unchanged from the original schedule (determinism)', () => {
    expect(choicesForDay(7)).toEqual(choicesForDay(7, 4));
  });
});

describe('focus pull + speed scoring', () => {
  it('blur eases from startBlur to 1', () => {
    expect(focusBlurAt(0, 10, 4)).toBe(4);
    expect(focusBlurAt(10_000, 10, 4)).toBe(1);
    expect(focusBlurAt(99_000, 10, 4)).toBe(1);
    expect(focusBlurAt(5000, 10, 4)).toBeCloseTo(4 - 3 * 0.25);
  });

  it('speed factor falls from 1 to 0.5', () => {
    expect(speedFactor(0, 20)).toBe(1);
    expect(speedFactor(10_000, 20)).toBe(0.75);
    expect(speedFactor(20_000, 20)).toBe(0.5);
    expect(speedFactor(60_000, 20)).toBe(0.5);
  });

  it('points: multiplier × speed, rounded to 5; wrong or late = 0', () => {
    expect(timedPoints(true, 0, 20)).toBe(100);
    expect(timedPoints(true, 10_000, 20)).toBe(75);
    expect(timedPoints(true, 0, 10, 2)).toBe(200);
    expect(timedPoints(true, 5000, 10, 1.5)).toBe(115); // 150 × 0.75 = 112.5 → 115
    expect(timedPoints(false, 0, 20)).toBe(0);
    expect(timedPoints(true, 20_000 + GUESS_GRACE_MS + 1, 20)).toBe(0);
    expect(isLate(20_000 + GUESS_GRACE_MS, 20)).toBe(false);
  });
});

describe('teaser', () => {
  it('averages blocks and keeps the length', () => {
    const v = Array.from({ length: 100 }, (_, i) => (i === 0 ? 1 : 0));
    const t = coarsen(v, 2, 10);
    expect(t).toHaveLength(100);
    expect(t[0]).toBe(0.25);
    expect(t[1]).toBe(0.25);
    expect(t[10]).toBe(0.25);
    expect(t[11]).toBe(0.25);
    expect(t[2]).toBe(0);
    expect(coarsen(v, 1)).toEqual(v);
  });
});
