import { describe, expect, it } from 'vitest';
import {
  bitsToGrid,
  boundingBox,
  emptyGrid,
  gridToBits,
  gridToIndices,
  indicesToGrid,
  normalize,
  type Grid,
} from '../normalize';

const S = 10;
const idx = (x: number, y: number) => y * S + x;
const fromPoints = (pts: [number, number][]): Grid => indicesToGrid(pts.map(([x, y]) => idx(x, y)));
const count = (g: Grid) => g.filter(Boolean).length;
const render = (g: Grid) =>
  Array.from({ length: S }, (_, y) => g.slice(y * S, y * S + S).map((v) => (v ? '#' : '.')).join('')).join('\n');

describe('helpers', () => {
  it('indices ↔ grid ↔ bits round-trip and ignore junk', () => {
    const g = indicesToGrid([0, 5, 99, -1, 100, 3.5]);
    expect(gridToIndices(g)).toEqual([0, 5, 99]);
    expect(bitsToGrid(gridToBits(g))).toEqual(g);
    expect(gridToBits(g)).toHaveLength(100);
  });
  it('boundingBox', () => {
    expect(boundingBox(emptyGrid())).toBeNull();
    expect(boundingBox(fromPoints([[2, 3], [7, 5]]))).toEqual({ minX: 2, maxX: 7, minY: 3, maxY: 5 });
  });
});

describe('normalize', () => {
  it('throws on empty input', () => {
    expect(() => normalize(emptyGrid())).toThrow(/empty/);
  });
  it('throws on wrong size', () => {
    expect(() => normalize([true, false])).toThrow();
  });
  it('a single cell is a 1×1 square and fills the grid (defined rule)', () => {
    expect(count(normalize(fromPoints([[4, 4]])))).toBe(100);
  });
  it('a 2×2 square in a corner becomes a centered full square', () => {
    const out = normalize(fromPoints([[0, 0], [1, 0], [0, 1], [1, 1]]));
    expect(count(out)).toBe(100);
  });
  it('a 3×3 square anywhere becomes the full grid', () => {
    const pts: [number, number][] = [];
    for (let y = 6; y < 9; y++) for (let x = 6; x < 9; x++) pts.push([x, y]);
    expect(count(normalize(fromPoints(pts)))).toBe(100);
  });
  it('a horizontal line stays a centered horizontal band', () => {
    const pts: [number, number][] = [];
    for (let x = 2; x < 7; x++) pts.push([x, 0]); // 5×1 at the top
    const out = normalize(fromPoints(pts));
    // scale = min(10/5, 10/1) = 2 → 10×2 band, centered vertically at rows 4–5
    expect(render(out).split('\n')).toEqual([
      '..........', '..........', '..........', '..........',
      '##########', '##########',
      '..........', '..........', '..........', '..........',
    ]);
  });
  it('a full-width line stays one row, centered', () => {
    const pts: [number, number][] = [];
    for (let x = 0; x < 10; x++) pts.push([x, 9]);
    const out = normalize(fromPoints(pts));
    expect(gridToIndices(out)).toEqual(Array.from({ length: 10 }, (_, x) => idx(x, 4)));
  });
  it('a vertical line becomes a centered vertical band', () => {
    const out = normalize(fromPoints([[9, 2], [9, 3], [9, 4]]));
    // 1×3 → scale 3.33 → 3×10, ox = floor(7/2) = 3
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) expect(out[idx(x, y)]).toBe(x >= 3 && x <= 5);
  });
  it('is translation invariant', () => {
    const shape: [number, number][] = [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]]; // T
    const a = normalize(fromPoints(shape));
    const b = normalize(fromPoints(shape.map(([x, y]) => [x + 5, y + 6])));
    expect(a).toEqual(b);
  });
  it('is scale invariant for clean 2× drawings', () => {
    const small: [number, number][] = [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]];
    const big: [number, number][] = small.flatMap(([x, y]) => [
      [2 * x, 2 * y], [2 * x + 1, 2 * y], [2 * x, 2 * y + 1], [2 * x + 1, 2 * y + 1],
    ] as [number, number][]);
    expect(normalize(fromPoints(small))).toEqual(normalize(fromPoints(big)));
  });
  it('is deterministic', () => {
    const g = fromPoints([[1, 1], [3, 2], [5, 5], [2, 7], [8, 8]]);
    expect(normalize(g)).toEqual(normalize(g));
  });
  it('a full grid stays full', () => {
    expect(count(normalize(new Array(100).fill(true)))).toBe(100);
  });
  it('never returns fewer than 1 filled cell, even for sparse diagonals', () => {
    // Sparse diagonal across the grid: each target cell is ~10% covered at most.
    const out = normalize(fromPoints([[0, 0], [9, 9]]), 10, 0.5);
    expect(count(out)).toBeGreaterThanOrEqual(1);
    // With an impossible threshold the fallback still keeps one cell.
    expect(count(normalize(fromPoints([[0, 0], [9, 9]]), 10, 1.01))).toBe(1);
  });
  it('does not mutate the input', () => {
    const g = fromPoints([[1, 1], [2, 2], [3, 3]]);
    const copy = g.slice();
    normalize(g);
    expect(g).toEqual(copy);
  });
});
