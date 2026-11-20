import { describe, expect, it } from 'vitest';
import { agreement, rankOutliers } from '../moderation';

const bits = (cells: number[], size = 100) => Array.from({ length: size }, (_, i) => (cells.includes(i) ? '1' : '0')).join('');

describe('agreement', () => {
  it('is 1 when everyone else filled the same cells, 0 when nobody did', () => {
    const counts = new Array<number>(100).fill(0);
    for (const c of [1, 2, 3]) counts[c] = 5;
    expect(agreement([1, 2, 3], counts, 5)).toBe(1);
    counts[90] = 1;
    expect(agreement([90], counts, 5)).toBe(0);
  });
  it('is 0 for an empty drawing or a crowd of one', () => {
    expect(agreement([], new Array(100).fill(0), 5)).toBe(0);
    expect(agreement([1], [0, 1], 1)).toBe(0);
  });
});

describe('rankOutliers', () => {
  it('puts the drawing that matches the crowd least first', () => {
    const crowd = [10, 11, 12, 20, 21, 22];
    const rude = [70, 71, 80, 81, 90, 91];
    const entries: [string, string][] = [
      ['a', bits(crowd)],
      ['b', bits(crowd)],
      ['c', bits([...crowd, 30])],
      ['d', bits(crowd)],
      ['bad', bits(rude)],
    ];
    const counts = new Array<number>(100).fill(0);
    for (const [, b] of entries) for (let i = 0; i < 100; i++) if (b[i] === '1') counts[i]! += 1;
    const ranked = rankOutliers(entries, counts, entries.length);
    expect(ranked[0]!.userId).toBe('bad');
    expect(ranked[0]!.cells).toEqual(rude);
    expect(ranked.at(-1)!.score).toBeGreaterThan(ranked[0]!.score);
  });
  it('skips timeouts and malformed values', () => {
    const ranked = rankOutliers([['t', 'timeout'], ['x', 'abc'], ['ok', bits([1])]], [0, 1], 1);
    expect(ranked.map((r) => r.userId)).toEqual(['ok']);
  });
});
