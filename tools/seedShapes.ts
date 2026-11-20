/**
 * Procedural "hand-drawn-ish" drawings from shape functions (random size,
 * position, outline vs. filled, dropout, stray cells). Used by tools/make-seed.ts
 * (placeholder seed bank) and the standalone demo page. Browser-safe.
 */
import { GRID_SIZE, MAX_CELLS, MIN_CELLS } from '../src/shared/config';

export type Shape = (x: number, y: number) => boolean; // x,y in [-1,1], y down

export const circle = (cx: number, cy: number, r: number) => (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
export const rect = (x0: number, y0: number, x1: number, y1: number) => (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
export const union = (...s: Shape[]): Shape => (x, y) => s.some((f) => f(x, y));
export const minus = (a: Shape, b: Shape): Shape => (x, y) => a(x, y) && !b(x, y);

export const SHAPES: Record<string, Shape> = {
  heart: (x, y) => {
    const X = x * 1.15;
    const Y = -(y * 1.15) + 0.25;
    return (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0;
  },
  sun: union(circle(0, 0, 0.45), (x, y) => {
    const r = Math.hypot(x, y);
    const a = Math.atan2(y, x);
    return r > 0.55 && r < 1 && Math.abs(Math.sin(a * 4)) < 0.28;
  }),
  crown: union(rect(-0.9, 0.2, 0.9, 0.7), (x, y) => {
    if (y < -0.7 || y > 0.2 || Math.abs(x) > 0.9) return false;
    const t = ((x + 0.9) / 1.8) * 3; // 3 teeth
    const tri = 1 - Math.abs((t % 1) * 2 - 1); // 0..1..0
    return y >= 0.2 - tri * 0.9;
  }),
  ghost: minus(
    union(circle(0, -0.25, 0.65), (x, y) => {
      if (Math.abs(x) > 0.65 || y < -0.25) return false;
      const wave = 0.75 + 0.15 * Math.cos((x + 0.65) * Math.PI * 2.3);
      return y <= wave;
    }),
    union(circle(-0.25, -0.3, 0.13), circle(0.25, -0.3, 0.13))
  ),
  raindrop: (x, y) => {
    // Teardrop: circle at the bottom, point at the top.
    if (y > 0.2) return x * x + (y - 0.35) ** 2 <= 0.62 ** 2;
    const halfWidth = ((y + 1) / 1.2) * 0.6;
    return y >= -1 && Math.abs(x) <= halfWidth;
  },
  sword: union(rect(-0.1, -1, 0.1, 0.35), rect(-0.45, 0.35, 0.45, 0.5), rect(-0.08, 0.5, 0.08, 0.95)),
  hammer: union(rect(-0.65, -0.9, 0.65, -0.45), rect(-0.12, -0.45, 0.12, 1)),
};

export const rasterize = (shape: Shape, rand: () => number): number[] => {
  const S = GRID_SIZE;
  const size = S * (0.55 + rand() * 0.45); // cells spanned by [-1,1]
  const cx = size / 2 + rand() * (S - size);
  const cy = size / 2 + rand() * (S - size);
  const squash = 0.9 + rand() * 0.2;
  const inside = new Array<boolean>(S * S).fill(false);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const jx = (rand() - 0.5) * 0.35;
      const jy = (rand() - 0.5) * 0.35;
      const u = ((x + 0.5 + jx - cx) / size) * 2;
      const v = (((y + 0.5 + jy - cy) / size) * 2) / squash;
      inside[y * S + x] = Math.abs(u) <= 1.05 && Math.abs(v) <= 1.05 && shape(u, v);
    }
  const outline = rand() < 0.6;
  let cells: number[] = [];
  inside.forEach((on, i) => {
    if (!on) return;
    if (!outline) return void cells.push(i);
    const x = i % S;
    const y = Math.floor(i / S);
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx!;
      const ny = y + dy!;
      return nx < 0 || ny < 0 || nx >= S || ny >= S || !inside[ny * S + nx];
    });
    if (edge) cells.push(i);
  });
  cells = cells.filter(() => rand() > 0.06); // sloppy strokes
  const strays = Math.floor(rand() * 3);
  for (let k = 0; k < strays; k++) cells.push(Math.floor(rand() * S * S));
  cells = [...new Set(cells)].sort((a, b) => a - b);
  return cells.slice(0, MAX_CELLS);
};


/** `count` drawings of `shape` with at least MIN_CELLS cells each. */
export const makeDrawings = (shape: Shape, count: number, rand: () => number): number[][] => {
  const out: number[][] = [];
  while (out.length < count) {
    const d = rasterize(shape, rand);
    if (d.length >= MIN_CELLS) out.push(d);
  }
  return out;
};

const tri =
  (cx: number, top: number, bottom: number, halfBase: number): Shape =>
  (x, y) =>
    y >= top && y <= bottom && Math.abs(x - cx) <= ((y - top) / (bottom - top)) * halfBase;
const ellipse =
  (cx: number, cy: number, rx: number, ry: number): Shape =>
  (x, y) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const ring = (cx: number, cy: number, r: number, inner: number): Shape => minus(circle(cx, cy, r), circle(cx, cy, inner));
const arc =
  (cx: number, cy: number, r: number, inner: number, below: number): Shape =>
  (x, y) =>
    y > below && Math.hypot(x - cx, y - cy) <= r && Math.hypot(x - cx, y - cy) >= inner;

/**
 * More silhouettes (Sprint 7, D-26): one or more per prompt group so duels and
 * the demo have variety. Appended after SHAPES so the original seed drawings
 * keep their exact random sequence.
 */
export const EXTRA_SHAPES: Record<string, Shape> = {
  // round
  donut: ring(0, 0, 0.85, 0.35),
  flower: union(circle(0, 0, 0.25), ...[0, 1, 2, 3, 4, 5].map((k) => circle(0.55 * Math.cos((k * Math.PI) / 3), 0.55 * Math.sin((k * Math.PI) / 3), 0.3))),
  // tall-thin
  candle: union(rect(-0.22, -0.3, 0.22, 1), ellipse(0, -0.62, 0.18, 0.3), rect(-0.03, -0.38, 0.03, -0.3)),
  tree: union(circle(0, -0.3, 0.62), rect(-0.13, 0.25, 0.13, 1)),
  rocket: union(ellipse(0, -0.05, 0.3, 0.85), (x, y) => y > 0.35 && y < 0.95 && Math.abs(x) < 0.3 + (y - 0.35) * 0.75),
  // dome
  igloo: minus(
    union(minus(circle(0, 0.45, 0.95), rect(-1.2, 0.45, 1.2, 1.5)), rect(-0.95, 0.35, 0.95, 0.5)),
    minus(circle(0, 0.5, 0.28), rect(-1, 0.55, 1, 1))
  ),
  umbrella: union((x, y) => y <= 0 && x * x + y * y <= 0.81, rect(-0.05, 0, 0.05, 0.8), arc(0.2, 0.8, 0.25, 0.12, 0.8)),
  mushroom: union((x, y) => y <= 0.05 && ((x / 0.95) ** 2 + ((y + 0.05) / 0.75) ** 2 <= 1), rect(-0.28, 0.05, 0.28, 0.85)),
  // house
  house: union(rect(-0.6, 0, 0.6, 0.9), tri(0, -0.85, 0, 0.85)),
  tent: minus(tri(0, -0.8, 0.9, 0.9), tri(0, 0.3, 0.9, 0.25)),
  castle: minus(
    union(rect(-0.8, -0.2, 0.8, 0.9), rect(-0.8, -0.55, -0.5, -0.2), rect(-0.15, -0.55, 0.15, -0.2), rect(0.5, -0.55, 0.8, -0.2)),
    rect(-0.18, 0.45, 0.18, 0.9)
  ),
  // four-legged
  table: union(rect(-0.95, -0.35, 0.95, -0.15), rect(-0.9, -0.15, -0.75, 0.8), rect(0.75, -0.15, 0.9, 0.8), rect(-0.45, -0.15, -0.32, 0.6), rect(0.32, -0.15, 0.45, 0.6)),
  cat: union(circle(0, 0.15, 0.62), tri(-0.42, -0.85, -0.2, 0.22), tri(0.42, -0.85, -0.2, 0.22)),
  // long
  fish: union(ellipse(-0.15, 0, 0.65, 0.42), (x, y) => x > 0.42 && x < 0.95 && Math.abs(y) < (x - 0.42) * 0.95),
  car: union(rect(-0.9, -0.1, 0.9, 0.4), rect(-0.45, -0.5, 0.45, -0.1), circle(-0.5, 0.45, 0.22), circle(0.5, 0.45, 0.22)),
  // heart-drop
  apple: union(circle(0, 0.15, 0.7), rect(-0.04, -0.78, 0.04, -0.5), circle(0.22, -0.66, 0.14)),
  balloon: union(ellipse(0, -0.25, 0.6, 0.7), rect(-0.03, 0.45, 0.03, 1)),
  // spiky
  star: (x, y) => {
    const a = Math.atan2(y, x) + Math.PI / 2;
    return Math.hypot(x, y) <= 0.38 + 0.6 * Math.abs(Math.cos(2.5 * a)) ** 6;
  },
  cactus: union(rect(-0.18, -0.9, 0.18, 1), rect(-0.6, -0.2, -0.18, 0.05), rect(-0.6, -0.6, -0.42, -0.2), rect(0.18, 0, 0.6, 0.22), rect(0.42, -0.4, 0.6, 0)),
  // cup-bowl
  mug: union(rect(-0.55, -0.6, 0.45, 0.8), ring(0.55, 0.05, 0.35, 0.18)),
  trophy: union(
    minus(circle(0, -0.45, 0.55), rect(-1, -1.2, 1, -0.45)),
    rect(-0.55, -0.85, 0.55, -0.45),
    ring(-0.6, -0.55, 0.22, 0.1),
    ring(0.6, -0.55, 0.22, 0.1),
    rect(-0.1, 0.05, 0.1, 0.55),
    rect(-0.45, 0.55, 0.45, 0.8)
  ),
  // face
  smiley: union(ring(0, 0, 0.88, 0.7), circle(-0.3, -0.25, 0.12), circle(0.3, -0.25, 0.12), arc(0, 0, 0.5, 0.34, 0.12)),
  skull: minus(
    union(circle(0, -0.2, 0.7), rect(-0.4, 0.3, 0.4, 0.75)),
    union(circle(-0.28, -0.15, 0.17), circle(0.28, -0.15, 0.17), tri(0, 0.1, 0.32, 0.1), rect(-0.06, 0.55, 0.06, 0.75))
  ),
  // tool
  key: union(ring(-0.5, 0, 0.42, 0.18), rect(-0.1, -0.08, 0.95, 0.08), rect(0.6, 0.08, 0.7, 0.32), rect(0.8, 0.08, 0.9, 0.26)),
  anchor: union(rect(-0.07, -0.7, 0.07, 0.75), ring(0, -0.82, 0.18, 0.08), rect(-0.4, -0.5, 0.4, -0.4), arc(0, 0.1, 0.8, 0.62, 0.2)),
  // flying
  kite: union(
    (x, y) => Math.abs(x) / 0.55 + Math.abs(y + 0.35) / 0.6 <= 1,
    (x, y) => y > 0.25 && y < 1 && Math.abs(x - 0.18 * Math.sin(y * 9)) < 0.09
  ),
  plane: union(rect(-0.1, -0.9, 0.1, 0.9), rect(-0.95, -0.15, 0.95, 0.1), rect(-0.4, 0.65, 0.4, 0.8)),
  butterfly: union(circle(-0.45, -0.35, 0.4), circle(0.45, -0.35, 0.4), circle(-0.35, 0.4, 0.3), circle(0.35, 0.4, 0.3), rect(-0.06, -0.6, 0.06, 0.7)),
};
