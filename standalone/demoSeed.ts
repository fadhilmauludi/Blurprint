/**
 * Demo-only drawings for the standalone page, so every difficulty level has a
 * real "yesterday" (and a matching "today") to play. Procedural placeholders,
 * like the seed bank — never loaded into the Reddit app.
 */
import { mulberry32 } from '../src/shared/schedule';
import { SEED_BANK } from '../src/server/seed/seedBank';
import { circle, makeDrawings, minus, rect, union, type Shape } from '../tools/seedShapes';

const tri = (cx: number, top: number, bottom: number, halfBase: number): Shape => (x, y) =>
  y >= top && y <= bottom && Math.abs(x - cx) <= ((y - top) / (bottom - top)) * halfBase;

const DEMO_SHAPES: Record<string, Shape> = {
  // Diamond with a wavy tail.
  kite: union(
    (x, y) => Math.abs(x) / 0.55 + Math.abs(y + 0.35) / 0.6 <= 1,
    (x, y) => y > 0.25 && y < 1 && Math.abs(x - 0.18 * Math.sin(y * 9)) < 0.09
  ),
  // Cup with handles, stem, base.
  trophy: union(
    minus(circle(0, -0.45, 0.55), rect(-1, -1.2, 1, -0.45)),
    rect(-0.55, -0.85, 0.55, -0.45),
    minus(circle(-0.6, -0.55, 0.22), circle(-0.6, -0.55, 0.1)),
    minus(circle(0.6, -0.55, 0.22), circle(0.6, -0.55, 0.1)),
    rect(-0.1, 0.05, 0.1, 0.55),
    rect(-0.45, 0.55, 0.45, 0.8)
  ),
  // Tall stick with a flame.
  candle: union(rect(-0.22, -0.3, 0.22, 1), (x, y) => (x / 0.18) ** 2 + ((y + 0.62) / 0.3) ** 2 <= 1, rect(-0.03, -0.38, 0.03, -0.3)),
  // Dome with a door.
  igloo: minus(
    union(minus(circle(0, 0.45, 0.95), rect(-1.2, 0.45, 1.2, 1.5)), rect(-0.95, 0.35, 0.95, 0.5)),
    minus(circle(0, 0.5, 0.28), rect(-1, 0.55, 1, 1))
  ),
  // Top with four legs.
  table: union(rect(-0.95, -0.35, 0.95, -0.15), rect(-0.9, -0.15, -0.75, 0.8), rect(0.75, -0.15, 0.9, 0.8), rect(-0.45, -0.15, -0.32, 0.6), rect(0.32, -0.15, 0.45, 0.6)),
  // Round head, eye holes, jaw.
  skull: minus(
    union(circle(0, -0.2, 0.7), rect(-0.4, 0.3, 0.4, 0.75)),
    union(circle(-0.28, -0.15, 0.17), circle(0.28, -0.15, 0.17), tri(0, 0.1, 0.32, 0.1), rect(-0.06, 0.55, 0.06, 0.75))
  ),
};

const rand = mulberry32(0xde_70);
const DEMO_BANK: Record<string, number[][]> = Object.fromEntries(
  Object.entries(DEMO_SHAPES).map(([id, shape]) => [id, makeDrawings(shape, 18, rand)])
);

/** Drawings for a prompt: the real seed bank first, then the demo shapes. */
export const drawingsFor = (promptId: string): number[][] => SEED_BANK[promptId] ?? DEMO_BANK[promptId] ?? [];
