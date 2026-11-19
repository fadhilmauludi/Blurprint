/**
 * Gate check helper (spec §10, 26 Nov): renders the blend of every prompt in
 * the seed bank to docs/gate/<prompt>.png (blurred, as players see it) and
 * prints ASCII previews. Show the PNGs to a teammate WITHOUT the filenames and
 * ask them to pick from the 4 choices — Plan A needs ≥ 2 of 3 recognised.
 *
 *   npm run gate
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { displayValues, intensities } from '../src/shared/blend';
import { GRID_CELLS, GRID_SIZE } from '../src/shared/config';
import { gridToIndices, indicesToGrid, normalize } from '../src/shared/normalize';

type Bank = { prompts: Record<string, number[][]> };
const bank: Bank = JSON.parse(readFileSync(new URL('../src/server/seed/seed-bank.json', import.meta.url), 'utf8'));

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const png = (w: number, h: number, rgb: (x: number, y: number) => [number, number, number]) => {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = rgb(x, y);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// Blueprint ramp: bg #0B3D91 → cyan #7FDBFF → white.
const ramp = (t: number): [number, number, number] => {
  const bg = [11, 61, 145];
  const cy = [127, 219, 255];
  const wh = [255, 255, 255];
  const [a, b, u] = t < 0.7 ? [bg, cy, t / 0.7] : [cy, wh, (t - 0.7) / 0.3];
  return [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * u)) as [number, number, number];
};

const S = GRID_SIZE;
const PX = 240;
const BLUR = !process.argv.includes('--sharp');
mkdirSync(new URL('../docs/gate/', import.meta.url), { recursive: true });
for (const [prompt, drawings] of Object.entries(bank.prompts)) {
  const counts = new Array<number>(GRID_CELLS).fill(0);
  for (const d of drawings) for (const i of gridToIndices(normalize(indicesToGrid(d)))) counts[i]!++;
  const v = displayValues(intensities(counts, drawings.length));
  // Gaussian-ish blur by bilinear sampling of a 3×3-box-blurred field.
  const blurred = v.map((_, i) => {
    const x = i % S;
    const y = Math.floor(i / S);
    let sum = 0;
    let wsum = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!BLUR) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
        const w = dx === 0 && dy === 0 ? 8 : dx === 0 || dy === 0 ? 2 : 1;
        sum += v[ny * S + nx]! * w;
        wsum += w;
      }
    return BLUR ? sum / wsum : v[i]!;
  });
  const at = (gx: number, gy: number) => blurred[Math.min(S - 1, Math.max(0, gy)) * S + Math.min(S - 1, Math.max(0, gx))]!;
  const img = png(PX, PX, (px, py) => {
    const fx = (px / PX) * S - 0.5;
    const fy = (py / PX) * S - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const val =
      at(x0, y0) * (1 - tx) * (1 - ty) + at(x0 + 1, y0) * tx * (1 - ty) + at(x0, y0 + 1) * (1 - tx) * ty + at(x0 + 1, y0 + 1) * tx * ty;
    return ramp(Math.min(1, val));
  });
  writeFileSync(new URL(`../docs/gate/${prompt}.png`, import.meta.url), img);
  const shades = ' .:-=+*#%@';
  console.log(`\n${prompt} (${drawings.length} drawings)`);
  for (let y = 0; y < S; y++) console.log('  ' + v.slice(y * S, y * S + S).map((x) => shades[Math.min(9, Math.floor(x * 10))]!.repeat(2)).join(''));
}
console.log('\nWrote docs/gate/*.png');
