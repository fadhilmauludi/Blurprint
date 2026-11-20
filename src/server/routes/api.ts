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
  CommentResultResponse,
  DuelAnswerResponse,
  DuelRoundPayload,
  DuelView,
  GuessStartResponse,
  SubscribeResponse,
} from '../../shared/types';
import { ApiFail, type Deps, type Who } from '../deps';
import { getToday } from '../services/dayService';
import * as duels from '../services/duelService';
import * as game from '../services/gameService';
import type { PostRef } from '../services/gameService';
import { getLeaderboard } from '../services/leaderboardService';
import { commentResult } from '../services/shareService';
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
      if (!isRecord(body) || typeof body.day !== 'number' || (typeof body.choiceId !== 'string' && body.choiceId !== null)) {
        throw new ApiFail('BAD_INPUT', 'Expected { day, choiceId }.');
      }
      return c.json<GuessResponse>(
        await game.guess(env.deps, env.who(), env.post(), { day: body.day, choiceId: body.choiceId })
      );
    } catch (e) {
      return fail(c, e);
    }
  });

  /** Starts the guess clock and returns the real blend + choices. */
  api.post('/guess/start', async (c) => {
    try {
      const body = await readJson(c);
      return c.json<GuessStartResponse>(await game.startGuess(env.deps, env.who(), env.post(), isRecord(body) ? body.day : undefined));
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
      try {
        await env.deps.platform.subscribeCurrentUser();
      } catch (e) {
        // Reddit grants SUBSCRIBE_TO_SUBREDDIT only to reviewed app versions (playtests are
        // refused). Expected, so one quiet line; the client opens the subreddit instead.
        console.warn('subscribe not available:', e instanceof Error ? e.message : String(e));
        return c.json<SubscribeResponse>({ ok: true, joined: false });
      }
      return c.json<SubscribeResponse>({ ok: true, joined: true });
    } catch (e) {
      return fail(c, e);
    }
  });

  /** "Comment my result" — explicit button only; posts as the user (Devvit user actions). */
  api.post('/comment-result', async (c) => {
    try {
      return c.json<CommentResultResponse>(await commentResult(env.deps, env.who(), env.post()));
    } catch (e) {
      return fail(c, e);
    }
  });

  // ---------- duels ----------

  api.post('/duel/create', async (c) => {
    try {
      return c.json<DuelView>(await duels.createDuel(env.deps, env.who()));
    } catch (e) {
      return fail(c, e);
    }
  });

  api.get('/duel', async (c) => {
    try {
      return c.json<DuelView>(await duels.getDuel(env.deps, env.who(), c.req.query('id')));
    } catch (e) {
      return fail(c, e);
    }
  });

  api.get('/duel/mine', async (c) => {
    try {
      return c.json<{ duels: DuelView[]; wins: number }>({
        duels: await duels.myDuels(env.deps, env.who()),
        wins: await duels.duelWins(env.deps, env.who().userId),
      });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/duel/join', async (c) => {
    try {
      const body = await readJson(c);
      return c.json<DuelView>(await duels.joinDuel(env.deps, env.who(), isRecord(body) ? body.id : undefined));
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/duel/round', async (c) => {
    try {
      const body = await readJson(c);
      if (!isRecord(body)) throw new ApiFail('BAD_INPUT', 'Expected { id, round }.');
      return c.json<DuelRoundPayload>(await duels.startDuelRound(env.deps, env.who(), body.id, body.round));
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/duel/answer', async (c) => {
    try {
      const body = await readJson(c);
      if (!isRecord(body)) throw new ApiFail('BAD_INPUT', 'Expected { id, round, choiceId }.');
      return c.json<DuelAnswerResponse>(
        await duels.answerDuelRound(env.deps, env.who(), { id: body.id, round: body.round, choiceId: body.choiceId })
      );
    } catch (e) {
      return fail(c, e);
    }
  });

  /** Splash → game handoff for an invite read from the share link (untrusted: only an id). */
  api.post('/duel/remember', async (c) => {
    try {
      const body = await readJson(c);
      await duels.rememberInvite(env.deps, env.who(), isRecord(body) ? body.id : undefined);
      return c.json({ ok: true });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post('/duel/dismiss', async (c) => {
    try {
      await duels.dismissInvite(env.deps, env.who());
      return c.json({ ok: true });
    } catch (e) {
      return fail(c, e);
    }
  });

  return api;
};
