/**
 * 1v1 duels (D-22). One player creates a duel and shares the post with a
 * friend through Reddit's share sheet; the link carries the duel id. Both
 * players get the same 5 rounds — past blends, each round harder than the last —
 * and answer at their own pace (async), or at the same time with live updates
 * when both are online (realtime nudges; the duel record in Redis is always the
 * source of truth, so a missed nudge only delays the screen until the next poll).
 */
import { intensities } from '../../shared/blend';
import {
  DAY_MS,
  DUEL_CREATES_PER_DAY,
  DUEL_ROUND_POINTS,
  DUEL_ROUNDS,
  DUEL_SETTLE_HOURS,
  DUEL_TTL_DAYS,
  GRID_CELLS,
  MIN_BLEND_DRAWINGS,
} from '../../shared/config';
import { isLate, timedPoints } from '../../shared/difficulty';
import { isDuelId } from '../../shared/duel';
import { gridToIndices, indicesToGrid, normalize } from '../../shared/normalize';
import { getPromptById } from '../../shared/prompts';
import { choicesFor, mulberry32, promptForDay, seededShuffle } from '../../shared/schedule';
import type {
  BlendPayload,
  Choice,
  DuelAnswerResponse,
  DuelNudge,
  DuelPlayer,
  DuelRoundMark,
  DuelRoundPayload,
  DuelSide,
  DuelView,
} from '../../shared/types';
import { ApiFail, type Deps, type Who } from '../deps';
import { keys } from '../redisKeys';
import { SEED_BANK } from '../seed/seedBank';
import { getBlend, getToday } from './dayService';

const DUEL_TTL_SECONDS = (DUEL_TTL_DAYS * DAY_MS) / 1000;
const SETTLE_MS = DUEL_SETTLE_HOURS * 3_600_000;
/** How far back past days are considered for duel rounds. */
const POOL_LOOKBACK_DAYS = 30;
/** Recent duel ids remembered per user (for "delete my data"). */
const USER_DUELS_KEPT = 12;

/** A round's blend source: a past day ("d:12") or a seed-bank prompt ("s:heart"). */
type StoredRound = { src: string; answerId: string; choiceIds: string[] };
type StoredPlayer = { userId: string; username: string };
type StoredAnswer = { choiceId: string | null; correct: boolean; points: number; elapsedMs: number };

type Duel = {
  id: string;
  rounds: StoredRound[];
  createdAt: number;
  joinedAt: number | null;
  host: StoredPlayer;
  guest: StoredPlayer | null;
  starts: Map<string, number>;
  answers: Map<string, StoredAnswer>;
  settled: boolean;
};

export const duelChannel = (id: string): string => `duel_${id}`;

const randomSeed = (): number => {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] ?? 0;
};

const newId = (): string => {
  const bytes = new Uint8Array(10);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
};

// ---------- encoding ----------

const parseJson = (raw: string | undefined): unknown => {
  if (raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const asPlayer = (v: unknown): StoredPlayer | null =>
  isRecord(v) && typeof v.userId === 'string' && typeof v.username === 'string'
    ? { userId: v.userId, username: v.username }
    : null;

const asRounds = (v: unknown): StoredRound[] => {
  if (!Array.isArray(v)) return [];
  return v.flatMap((r) =>
    isRecord(r) && typeof r.src === 'string' && typeof r.answerId === 'string' && Array.isArray(r.choiceIds)
      ? [{ src: r.src, answerId: r.answerId, choiceIds: r.choiceIds.filter((c): c is string => typeof c === 'string') }]
      : []
  );
};

const encodeAnswer = (a: StoredAnswer): string => `${a.choiceId ?? ''}|${a.correct ? 1 : 0}|${a.points}|${a.elapsedMs}`;
const decodeAnswer = (raw: string): StoredAnswer => {
  const [choiceId, flag, points, elapsed] = raw.split('|');
  return {
    choiceId: choiceId ? choiceId : null,
    correct: flag === '1',
    points: Number(points) || 0,
    elapsedMs: Number(elapsed) || 0,
  };
};

const startField = (userId: string, round: number) => `${userId}:s${round}`;
const answerField = (userId: string, round: number) => `${userId}:a${round}`;

const loadDuel = async ({ store }: Deps, id: string): Promise<Duel | null> => {
  if (!isDuelId(id)) return null;
  const h = await store.hGetAll(keys.duel(id));
  const meta = parseJson(h.meta);
  const host = asPlayer(parseJson(h.host));
  if (!isRecord(meta) || !host) return null;
  const starts = new Map<string, number>();
  const answers = new Map<string, StoredAnswer>();
  for (const [k, v] of Object.entries(h)) {
    if (/:s\d+$/.test(k)) starts.set(k, Number(v));
    else if (/:a\d+$/.test(k)) answers.set(k, decodeAnswer(v));
  }
  return {
    id,
    rounds: asRounds(meta.rounds),
    createdAt: Number(h.createdAt) || 0,
    joinedAt: h.joinedAt ? Number(h.joinedAt) : null,
    host,
    guest: asPlayer(parseJson(h.guest)),
    starts,
    answers,
    settled: h.settled === '1',
  };
};

// ---------- round pool ----------

const seedBlendCache = new Map<string, number[] | null>();
/** Blend built from the seed bank's drawings for a prompt (same pipeline as players). */
const seedBlend = (promptId: string): number[] | null => {
  if (seedBlendCache.has(promptId)) return seedBlendCache.get(promptId) ?? null;
  const drawings = SEED_BANK[promptId] ?? [];
  const counts = new Array<number>(GRID_CELLS).fill(0);
  let total = 0;
  for (const raw of drawings) {
    const cells = raw.filter((i) => Number.isInteger(i) && i >= 0 && i < GRID_CELLS);
    if (cells.length === 0) continue;
    for (const i of gridToIndices(normalize(indicesToGrid(cells)))) counts[i] = (counts[i] ?? 0) + 1;
    total++;
  }
  const values = total >= MIN_BLEND_DRAWINGS ? intensities(counts, total) : null;
  seedBlendCache.set(promptId, values);
  return values;
};

/**
 * Candidate rounds: public blends from past days, then seed-bank prompts.
 * Never today's or yesterday's prompt — yesterday's blend is today's daily puzzle.
 */
export const duelPool = async (deps: Deps, today: number): Promise<{ src: string; answerId: string }[]> => {
  const banned = new Set([promptForDay(today).id, promptForDay(today - 1).id]);
  const seen = new Set<string>();
  const out: { src: string; answerId: string }[] = [];
  const days: number[] = [];
  for (let d = today - 2; d >= Math.max(-2, today - POOL_LOOKBACK_DAYS); d--) days.push(d);
  const blends = await Promise.all(days.map((d) => getBlend(deps, d)));
  blends.forEach((b, i) => {
    const day = days[i]!;
    const answerId = promptForDay(day).id;
    if (!b.values || banned.has(answerId) || seen.has(answerId)) return;
    seen.add(answerId);
    out.push({ src: `d:${day}`, answerId });
  });
  for (const promptId of Object.keys(SEED_BANK)) {
    if (banned.has(promptId) || seen.has(promptId) || !getPromptById(promptId) || !seedBlend(promptId)) continue;
    seen.add(promptId);
    out.push({ src: `s:${promptId}`, answerId: promptId });
  }
  return out;
};

const roundBlend = async (deps: Deps, src: string): Promise<BlendPayload> => {
  const [kind, rest] = [src.slice(0, 1), src.slice(2)];
  if (kind === 'd') return getBlend(deps, Number(rest));
  const values = seedBlend(rest);
  return { day: 0, total: (SEED_BANK[rest] ?? []).length, values, hidden: false };
};

const choicesOf = (r: StoredRound): Choice[] =>
  r.choiceIds.flatMap((id) => {
    const p = getPromptById(id);
    return p ? [{ id: p.id, word: p.word }] : [];
  });

// ---------- view ----------

const sideOf = (duel: Duel, userId: string | undefined): DuelSide | null =>
  !userId ? null : duel.host.userId === userId ? 'host' : duel.guest?.userId === userId ? 'guest' : null;

const roundSeconds = (round: number): number => DUEL_ROUNDS[round]?.seconds ?? DUEL_ROUNDS[DUEL_ROUNDS.length - 1]!.seconds;

/** Mark for one round, counting an expired, unanswered start as a timeout. */
const markFor = (duel: Duel, userId: string, round: number, now: number): DuelRoundMark => {
  const a = duel.answers.get(answerField(userId, round));
  if (a) return { correct: a.correct, points: a.points };
  const s = duel.starts.get(startField(userId, round));
  if (s !== undefined && isLate(now - s, roundSeconds(round))) return { correct: false, points: 0 };
  return null;
};

const playerView = (duel: Duel, p: StoredPlayer, now: number, settledAll: boolean): DuelPlayer => {
  const marks = duel.rounds.map((_, i) => markFor(duel, p.userId, i, now));
  const finalMarks = settledAll ? marks.map((m) => m ?? { correct: false, points: 0 }) : marks;
  return {
    username: p.username,
    score: finalMarks.reduce((s, m) => s + (m?.points ?? 0), 0),
    marks: finalMarks,
    done: finalMarks.every((m) => m !== null),
  };
};

export const viewDuel = async (deps: Deps, duel: Duel, userId: string | undefined): Promise<DuelView> => {
  const now = deps.now();
  const timeUp = duel.joinedAt !== null && now - duel.joinedAt > SETTLE_MS;
  const host = playerView(duel, duel.host, now, timeUp);
  const guest = duel.guest ? playerView(duel, duel.guest, now, timeUp) : null;
  const finished = guest !== null && host.done && guest.done;
  const status = !guest ? 'waiting' : finished ? 'finished' : 'playing';
  const winner = !finished || !guest ? null : host.score === guest.score ? 'tie' : host.score > guest.score ? 'host' : 'guest';

  const me = sideOf(duel, userId);
  const mine = me === 'host' ? host : me === 'guest' ? guest : null;
  const myNextRound = mine ? mine.marks.findIndex((m) => m === null) : -1;
  let openRound: DuelRoundPayload | null = null;
  if (userId && mine && myNextRound >= 0) {
    const s = duel.starts.get(startField(userId, myNextRound));
    if (s !== undefined) openRound = await roundPayload(deps, duel, myNextRound, s);
  }
  return {
    id: duel.id,
    me,
    host,
    guest,
    rounds: duel.rounds.length,
    status,
    winner,
    myNextRound: myNextRound < 0 ? duel.rounds.length : myNextRound,
    openRound,
  };
};

const roundPayload = async (deps: Deps, duel: Duel, round: number, startedAt: number): Promise<DuelRoundPayload> => {
  const r = duel.rounds[round]!;
  const spec = DUEL_ROUNDS[round] ?? DUEL_ROUNDS[DUEL_ROUNDS.length - 1]!;
  return {
    duelId: duel.id,
    round,
    blend: await roundBlend(deps, r.src),
    choices: choicesOf(r),
    seconds: spec.seconds,
    startBlur: spec.startBlur,
    remainingMs: Math.max(0, spec.seconds * 1000 - (deps.now() - startedAt)),
  };
};

// ---------- helpers ----------

const requireUser = (who: Who): string => {
  if (!who.userId) throw new ApiFail('NOT_LOGGED_IN', 'Log in to duel.');
  return who.userId;
};

const requireDuel = async (deps: Deps, id: unknown): Promise<Duel> => {
  const duel = isDuelId(id) ? await loadDuel(deps, id) : null;
  if (!duel) throw new ApiFail('NOT_FOUND', 'This duel has expired or doesn’t exist.');
  return duel;
};

const nudge = async (deps: Deps, duelId: string, kind: DuelNudge['kind']): Promise<void> => {
  try {
    await deps.platform.publish(duelChannel(duelId), { duelId, kind });
  } catch (e) {
    console.warn('duel nudge failed', e instanceof Error ? e.message : e);
  }
};

const rememberForUser = async ({ store }: Deps, userId: string, duelId: string): Promise<void> => {
  const list = ((await store.hGet(keys.user(userId), 'duels')) ?? '').split(',').filter(Boolean);
  if (list.includes(duelId)) return;
  await store.hSet(keys.user(userId), { duels: [duelId, ...list].slice(0, USER_DUELS_KEPT).join(',') });
};

/** Credit the winner once (duelWins on the user hash). */
const settleIfFinished = async (deps: Deps, duel: Duel, view: DuelView): Promise<void> => {
  if (view.status !== 'finished' || duel.settled) return;
  const claimed = await deps.store.hSetNX(keys.duel(duel.id), 'settled', '1');
  if (claimed === 0) return;
  duel.settled = true;
  const winner = view.winner === 'host' ? duel.host : view.winner === 'guest' ? duel.guest : null;
  if (winner) await deps.store.hIncrBy(keys.user(winner.userId), 'duelWins', 1);
};

// ---------- API ----------

export const createDuel = async (deps: Deps, who: Who): Promise<DuelView> => {
  const userId = requireUser(who);
  const today = await getToday(deps);
  const created = await deps.store.hIncrBy(keys.duelCreates(today), userId, 1);
  await deps.store.expire(keys.duelCreates(today), 2 * DAY_MS / 1000);
  if (created > DUEL_CREATES_PER_DAY) throw new ApiFail('RATE_LIMITED', 'That’s enough duels for today — finish the ones you have!');

  const pool = await duelPool(deps, today);
  if (pool.length < 3) throw new ApiFail('WRONG_PHASE', 'Not enough past blends for a duel yet. Try again tomorrow!');
  const seed = randomSeed();
  const picked = seededShuffle(pool, mulberry32(seed)).slice(0, DUEL_ROUNDS.length);
  const rounds: StoredRound[] = picked.map((p, i) => {
    const prompt = getPromptById(p.answerId)!;
    const spec = DUEL_ROUNDS[i]!;
    return { src: p.src, answerId: p.answerId, choiceIds: choicesFor(prompt, spec.choices, seed + i * 7919).map((c) => c.id) };
  });

  let id = newId();
  for (let tries = 0; tries < 3 && (await deps.store.hSetNX(keys.duel(id), 'createdAt', String(deps.now()))) === 0; tries++) id = newId();
  await deps.store.hSet(keys.duel(id), {
    meta: JSON.stringify({ rounds }),
    host: JSON.stringify({ userId, username: who.username ?? 'redditor' }),
  });
  await deps.store.expire(keys.duel(id), DUEL_TTL_SECONDS);
  await rememberForUser(deps, userId, id);
  const duel = await requireDuel(deps, id);
  return viewDuel(deps, duel, userId);
};

export const getDuel = async (deps: Deps, who: Who, id: unknown): Promise<DuelView> => {
  const duel = await requireDuel(deps, id);
  const view = await viewDuel(deps, duel, who.userId);
  await settleIfFinished(deps, duel, view);
  return view;
};

export const joinDuel = async (deps: Deps, who: Who, id: unknown): Promise<DuelView> => {
  const userId = requireUser(who);
  const duel = await requireDuel(deps, id);
  await deps.store.hDel(keys.duelInvites(), [userId]);
  if (sideOf(duel, userId)) return viewDuel(deps, duel, userId);
  if (duel.guest) throw new ApiFail('ALREADY_DONE', 'This duel already has two players.');
  const claimed = await deps.store.hSetNX(
    keys.duel(duel.id),
    'guest',
    JSON.stringify({ userId, username: who.username ?? 'redditor' })
  );
  if (claimed === 0) throw new ApiFail('ALREADY_DONE', 'Someone else just joined this duel.');
  await deps.store.hSet(keys.duel(duel.id), { joinedAt: String(deps.now()) });
  await rememberForUser(deps, userId, duel.id);
  await nudge(deps, duel.id, 'joined');
  return viewDuel(deps, (await loadDuel(deps, duel.id))!, userId);
};

export const startDuelRound = async (deps: Deps, who: Who, id: unknown, round: unknown): Promise<DuelRoundPayload> => {
  const userId = requireUser(who);
  const duel = await requireDuel(deps, id);
  if (!sideOf(duel, userId)) throw new ApiFail('WRONG_PHASE', 'Join the duel first.');
  const view = await viewDuel(deps, duel, userId);
  if (round !== view.myNextRound || view.myNextRound >= duel.rounds.length) {
    throw new ApiFail('WRONG_PHASE', 'That round isn’t up next.');
  }
  // Idempotent: re-opening an unanswered round keeps its original start time.
  await deps.store.hSetNX(keys.duel(duel.id), startField(userId, view.myNextRound), String(deps.now()));
  const fresh = (await loadDuel(deps, duel.id))!;
  return roundPayload(deps, fresh, view.myNextRound, fresh.starts.get(startField(userId, view.myNextRound))!);
};

export const answerDuelRound = async (
  deps: Deps,
  who: Who,
  req: { id: unknown; round: unknown; choiceId: unknown }
): Promise<DuelAnswerResponse> => {
  const userId = requireUser(who);
  const duel = await requireDuel(deps, req.id);
  if (!sideOf(duel, userId)) throw new ApiFail('WRONG_PHASE', 'Join the duel first.');
  const round = typeof req.round === 'number' && Number.isInteger(req.round) ? req.round : -1;
  const r = duel.rounds[round];
  if (!r) throw new ApiFail('BAD_INPUT', 'Unknown round.');
  const start = duel.starts.get(startField(userId, round));
  if (start === undefined) throw new ApiFail('WRONG_PHASE', 'Start the round first.');
  const choiceId = req.choiceId === null ? null : typeof req.choiceId === 'string' ? req.choiceId : undefined;
  if (choiceId === undefined || (choiceId !== null && !r.choiceIds.includes(choiceId))) {
    throw new ApiFail('BAD_INPUT', 'Unknown choice.');
  }

  const seconds = roundSeconds(round);
  const elapsedMs = Math.max(0, deps.now() - start);
  const timedOut = choiceId === null || isLate(elapsedMs, seconds);
  const correct = !timedOut && choiceId === r.answerId;
  const points = timedPoints(correct, elapsedMs, seconds, 1, DUEL_ROUND_POINTS);
  const claimed = await deps.store.hSetNX(
    keys.duel(duel.id),
    answerField(userId, round),
    encodeAnswer({ choiceId: timedOut ? null : choiceId, correct, points, elapsedMs })
  );
  if (claimed === 0) throw new ApiFail('ALREADY_DONE', 'You already answered that round.');

  const fresh = (await loadDuel(deps, duel.id))!;
  const view = await viewDuel(deps, fresh, userId);
  await settleIfFinished(deps, fresh, view);
  await nudge(deps, duel.id, view.status === 'finished' ? 'finished' : 'answered');
  const answer = getPromptById(r.answerId)!;
  return { correct, timedOut, answerId: answer.id, answerWord: answer.word, points, elapsedMs, duel: view };
};

/** The splash saw a duel invite in the share link: hand it to the game view for this user. */
export const rememberInvite = async (deps: Deps, who: Who, id: unknown): Promise<void> => {
  const userId = requireUser(who);
  const duel = await requireDuel(deps, id);
  if (sideOf(duel, userId) === 'host') return;
  await deps.store.hSet(keys.duelInvites(), { [userId]: duel.id });
  await deps.store.expire(keys.duelInvites(), DUEL_TTL_SECONDS);
};

export const dismissInvite = async ({ store }: Deps, who: Who): Promise<void> => {
  if (who.userId) await store.hDel(keys.duelInvites(), [who.userId]);
};

/** A remembered invite, if its duel still exists. */
export const getPendingDuel = async (deps: Deps, who: Who): Promise<string | null> => {
  if (!who.userId) return null;
  const id = await deps.store.hGet(keys.duelInvites(), who.userId);
  if (!id || !(await loadDuel(deps, id))) return null;
  return id;
};

/** The caller's recent duels (most recent first), for the "Your duels" list. */
export const myDuels = async (deps: Deps, who: Who): Promise<DuelView[]> => {
  if (!who.userId) return [];
  const ids = ((await deps.store.hGet(keys.user(who.userId), 'duels')) ?? '').split(',').filter(isDuelId).slice(0, 5);
  const duels = await Promise.all(ids.map((id) => loadDuel(deps, id)));
  return Promise.all(duels.flatMap((d) => (d ? [viewDuel(deps, d, who.userId)] : [])));
};

export const duelWins = async ({ store }: Deps, userId: string | undefined): Promise<number> =>
  userId ? Number((await store.hGet(keys.user(userId), 'duelWins')) ?? 0) || 0 : 0;
