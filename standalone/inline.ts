/** Inline the built JS + CSS into one HTML file (the artifact page). */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../dist-standalone/', import.meta.url).pathname;
let html = readFileSync(join(dir, 'index.html'), 'utf8');
const assets = join(dir, 'assets');
for (const f of readdirSync(assets)) {
  const body = readFileSync(join(assets, f), 'utf8');
  if (f.endsWith('.js')) {
    const tag = new RegExp(`<script type="module"[^>]*src="\\./assets/${f.replace('.', '\\.')}"[^>]*></script>`);
    html = html.replace(tag, () => `<script type="module">${body.replace(/<\/script/gi, '<\\/script')}</script>`);
  } else if (f.endsWith('.css')) {
    const tag = new RegExp(`<link rel="stylesheet"[^>]*href="\\./assets/${f.replace('.', '\\.')}"[^>]*>`);
    html = html.replace(tag, () => `<style>${body.replace(/<\/style/gi, '<\\/style')}</style>`);
  }
}
if (/assets\//.test(html)) throw new Error('an asset was not inlined');
writeFileSync(join(dir, 'blurprint-demo.html'), html);
console.log(`blurprint-demo.html · ${(html.length / 1024).toFixed(0)} KB`);
