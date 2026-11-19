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
