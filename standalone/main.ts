/**
 * Blurprint standalone demo: the real React client and the real API routes in
 * one page. fetch('/api/…') is answered in-page by the Hono app over an
 * in-memory store, so the game plays exactly as on Reddit, minus Reddit.
 */
import './demo.css';
import { Hono } from 'hono';
import { promptForDay } from '../src/shared/schedule';
import { parseDuelShare } from '../src/shared/duel';
import type { Who } from '../src/server/deps';
import { keys } from '../src/server/redisKeys';
import { createApi } from '../src/server/routes/api';
import * as duels from '../src/server/services/duelService';
import { context, deliverRealtime } from './mockClient';
import { buildDemo, type Demo } from './scenario';
import { LEVELS, readSettings, settingsHash, type Player } from './settings';

const settings = readSettings();
let demo: Demo | null = null;
const ready = buildDemo(settings.day).then((d) => {
  demo = d;
  // Realtime nudges go straight to the page's listeners.
  d.deps.platform.publish = async (channel, msg) => deliverRealtime(channel, msg);
  return d;
});

const api = new Hono().route(
  '/api',
  createApi({
    get deps() {
      if (!demo) throw new Error('demo not ready');
      return demo.deps;
    },
    who: () => ({ userId: context.userId, username: context.username }),
    post: () => ({ postId: undefined, postData: { day: settings.day }, subredditName: 'blurprint' }),
  })
);

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('/api/')) {
    await ready;
    return api.fetch(new Request(`https://demo.invalid${url}`, init));
  }
  return realFetch(input, init);
};

// ---------- computer rival for duels ----------

const RIVAL: Who = { userId: 't2_rival', username: 'blur_rival' };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const playRival = async (duelId: string): Promise<void> => {
  const d = await ready;
  await wait(2500);
  try {
    const view = await duels.getDuel(d.deps, RIVAL, duelId);
    if (view.guest) return;
    await duels.joinDuel(d.deps, RIVAL, duelId);
    const meta: unknown = JSON.parse((await d.deps.store.hGet(keys.duel(duelId), 'meta')) ?? '{}');
    const answers =
      typeof meta === 'object' && meta !== null && 'rounds' in meta && Array.isArray(meta.rounds)
        ? meta.rounds.map((r: unknown) => (typeof r === 'object' && r !== null && 'answerId' in r ? String(r.answerId) : ''))
        : [];
    for (let round = 0; round < answers.length; round++) {
      await wait(1500);
      const r = await duels.startDuelRound(d.deps, RIVAL, duelId, round);
      await wait(2000 + Math.random() * (r.seconds * 650));
      const right = Math.random() < 0.6;
      const wrong = r.choices.find((c) => c.id !== answers[round])?.id ?? null;
      await duels.answerDuelRound(d.deps, RIVAL, { id: duelId, round, choiceId: right ? answers[round] : wrong });
    }
  } catch (e) {
    console.warn('rival stopped', e);
  }
};

window.addEventListener('bp-invite', (e) => {
  const id = parseDuelShare(e instanceof CustomEvent && typeof e.detail === 'string' ? e.detail : '');
  if (id) void playRival(id);
});

// ---------- demo bar ----------

const bar = document.createElement('div');
bar.className = 'demo-bar';
bar.innerHTML = `
  <span class="demo-tag">DEMO</span>
  <label><span class="demo-label">Level</span><select data-k="day" aria-label="Level">${LEVELS.map(
    (l) => `<option value="${l.day}"${l.day === settings.day ? ' selected' : ''}>${l.label}</option>`
  ).join('')}</select></label>
  <label><span class="demo-label">Player</span><select data-k="player" aria-label="Player">
    <option value="alice"${settings.player === 'alice' ? ' selected' : ''}>Returning</option>
    <option value="newbie"${settings.player === 'newbie' ? ' selected' : ''}>New</option>
  </select></label>
  <button type="button" class="demo-restart" aria-label="Restart the demo">↺</button>`;
document.body.prepend(bar);
const restart = () => {
  const day = Number(bar.querySelector<HTMLSelectElement>('select[data-k="day"]')?.value ?? 2);
  const player: Player = bar.querySelector<HTMLSelectElement>('select[data-k="player"]')?.value === 'newbie' ? 'newbie' : 'alice';
  location.hash = settingsHash({ day, player });
  location.reload();
};
bar.querySelectorAll('select').forEach((s) => s.addEventListener('change', restart));
bar.querySelector('button')?.addEventListener('click', restart);

console.info(`Blurprint demo · Day ${settings.day} · yesterday was “${promptForDay(settings.day - 1).word}”`);

// Start the real client once the fetch shim is in place.
void import('../src/client/game');
