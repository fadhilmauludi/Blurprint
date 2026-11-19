/**
 * Generates PLACEHOLDER seed drawings: src/server/seed/seed-bank.json
 *
 *   npx tsx tools/make-seed.ts
 *
 * These are procedural "hand-drawn-ish" drawings (random size, position,
 * outline vs. filled, dropout, stray cells) so the launch days and the local
 * harness have a realistic "yesterday". Replace them with real team/playtester
 * drawings (dev "Copy my drawing" button) before submission — see §11.
 */
import { writeFileSync } from 'node:fs';
import { mulberry32 } from '../src/shared/schedule';
import { SHAPES, makeDrawings } from './seedShapes';

const rand = mulberry32(20261119);
const prompts: Record<string, number[][]> = {};
for (const [id, shape] of Object.entries(SHAPES)) prompts[id] = makeDrawings(shape, 18, rand);

writeFileSync(
  new URL('../src/server/seed/seed-bank.json', import.meta.url),
  JSON.stringify(
    {
      version: 1,
      placeholder: true,
      note: 'Procedural placeholder drawings from tools/make-seed.ts. Replace with real team/playtester drawings before submission (spec §11).',
      prompts,
    },
    null,
    0
  ).replace(/\],\[/g, '],\n[') + '\n'
);
console.log(Object.entries(prompts).map(([k, v]) => `${k}: ${v.length}`).join(', '));
