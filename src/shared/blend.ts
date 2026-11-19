/**
 * Blend math (spec §4.4, §4.5 crowd sync).
 */
import { BLEND_GAMMA, GRID_CELLS } from './config';
import type { Grid } from './normalize';

/** Intensities v = count / total, 0..1. All zeros when total is 0. */
export const intensities = (counts: readonly number[], total: number): number[] =>
  counts.map((c) => (total > 0 ? Math.min(1, Math.max(0, c / total)) : 0));

/** Display value d = v ^ gamma. */
export const displayValue = (v: number, gamma = BLEND_GAMMA): number => (v <= 0 ? 0 : Math.pow(v, gamma));

/** Turn a sparse Redis hash { cellIndex: count } into a dense array. Ignores junk fields. */
export const countsFromHash = (hash: Record<string, string>, cells = GRID_CELLS): number[] => {
  const counts = new Array<number>(cells).fill(0);
  for (const [k, v] of Object.entries(hash)) {
    const i = Number(k);
    const n = Number(v);
    if (Number.isInteger(i) && i >= 0 && i < cells && Number.isFinite(n) && n > 0) counts[i] = n;
  }
  return counts;
};

/**
 * Crowd sync = cosine similarity between the player's 0/1 drawing and the
 * final blend vector v. Returns 0..1 (0 if either vector is all zeros).
 */
export const cosineSync = (drawing: Grid, v: readonly number[]): number => {
  let dot = 0;
  let nd = 0;
  let nv = 0;
  const n = Math.min(drawing.length, v.length);
  for (let i = 0; i < n; i++) {
    const d = drawing[i] ? 1 : 0;
    const x = v[i] ?? 0;
    dot += d * x;
    nd += d;
    nv += x * x;
  }
  if (nd === 0 || nv === 0) return 0;
  return Math.min(1, Math.max(0, dot / (Math.sqrt(nd) * Math.sqrt(nv))));
};
