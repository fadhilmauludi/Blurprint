/**
 * Local harness: the real client + the real API routes over an in-memory store.
 *   npm run harness  →  http://localhost:5199/game.html?user=alice
 * Params: user=alice|bob|newbie|anon · post=<day> (defaults to today)
 * POST /__harness/reset rebuilds the scenario.
 */
import { fileURLToPath } from 'node:url';
import { getRequestListener } from '@hono/node-server';
import react from '@vitejs/plugin-react';
import { Hono } from 'hono';
import { defineConfig, type Plugin } from 'vite';
import { createApi } from '../src/server/routes/api';
import { getDayPostId, getToday } from '../src/server/services/dayService';
import { buildScenario, type Harness } from './scenario';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const cookie = (header: string | undefined, name: string): string | undefined =>
  header
    ?.split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === name)?.[1];

const harnessApi = (): Plugin => {
  let harness: Harness | null = null;
  let current: { user: string | undefined; post: string | undefined } = { user: undefined, post: undefined };
  const ready = async () => (harness ??= await buildScenario());

  return {
    name: 'blurprint-harness-api',
    configureServer(server) {
      const app = new Hono();
      app.post('/__harness/reset', async (c) => {
        const t = Number(c.req.query('today') ?? 2);
        harness = await buildScenario(Number.isInteger(t) && t >= 2 ? t : 2);
        todayCache = await getToday(harness.deps);
        return c.json({ ok: true });
      });
      app.all('/api/*', async (c, next) => {
        await ready();
        current = { user: cookie(c.req.header('cookie'), 'bp_user'), post: cookie(c.req.header('cookie'), 'bp_post') };
        await next();
      });
      app.route(
        '/api',
        createApi({
          get deps() {
            if (!harness) throw new Error('harness not ready');
            return harness.deps;
          },
          who: () => {
            const u = current.user ?? 'alice';
            return u === 'anon' ? { userId: undefined, username: undefined } : { userId: `t2_${u}`, username: u };
          },
          post: () => {
            const day = current.post !== undefined && current.post !== '' ? Number(current.post) : null;
            const d = day ?? todayCache;
            // Same ids the scenario's fake platform gives day posts (like a real t3 id).
            return { postId: `harness_day${d}`, postData: { day: d }, subredditName: 'blurprint_dev' };
          },
        })
      );
      let todayCache = 2;
      void ready().then(async (h) => {
        todayCache = await getToday(h.deps);
        console.log(`\n  Blurprint harness ready — today is Day ${todayCache}, post ${await getDayPostId(h.deps, todayCache)}\n`);
      });
      const listener = getRequestListener(app.fetch);
      server.middlewares.use((req, res, next) => {
        // The bare address opens the game as alice (handy for preview panes).
        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(302, { location: '/game.html?user=alice' });
          res.end();
          return;
        }
        if (req.url?.startsWith('/api/') || req.url?.startsWith('/__harness/')) void listener(req, res);
        else next();
      });
    },
  };
};

export default defineConfig({
  root: here('../src/client'),
  plugins: [react(), harnessApi()],
  resolve: {
    alias: {
      '@devvit/web/client': here('./mockClient.ts'),
      '@devvit/analytics/client/reddit': here('./mockTelemetry.ts'),
    },
  },
  server: { port: 5199, strictPort: true, fs: { allow: [here('..')] } },
});
