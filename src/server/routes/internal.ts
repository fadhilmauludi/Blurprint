import { Hono } from 'hono';
import type { TaskResponse } from '@devvit/web/server';
import type { TriggerResponse, UiResponse } from '@devvit/web/shared';
import type { Deps } from '../deps';
import { ensureEpoch, getToday, resetEpoch, setHidden } from '../services/dayService';
import { createDayPost, rollover } from '../services/postService';
import { sweepDeletedUsers } from '../services/purgeService';
import { MAX_REMOVE_AT_ONCE, removeOutliers, restoreRemoved } from '../services/moderationService';
import { loadSeedRange } from '../services/seedService';
import { SEED_IS_PLACEHOLDER } from '../seed/seedBank';
import { isRecord, readJson } from './respond';

export type InternalEnv = { deps: Deps; subredditName: () => string };

/** How many pre-launch days get seed drawings on install (days 1−k … 0). */
const SEED_DAYS_ON_INSTALL = 3;

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isInteger(v) ? v : fallback);

/**
 * Scheduler, trigger, menu and form endpoints. Mounted at /internal. Devvit
 * only routes these from the platform (menu items are moderator-only in devvit.json).
 */
export const createInternal = (env: InternalEnv): Hono => {
  const internal = new Hono();
  const { deps } = env;

  // ── Scheduler ────────────────────────────────────────────────────────────
  internal.post('/scheduler/daily-rollover', async (c) => {
    try {
      const r = await rollover(deps);
      console.log(JSON.stringify({ event: 'scheduler_rollover', day: r.day, created: r.created }));
    } catch (e) {
      console.error('daily-rollover failed', e);
    }
    return c.json<TaskResponse>({}, 200);
  });

  internal.post('/scheduler/purge-sweep', async (c) => {
    try {
      const r = await sweepDeletedUsers(deps);
      if (r.purged > 0) console.log(JSON.stringify({ event: 'purge_sweep', ...r }));
    } catch (e) {
      console.error('purge-sweep failed', e);
    }
    return c.json<TaskResponse>({}, 200);
  });

  // ── Triggers ─────────────────────────────────────────────────────────────
  internal.post('/triggers/on-app-install', async (c) => {
    try {
      await ensureEpoch(deps);
      const seeded = await loadSeedRange(deps, 1 - SEED_DAYS_ON_INSTALL, 0);
      const post = await rollover(deps);
      console.log(JSON.stringify({ event: 'install', day: post.day, seeded: seeded.map((s) => s.loaded), placeholderSeed: SEED_IS_PLACEHOLDER }));
    } catch (e) {
      console.error('on-app-install failed', e);
    }
    return c.json<TriggerResponse>({}, 200);
  });

  // ── Menu (moderators) ────────────────────────────────────────────────────
  internal.post('/menu/create-today', async (c) => {
    try {
      const day = await getToday(deps);
      const post = await createDayPost(deps, day);
      return c.json<UiResponse>({
        showToast: { text: post.created ? `Created Blurprint #${day}` : `Blurprint #${day} already exists`, appearance: 'success' },
        navigateTo: `https://www.reddit.com/r/${env.subredditName()}/comments/${post.postId.replace(/^t3_/, '')}`,
      });
    } catch (e) {
      console.error('create-today failed', e);
      return c.json<UiResponse>({ showToast: 'Could not create today’s post. Check the logs.' });
    }
  });

  internal.post('/menu/hide-blend', async (c) => {
    const today = await getToday(deps);
    return c.json<UiResponse>({
      showForm: {
        name: 'hideBlendForm',
        form: {
          title: 'Hide or show a day’s blend',
          description: 'Use this for coordinated rude shapes. Hidden blends show a neutral placeholder.',
          acceptLabel: 'Apply',
          fields: [
            { type: 'number', name: 'day', label: 'Day number', defaultValue: today, required: true },
            { type: 'boolean', name: 'hidden', label: 'Hide this blend', defaultValue: true },
          ],
        },
      },
    });
  });

  internal.post('/menu/remove-drawing', async (c) => {
    const today = await getToday(deps);
    return c.json<UiResponse>({
      showForm: {
        name: 'removeDrawingForm',
        form: {
          title: 'Remove odd-one-out drawings',
          description:
            'For a single crude doodle showing in a blend. Removes the drawings least like everyone else’s from that day’s blend. You never see individual drawings, and players keep their streak. Works for about 30 days; tick the box to put removed drawings back.',
          acceptLabel: 'Apply',
          fields: [
            { type: 'number', name: 'day', label: 'Day number (the blend players guess today is yesterday’s)', defaultValue: today - 1, required: true },
            { type: 'number', name: 'count', label: `How many to remove (1–${MAX_REMOVE_AT_ONCE})`, defaultValue: 1, required: true },
            { type: 'boolean', name: 'restore', label: 'Put removed drawings back instead', defaultValue: false },
          ],
        },
      },
    });
  });

  internal.post('/menu/load-seed', async (c) => {
    return c.json<UiResponse>({
      showForm: {
        name: 'seedForm',
        form: {
          title: 'Load seed drawings',
          description: 'Runs seed drawings through the normal pipeline for each day in the range. Each day loads once.',
          acceptLabel: 'Load',
          fields: [
            { type: 'number', name: 'from', label: 'From day', defaultValue: 1 - SEED_DAYS_ON_INSTALL, required: true },
            { type: 'number', name: 'to', label: 'To day', defaultValue: 0, required: true },
          ],
        },
      },
    });
  });

  internal.post('/menu/reset-epoch', async (c) => {
    return c.json<UiResponse>({
      showForm: {
        name: 'resetEpochForm',
        form: {
          title: 'Reset launch epoch (dev only)',
          description: 'Makes TODAY Day 1. Old day data stays in Redis and may collide with new day numbers. Never use on the demo subreddit.',
          acceptLabel: 'Reset',
          fields: [{ type: 'boolean', name: 'confirm', label: 'I understand, reset it', defaultValue: false }],
        },
      },
    });
  });

  // ── Forms ────────────────────────────────────────────────────────────────
  internal.post('/form/hide-blend', async (c) => {
    const body = await readJson(c);
    const today = await getToday(deps);
    const day = num(isRecord(body) ? body.day : undefined, NaN);
    if (!Number.isInteger(day) || day > today) return c.json<UiResponse>({ showToast: 'Pick a valid day (today or earlier).' });
    const hidden = isRecord(body) && body.hidden === true;
    await setHidden(deps, day, hidden);
    return c.json<UiResponse>({ showToast: { text: `Day ${day} blend is now ${hidden ? 'hidden' : 'visible'}`, appearance: 'success' } });
  });

  internal.post('/form/remove-drawing', async (c) => {
    const body = await readJson(c);
    const day = num(isRecord(body) ? body.day : undefined, NaN);
    const count = num(isRecord(body) ? body.count : undefined, 1);
    try {
      if (isRecord(body) && body.restore === true) {
        const r = await restoreRemoved(deps, day);
        return c.json<UiResponse>({ showToast: { text: `Day ${day}: put back ${r.restored} drawing(s); blend has ${r.total}.`, appearance: 'success' } });
      }
      const r = await removeOutliers(deps, day, count);
      const text =
        r.removed === 0
          ? `Day ${day}: no drawings left to remove (they expire after about 30 days).`
          : `Day ${day}: removed ${r.removed} drawing(s); blend has ${r.total}.`;
      return c.json<UiResponse>({ showToast: { text, appearance: r.removed ? 'success' : 'neutral' } });
    } catch (e) {
      return c.json<UiResponse>({ showToast: e instanceof Error ? e.message : 'Could not remove drawings.' });
    }
  });

  internal.post('/form/seed', async (c) => {
    const body = await readJson(c);
    const from = num(isRecord(body) ? body.from : undefined, 1 - SEED_DAYS_ON_INSTALL);
    const to = num(isRecord(body) ? body.to : undefined, 0);
    if (to < from || to - from > 14) return c.json<UiResponse>({ showToast: 'Use a range of at most 15 days.' });
    const results = await loadSeedRange(deps, from, to);
    const summary = results.map((r) => `#${r.day} ${r.promptWord}: ${r.skipped ? 'skipped' : r.loaded}`).join(' · ');
    return c.json<UiResponse>({ showToast: summary.slice(0, 240) });
  });

  internal.post('/form/reset-epoch', async (c) => {
    const body = await readJson(c);
    if (!isRecord(body) || body.confirm !== true) return c.json<UiResponse>({ showToast: 'Not reset (confirm was off).' });
    await resetEpoch(deps);
    return c.json<UiResponse>({ showToast: { text: 'Launch epoch reset: today is Day 1.', appearance: 'success' } });
  });

  return internal;
};
