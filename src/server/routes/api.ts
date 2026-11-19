import { Hono } from 'hono';
import type {
  DrawResponse,
  ForgetResponse,
  GuessResponse,
  HintId,
  InitResponse,
  LeaderboardPayload,
  SkipGuessResponse,
  SplashResponse,
  BlendPayload,
} from '../../shared/types';
import { ApiFail, type Deps, type Who } from '../deps';
import { getToday } from '../services/dayService';
import * as game from '../services/gameService';
import type { PostRef } from '../services/gameService';
import { getLeaderboard } from '../services/leaderboardService';
import { forgetUser, markHintSeen } from '../services/userService';
import { fail, isRecord, readJson } from './respond';

export type RequestEnv = {
  deps: Deps;
  /** Caller identity from the platform request context. */
  who: () => Who;
  /** Current post from the platform request context. */
  post: () => PostRef;
};

const HINTS: readonly HintId[] = ['squint', 'draw'];

const intParam = (raw: string | undefined): number => {
  const n = Number(raw);
  if (raw === undefined || raw === '' || !Number.isInteger(n)) throw new ApiFail('BAD_INPUT', 'day must be an integer.');
  return n;
};

/** Player-facing endpoints (spec §8.4). Mounted at /api. */
export const createApi = (env: RequestEnv): Hono => {
  const api = new Hono();

  api.get('/init', async (c) => {
    try {
      return c.json<InitResponse>(await game.init(env.deps, env.who(), env.post()));
    } catch (e) {
      return fail(c, e);
    }
  });

  api.get('/splash', async (c) => {
    try {
      return c.json<SplashResponse>(await game.splash(env.deps, env.who(), env.post()));
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/guess', async (c) => {
    try {
      const body = await readJson(c);
      if (!isRecord(body) || typeof body.day !== 'number' || typeof body.choiceId !== 'string') {
        throw new ApiFail('BAD_INPUT', 'Expected { day, choiceId }.');
      }
      return c.json<GuessResponse>(
        await game.guess(env.deps, env.who(), env.post(), { day: body.day, choiceId: body.choiceId })
      );
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/skip-guess', async (c) => {
    try {
      return c.json<SkipGuessResponse>(await game.skipGuess(env.deps, env.who(), env.post()));
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/draw', async (c) => {
    try {
      const body = await readJson(c);
      if (!isRecord(body) || typeof body.day !== 'number') throw new ApiFail('BAD_INPUT', 'Expected { day, cells }.');
      const cells = Array.isArray(body.cells) ? body.cells.filter((x): x is number => typeof x === 'number') : [];
      if (Array.isArray(body.cells) && cells.length !== body.cells.length) throw new ApiFail('BAD_INPUT', 'cells must be numbers.');
      const { result } = await game.draw(env.deps, env.who(), env.post(), {
        day: body.day,
        cells,
        timedOut: body.timedOut === true,
      });
      return c.json<DrawResponse>({ result });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.get('/blend', async (c) => {
    try {
      return c.json<BlendPayload>(await game.blendFor(env.deps, intParam(c.req.query('day'))));
    } catch (e) {
      return fail(c, e);
    }
  });

  api.get('/leaderboard', async (c) => {
    try {
      const day = intParam(c.req.query('day'));
      if (day > (await getToday(env.deps))) throw new ApiFail('NOT_FOUND', 'Not yet.');
      return c.json<LeaderboardPayload>(await getLeaderboard(env.deps, day, env.who().userId));
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/hint', async (c) => {
    try {
      const { userId } = env.who();
      const body = await readJson(c);
      const hint = isRecord(body) ? HINTS.find((h) => h === body.hint) : undefined;
      if (!hint) throw new ApiFail('BAD_INPUT', 'Unknown hint.');
      if (userId) await markHintSeen(env.deps, userId, hint);
      return c.json({ ok: true });
    } catch (e) {
      return fail(c, e);
    }
  });

  /** Self-service data deletion (Devvit Rules: users can remove their own content). */
  api.post('/forget', async (c) => {
    try {
      const { userId } = env.who();
      if (!userId) throw new ApiFail('NOT_LOGGED_IN', 'Log in first.');
      await forgetUser(env.deps, userId, await getToday(env.deps));
      return c.json<ForgetResponse>({ ok: true });
    } catch (e) {
      return fail(c, e);
    }
  });

  /** Explicit "Join r/…" button only — never automatic, never required (Devvit Rules). */
  api.post('/subscribe', async (c) => {
    try {
      if (!env.who().userId) throw new ApiFail('NOT_LOGGED_IN', 'Log in first.');
      await env.deps.platform.subscribeCurrentUser();
      return c.json({ ok: true });
    } catch (e) {
      return fail(c, e);
    }
  });

  return api;
};
