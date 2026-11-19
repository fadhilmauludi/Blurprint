import { Hono } from 'hono';
import { telemetry } from '@devvit/analytics/server/reddit';
import { isRecord, readJson } from './respond';

/**
 * Hono port of the Express `createTelemetryRouter()` from @devvit/analytics
 * (0.15.4). The browser telemetry client POSTs to /api/telemetry/journey/*.
 * See docs/DECISIONS.md D-10. Events are dropped by Reddit until the journey
 * map is approved — that's expected.
 */
export const createTelemetry = (): Hono => {
  const t = new Hono();
  const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
  const bad = (error: string) => ({ error, receipt: { status: 'JOURNEY_RECEIPT_INVALID', message: 'Invalid: Event payload was not recorded.' } });

  t.post('/journey/start', async (c) => {
    try {
      return c.json(await telemetry.startJourney());
    } catch (e) {
      console.warn('telemetry start failed', e instanceof Error ? e.message : e);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  t.post('/journey/progress', async (c) => {
    const b = await readJson(c);
    if (!isRecord(b) || !nonEmpty(b.journeyId) || typeof b.progress !== 'number' || b.progress < 0 || b.progress > 1) {
      return c.json(bad('journeyId and progress (0..1) are required.'), 400);
    }
    try {
      return c.json(
        await telemetry.journeyProgress({
          journeyId: b.journeyId,
          progress: b.progress,
          ...(nonEmpty(b.action) ? { action: b.action } : {}),
          ...(nonEmpty(b.actionDetails) ? { actionDetails: b.actionDetails } : {}),
        })
      );
    } catch (e) {
      console.warn('telemetry progress failed', e instanceof Error ? e.message : e);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  t.post('/journey/interaction', async (c) => {
    const b = await readJson(c);
    if (!isRecord(b) || !nonEmpty(b.action)) return c.json(bad('action is required.'), 400);
    try {
      return c.json(
        await telemetry.journeyInteraction({
          journeyId: nonEmpty(b.journeyId) ? b.journeyId : '',
          action: b.action,
          actionDetails: nonEmpty(b.actionDetails) ? b.actionDetails : '',
        })
      );
    } catch (e) {
      console.warn('telemetry interaction failed', e instanceof Error ? e.message : e);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  t.post('/journey/end', async (c) => {
    const b = await readJson(c);
    if (!isRecord(b) || !nonEmpty(b.journeyId)) return c.json(bad('journeyId is required.'), 400);
    const game = isRecord(b.game)
      ? { win: b.game.win === true, score: typeof b.game.score === 'number' ? b.game.score : 0 }
      : undefined;
    try {
      return c.json(
        await telemetry.endJourney({
          journeyId: b.journeyId,
          complete: b.complete === true,
          ...(game ? { game } : {}),
        })
      );
    } catch (e) {
      console.warn('telemetry end failed', e instanceof Error ? e.message : e);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  t.post('/journey/app-ready', async (c) => {
    try {
      return c.json(await telemetry.appReady());
    } catch (e) {
      console.warn('telemetry app-ready failed', e instanceof Error ? e.message : e);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return t;
};
