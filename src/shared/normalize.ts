/**
 * Normalization (spec §4.3) — makes drawings of different sizes and positions
 * line up so the crowd average is readable instead of a gray smudge.
 *
 * Rule: crop to the bounding box of filled cells, scale uniformly (aspect ratio
 * kept) so the longer side fills the grid, center it, then area-sample: a
 * target cell is filled when the source covers ≥ threshold of it.
 *
 * Defined edge cases (all unit-tested):
 *  - Empty input throws (callers must validate MIN_CELLS first).
 *  - A single filled cell is a 1×1 square, so it scales to fill the whole grid.
 *    The server never sees this case because MIN_CELLS = 3.
 *  - Output always has ≥ 1 filled cell: if sampling leaves nothing above the
 *    threshold (very thin diagonal strokes), the best-covered cell is kept.
 *
 * The server runs this on every drawing (never trust the client). The client
 * runs the same function only to preview.
 */
import { COVERAGE_THRESHOLD, GRID_SIZE } from './config';

export type Grid = boolean[];

export const emptyGrid = (size = GRID_SIZE): Grid => new Array<boolean>(size * size).fill(false);

export const indicesToGrid = (cells: readonly number[], size = GRID_SIZE): Grid => {
  const grid = emptyGrid(size);
  for (const i of cells) {
    if (Number.isInteger(i) && i >= 0 && i < size * size) grid[i] = true;
  }
  return grid;
};

export const gridToIndices = (grid: Grid): number[] => {
  const out: number[] = [];
  grid.forEach((v, i) => {
    if (v) out.push(i);
  });
  return out;
};

/** Compact storage format: GRID² chars of '0'/'1'. */
export const gridToBits = (grid: Grid): string => grid.map((v) => (v ? '1' : '0')).join('');
export const bitsToGrid = (bits: string): Grid => Array.from(bits, (c) => c === '1');

export type BBox = { minX: number; maxX: number; minY: number; maxY: number };

export const boundingBox = (grid: Grid, size = GRID_SIZE): BBox | null => {
  let minX = size;
  let minY = size;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i]) continue;
    const x = i % size;
    const y = Math.floor(i / size);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return maxX < 0 ? null : { minX, maxX, minY, maxY };
};

/** Length of the overlap of [a0,a1) and [b0,b1). */
const overlap = (a0: number, a1: number, b0: number, b1: number): number =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

export const normalize = (grid: Grid, size = GRID_SIZE, threshold = COVERAGE_THRESHOLD): Grid => {
  if (grid.length !== size * size) throw new Error(`normalize: expected ${size * size} cells, got ${grid.length}`);
  const box = boundingBox(grid, size);
  if (!box) throw new Error('normalize: empty drawing');

  const w = box.maxX - box.minX + 1;
  const h = box.maxY - box.minY + 1;
  const scale = Math.min(size / w, size / h);
  const tw = Math.max(1, Math.min(size, Math.round(w * scale)));
  const th = Math.max(1, Math.min(size, Math.round(h * scale)));
  const ox = Math.floor((size - tw) / 2);
  const oy = Math.floor((size - th) / 2);

  // Source units covered by one target cell, per axis (exactly maps the bbox onto the target box).
  const sx = w / tw;
  const sy = h / th;

  const out = emptyGrid(size);
  let bestIdx = -1;
  let bestCov = -1;

  for (let ty = 0; ty < th; ty++) {
    const y0 = ty * sy;
    const y1 = y0 + sy;
    for (let tx = 0; tx < tw; tx++) {
      const x0 = tx * sx;
      const x1 = x0 + sx;
      let covered = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const oyLen = overlap(y0, y1, yy, yy + 1);
        if (oyLen <= 0) continue;
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const oxLen = overlap(x0, x1, xx, xx + 1);
          if (oxLen <= 0) continue;
          if (grid[(box.minY + yy) * size + (box.minX + xx)]) covered += oxLen * oyLen;
        }
      }
      const coverage = covered / (sx * sy);
      const idx = (oy + ty) * size + (ox + tx);
      // Small epsilon so exact-threshold coverage is stable across float rounding.
      if (coverage + 1e-9 >= threshold) out[idx] = true;
      if (coverage > bestCov) {
        bestCov = coverage;
        bestIdx = idx;
      }
    }
  }

  if (!out.some(Boolean) && bestIdx >= 0) out[bestIdx] = true;
  return out;
};
