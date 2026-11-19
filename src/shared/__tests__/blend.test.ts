import { describe, expect, it } from 'vitest';
import { cosineSync, countsFromHash, displayValue, intensities } from '../blend';
import { indicesToGrid } from '../normalize';

describe('intensities', () => {
  it('divides by total and clamps', () => {
    expect(intensities([0, 1, 2, 5], 4)).toEqual([0, 0.25, 0.5, 1]);
  });
  it('is all zero when total is 0', () => {
    expect(intensities([3, 1], 0)).toEqual([0, 0]);
  });
});

describe('displayValue', () => {
  it('applies gamma and keeps endpoints', () => {
    expect(displayValue(0)).toBe(0);
    expect(displayValue(1)).toBe(1);
    expect(displayValue(0.25, 0.5)).toBeCloseTo(0.5);
    expect(displayValue(0.2)).toBeGreaterThan(0.2); // gamma < 1 lifts weak agreement
  });
});

describe('countsFromHash', () => {
  it('builds a dense array and ignores junk', () => {
    const c = countsFromHash({ '0': '3', '99': '1', '100': '9', x: '2', '5': 'NaN', '6': '-1' }, 100);
    expect(c[0]).toBe(3);
    expect(c[99]).toBe(1);
    expect(c.reduce((a, b) => a + b, 0)).toBe(4);
  });
});

describe('cosineSync', () => {
  it('is 1 for a drawing identical to a crisp blend', () => {
    const g = indicesToGrid([1, 2, 3]);
    const v = g.map((b) => (b ? 1 : 0));
    expect(cosineSync(g, v)).toBeCloseTo(1);
  });
  it('is 0 for disjoint drawings', () => {
    expect(cosineSync(indicesToGrid([1]), indicesToGrid([2]).map((b) => (b ? 1 : 0)))).toBe(0);
  });
  it('is 0 for empty vectors', () => {
    expect(cosineSync(indicesToGrid([]), new Array(100).fill(0.5))).toBe(0);
    expect(cosineSync(indicesToGrid([1]), new Array(100).fill(0))).toBe(0);
  });
  it('partial overlap is between 0 and 1', () => {
    const v = new Array(100).fill(0);
    v[1] = 1;
    v[2] = 0.5;
    const s = cosineSync(indicesToGrid([1, 3]), v);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
});
