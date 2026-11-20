/**
 * Moderation helpers (D-31). A crude doodle in a blend is, by construction,
 * the drawing that agrees least with everyone else: it fills cells few other
 * players filled. Ranking by agreement lets a moderator remove it without
 * ever being shown individual drawings (players' drawings stay private).
 * Coordinated rude shapes (many players) are handled by hiding the blend.
 */
import { GRID_CELLS } from './config';

/**
 * Mean share of the OTHER players who also filled each of this drawing's
 * cells (0..1). `counts` and `total` include this drawing.
 */
export const agreement = (cells: readonly number[], counts: readonly number[], total: number): number => {
  if (cells.length === 0 || total <= 1) return 0;
  let sum = 0;
  for (const c of cells) sum += Math.max(0, (counts[c] ?? 0) - 1) / (total - 1);
  return sum / cells.length;
};

export type Outlier = { userId: string; cells: number[]; score: number };

const BITS = new RegExp(`^[01]{${GRID_CELLS}}$`);

/** Stored drawings (userId → bits) ranked from least to most like the crowd. Skips timeouts. */
export const rankOutliers = (
  entries: readonly (readonly [string, string])[],
  counts: readonly number[],
  total: number
): Outlier[] =>
  entries
    .filter(([, bits]) => BITS.test(bits))
    .map(([userId, bits]) => {
      const cells: number[] = [];
      for (let i = 0; i < bits.length; i++) if (bits[i] === '1') cells.push(i);
      return { userId, cells, score: agreement(cells, counts, total) };
    })
    .sort((a, b) => a.score - b.score || a.userId.localeCompare(b.userId));
