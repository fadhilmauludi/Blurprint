import { GRID_CELLS } from '../../shared/config';
import { gridToIndices, indicesToGrid, normalize } from '../../shared/normalize';
import { promptForDay } from '../../shared/schedule';
import type { DayIndex } from '../../shared/types';
import type { Deps } from '../deps';
import { keys } from '../redisKeys';
import { SEED_BANK } from '../seed/seedBank';

export type SeedResult = { day: DayIndex; promptWord: string; loaded: number; skipped: boolean };

/**
 * Load seed drawings for `day` through the same normalize → counter pipeline
 * players use. No user keys are written; seeded drawings count as players.
 * Runs at most once per day (config:seedLoaded).
 */
export const loadSeedForDay = async (deps: Deps, day: DayIndex): Promise<SeedResult> => {
  const prompt = promptForDay(day);
  const drawings = SEED_BANK[prompt.id] ?? [];
  if (drawings.length === 0) return { day, promptWord: prompt.word, loaded: 0, skipped: true };

  const claimed = await deps.store.hSetNX(keys.seedLoaded(), String(day), String(deps.now()));
  if (claimed === 0) return { day, promptWord: prompt.word, loaded: 0, skipped: true };

  const counts = new Array<number>(GRID_CELLS).fill(0);
  let loaded = 0;
  for (const raw of drawings) {
    const cells = raw.filter((i) => Number.isInteger(i) && i >= 0 && i < GRID_CELLS);
    if (cells.length === 0) continue;
    for (const i of gridToIndices(normalize(indicesToGrid(cells)))) counts[i] = (counts[i] ?? 0) + 1;
    loaded++;
  }
  await Promise.all([
    ...counts.flatMap((n, i) => (n > 0 ? [deps.store.hIncrBy(keys.dayCells(day), String(i), n)] : [])),
    deps.store.incrBy(keys.dayTotal(day), loaded),
  ]);
  return { day, promptWord: prompt.word, loaded, skipped: false };
};

/** Seed every day in [from, to]. */
export const loadSeedRange = async (deps: Deps, from: DayIndex, to: DayIndex): Promise<SeedResult[]> => {
  const out: SeedResult[] = [];
  for (let d = from; d <= to; d++) out.push(await loadSeedForDay(deps, d));
  return out;
};
