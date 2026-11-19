/**
 * Standalone demo build: one self-contained HTML page with the real client and
 * the real API routes running in the browser.
 *   npm run demo:build  →  dist-standalone/blurprint-demo.html
 */
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('.'),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@devvit/web/client': here('./mockClient.ts'),
      '@devvit/analytics/client/reddit': here('../harness/mockTelemetry.ts'),
    },
  },
  build: {
    outDir: here('../dist-standalone'),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  server: { port: 5198, strictPort: true, fs: { allow: [here('..')] } },
});
