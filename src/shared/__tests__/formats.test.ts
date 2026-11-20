import { describe, expect, it } from 'vitest';
import { DAILY_FORMATS, duelFormats, formatForDay, FORMAT_INFO, tileOrder, tilesOpen, zoomAt, zoomFocus } from '../formats';

describe('daily question formats', () => {
  it('launch days teach the classic focus pull', () => {
    expect([-2, 0, 1, 2, 3].map(formatForDay)).toEqual(['focus', 'focus', 'focus', 'focus', 'focus']);
  });

  it('after launch, never the same format two days running and all of them appear every 3 days', () => {
    for (let d = 5; d < 200; d++) expect(formatForDay(d)).not.toBe(formatForDay(d - 1));
    for (let d = 4; d < 200; d++) {
      expect(new Set([formatForDay(d), formatForDay(d + 1), formatForDay(d + 2)])).toEqual(new Set(DAILY_FORMATS));
    }
  });

  it('daily formats only use one blend (no "pick the blend" in the shared daily puzzle)', () => {
    for (let d = -2; d < 100; d++) expect(DAILY_FORMATS).toContain(formatForDay(d));
    expect(DAILY_FORMATS).not.toContain('pick');
  });

  it('every format has a name and a one-line rule', () => {
    for (const f of ['focus', 'zoom', 'tiles', 'pick'] as const) {
      expect(FORMAT_INFO[f].name.length).toBeGreaterThan(2);
      expect(FORMAT_INFO[f].rule.length).toBeGreaterThan(10);
    }
  });
});

describe('duel formats', () => {
  it('round 1 is a focus pull, then a mix that includes every other format', () => {
    for (let seed = 1; seed < 60; seed++) {
      const f = duelFormats(seed, 5);
      expect(f).toHaveLength(5);
      expect(f[0]).toBe('focus');
      for (const kind of ['zoom', 'tiles', 'pick'] as const) expect(f).toContain(kind);
    }
  });

  it('is deterministic for a seed and varies across seeds', () => {
    expect(duelFormats(42, 5)).toEqual(duelFormats(42, 5));
    const seen = new Set(Array.from({ length: 30 }, (_, s) => duelFormats(s, 5).join(',')));
    expect(seen.size).toBeGreaterThan(3);
  });

  it('copes with short duels', () => {
    expect(duelFormats(7, 3)).toHaveLength(3);
    expect(duelFormats(7, 1)).toEqual(['focus']);
  });
});

describe('tile reveal', () => {
  it('order is a deterministic permutation', () => {
    const o = tileOrder(9, 16);
    expect([...o].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
    expect(tileOrder(9, 16)).toEqual(o);
    expect(tileOrder(10, 16)).not.toEqual(o);
  });

  it('opens a few tiles at the start, all by the end, never closes one', () => {
    expect(tilesOpen(0, 10, 16)).toBe(3);
    expect(tilesOpen(10_000, 10, 16)).toBe(16);
    expect(tilesOpen(99_000, 10, 16)).toBe(16);
    let prev = 0;
    for (let t = 0; t <= 10_000; t += 250) {
      const n = tilesOpen(t, 10, 16);
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
    // Ease-in: under half the tiles at half time.
    expect(tilesOpen(5000, 10, 16)).toBeLessThan(8);
  });
});

describe('zoom out', () => {
  it('starts zoomed in and ends at 1×', () => {
    expect(zoomAt(0, 10, 3)).toBe(3);
    expect(zoomAt(10_000, 10, 3)).toBe(1);
    expect(zoomAt(5000, 10, 3)).toBeCloseTo(3 - 2 * 0.25);
  });

  it('focus point stays off the edges and depends on the seed', () => {
    for (let s = 0; s < 50; s++) {
      const { x, y } = zoomFocus(s);
      for (const v of [x, y]) {
        expect(v).toBeGreaterThanOrEqual(0.2);
        expect(v).toBeLessThanOrEqual(0.8);
      }
    }
    expect(zoomFocus(1)).not.toEqual(zoomFocus(2));
  });
});
