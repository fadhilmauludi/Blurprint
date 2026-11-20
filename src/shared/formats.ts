/**
 * Question formats (D-25): different ways the crowd's blend is revealed, so
 * the daily guess and duels don't feel the same every time. Pure functions;
 * the server decides the format, the client animates it.
 *
 *  - focus: the blend starts very blurry and pulls into focus.
 *  - zoom:  the camera starts zoomed into one patch and pulls back.
 *  - tiles: the blend is covered by a 4×4 grid of tiles that flip open.
 *  - pick:  (duels only) the word is given; choose its blend out of four.
 */
import { mulberry32, seededShuffle } from './schedule';
import type { DayIndex } from './types';

export type QuestionFormat = 'focus' | 'zoom' | 'tiles' | 'pick';

/** Formats for the shared daily puzzle (one blend, word choices). */
export const DAILY_FORMATS: readonly QuestionFormat[] = ['focus', 'zoom', 'tiles'];

export const FORMAT_INFO: Record<QuestionFormat, { name: string; rule: string; icon: string }> = {
  focus: { name: 'Focus pull', rule: 'The blur sharpens while the clock runs.', icon: '◎' },
  zoom: { name: 'Zoom out', rule: 'We start zoomed in on one patch and pull back.', icon: '⤢' },
  tiles: { name: 'Tile reveal', rule: 'Tiles flip open one by one. Guess before they’re all gone.', icon: '▦' },
  pick: { name: 'Pick the blend', rule: 'We give you the word. Which blur is it?', icon: '◫' },
};

/** Launch days (≤ 3) teach the focus pull; then zoom → tiles → focus → … (never twice in a row). */
export const formatForDay = (day: DayIndex): QuestionFormat => {
  if (day <= 3) return 'focus';
  const cycle: readonly QuestionFormat[] = ['zoom', 'tiles', 'focus'];
  return cycle[(day - 4) % cycle.length]!;
};

/** Duel rounds: round 1 is a focus pull, the rest a seeded mix with every other format. */
export const duelFormats = (seed: number, rounds: number): QuestionFormat[] => {
  if (rounds <= 0) return [];
  const rest: QuestionFormat[] = ['zoom', 'tiles', 'pick'];
  const rand = mulberry32((seed ^ 0xf0_7a_75) >>> 0);
  while (rest.length < rounds - 1) rest.push((['focus', 'zoom', 'tiles', 'pick'] as const)[Math.floor(rand() * 4)]!);
  const out: QuestionFormat[] = ['focus', ...seededShuffle(rest, rand)];
  return out.slice(0, rounds);
};

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const progress = (elapsedMs: number, seconds: number): number => clamp01(elapsedMs / (seconds * 1000));

/** Order in which the tile cover opens (a permutation of 0..total-1). */
export const tileOrder = (seed: number, total = 16): number[] =>
  seededShuffle(
    Array.from({ length: total }, (_, i) => i),
    mulberry32((seed ^ 0x711e5) >>> 0)
  );

/** Tiles open at the start of the clock. */
export const TILES_OPEN_AT_START = 3;

/** How many tiles are open: a few at once, all by the end, ease-in in between. */
export const tilesOpen = (elapsedMs: number, seconds: number, total = 16): number => {
  const t = progress(elapsedMs, seconds);
  return Math.min(total, TILES_OPEN_AT_START + Math.floor((total - TILES_OPEN_AT_START) * t * t + 1e-9));
};

/** Zoom factor: `startZoom` at the start, 1× at the end (ease-in, like the focus pull). */
export const zoomAt = (elapsedMs: number, seconds: number, startZoom: number): number => {
  const t = progress(elapsedMs, seconds);
  return startZoom - (startZoom - 1) * t * t;
};

/** Where the zoom starts (fractions of the blend), kept away from the edges. */
export const zoomFocus = (seed: number): { x: number; y: number } => {
  const rand = mulberry32((seed ^ 0x200a) >>> 0);
  return { x: 0.2 + rand() * 0.6, y: 0.2 + rand() * 0.6 };
};
