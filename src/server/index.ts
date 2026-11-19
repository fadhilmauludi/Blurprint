import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { context, createServer, getServerPort } from '@devvit/web/server';
import { deps, postRef, who } from './devvitDeps';
import { createApi } from './routes/api';
import { createInternal } from './routes/internal';
import { createTelemetry } from './routes/telemetry';

const app = new Hono();

// Telemetry first so /api/telemetry/* is not shadowed by the game API.
app.route('/api/telemetry', createTelemetry());
app.route('/api', createApi({ deps, who, post: postRef }));
app.route('/internal', createInternal({ deps, subredditName: () => context.subredditName }));

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
