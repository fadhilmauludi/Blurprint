/**
 * The daily loop (spec §3): init, guess, skip-guess, draw, lazy crowd sync.
 * Every rule that decides what a player may see lives here, server side.
 */
import { coarsen, cosineSync } from '../../shared/blend';
import {
  DRAW_SECONDS,
  FEATURES,
  GRID_CELLS,
  GRID_SIZE,
  MAX_CELLS,
  MIN_BLEND_DRAWINGS,
  MIN_CELLS,
  TEASER_BLOCK,
  type DifficultyTier,
} from '../../shared/config';
import { isLate, tierForDay, timedPoints } from '../../shared/difficulty';
import { formatForDay } from '../../shared/formats';
import { bitsToGrid, gridToBits, gridToIndices, indicesToGrid, normalize } from '../../shared/normalize';
import { choicesForDay, nextRolloverMs, promptForDay } from '../../shared/schedule';
import { drawDayPoints, milestoneReached, syncBonus } from '../../shared/scoring';
import type {
  BlendPayload,
  DayIndex,
  DrawPayload,
  DrawRequest,
  GuessPayload,
  GuessRequest,
  GuessResponse,
  GuessStartResponse,
  InitResponse,
  ResultPayload,
  RevealPayload,
  SkipGuessResponse,
  SplashResponse,
  TierInfo,
} from '../../shared/types';
import { ApiFail, type Deps, type Who } from '../deps';
import { DRAWING_TIMEOUT, keys } from '../redisKeys';
import { getBlend, getDayPostId, getPostDay, getToday } from './dayService';
import { getPendingDuel } from './duelService';
import { encodeGuess, parseGuess } from './guessRecord';
import { hasCommented, shareTextFor } from './shareService';
import { addPoints, getLeaderboard, scoreForDay } from './leaderboardService';
import { USER_DAY_TTL_SECONDS, getMyCells, getUserState, recordDrawDay, recordStreakBoard, userSummary } from './userService';

export type PostRef = { postId: string | undefined; postData: unknown; subredditName: string };

type DayContext = { postDay: DayIndex; today: DayIndex; isArchive: boolean };

const resolveDay = async (deps: Deps, post: PostRef): Promise<DayContext> => {
  const today = await getToday(deps);
  const postDay = await getPostDay(deps, post.postId, post.postData);
  if (postDay === null) throw new ApiFail('NOT_FOUND', 'This post is not a Blurprint day.');
  if (postDay > today) throw new ApiFail('NOT_FOUND', 'This Blurprint has not started yet.');
  return { postDay, today, isArchive: postDay < today };
};

const requireUser = (who: Who): string => {
  if (!who.userId) throw new ApiFail('NOT_LOGGED_IN', 'Log in to play.');
  return who.userId;
};

const drawPayload = (day: DayIndex): DrawPayload => ({
  promptWord: promptForDay(day).word,
  seconds: DRAW_SECONDS,
  grid: GRID_SIZE,
});

export const tierInfo = (t: DifficultyTier): TierInfo => ({
  level: t.level,
  name: t.name,
  choices: t.choices,
  guessSeconds: t.guessSeconds,
  startBlur: t.startBlur,
  startZoom: t.startZoom,
  multiplier: t.multiplier,
});

/** Same for every player on a day; seeds the tile order and zoom point. */
const formatSeedFor = (blendDay: DayIndex): number => (Math.imul(blendDay + 1000, 0x9e3779b1) >>> 0) % 1_000_000;

/** The guess screen payload: a coarse teaser before the clock starts, the real blend after. */
const buildGuessPayload = async (
  deps: Deps,
  who: Who,
  postDay: DayIndex,
  blend: BlendPayload
): Promise<GuessPayload> => {
  const tier = tierForDay(postDay);
  const blendDay = postDay - 1;
  const startRaw = who.userId ? await deps.store.hGet(keys.dayGuessStarts(blendDay), who.userId) : undefined;
  const startedAt = startRaw === undefined ? null : Number(startRaw);
  if (startedAt === null || !Number.isFinite(startedAt) || !blend.values) {
    return {
      blend: { ...blend, values: blend.values ? coarsen(blend.values, TEASER_BLOCK, GRID_SIZE) : null },
      choices: null,
      tier: tierInfo(tier),
      format: formatForDay(postDay),
      formatSeed: formatSeedFor(blendDay),
      started: false,
      remainingMs: null,
    };
  }
  return {
    blend,
    choices: choicesForDay(blendDay, tier.choices),
    tier: tierInfo(tier),
    format: formatForDay(postDay),
    formatSeed: formatSeedFor(blendDay),
    started: true,
    remainingMs: Math.max(0, tier.guessSeconds * 1000 - (deps.now() - startedAt)),
  };
};

/**
 * Crowd sync for the player's drawing on `today - 1`, awarded once, lazily,
 * the first time they open today's post (spec §4.5).
 */
export const awardSyncIfDue = async (
  deps: Deps,
  who: Who,
  today: DayIndex
): Promise<{ sync: number; bonus: number } | null> => {
  if (!who.userId) return null;
  const { store } = deps;
  const day = today - 1;
  const already = await store.hGet(keys.daySyncs(day), who.userId);
  if (already !== undefined) {
    const sync = Number(already);
    return { sync, bonus: syncBonus(sync) };
  }
  const raw = await store.hGet(keys.dayDrawings(day), who.userId);
  if (raw === undefined || raw === DRAWING_TIMEOUT) return null;
  const blend = await getBlend(deps, day);
  if (!blend.values || blend.total < MIN_BLEND_DRAWINGS) return null;
  const sync = cosineSync(bitsToGrid(raw), blend.values);
  const claimed = await store.hSetNX(keys.daySyncs(day), who.userId, sync.toFixed(4));
  await store.expire(keys.daySyncs(day), USER_DAY_TTL_SECONDS);
  const bonus = syncBonus(sync);
  if (claimed === 1 && bonus > 0) await addPoints(deps, who.userId, who.username, today, bonus);
  return { sync, bonus };
};

const buildReveal = async (
  deps: Deps,
  who: Who,
  blendDay: DayIndex,
  live: boolean,
  sync: { sync: number; bonus: number } | null
): Promise<RevealPayload> => {
  const { store } = deps;
  const [blend, guessRaw, stats] = await Promise.all([
    getBlend(deps, blendDay),
    who.userId ? store.hGet(keys.dayGuesses(blendDay), who.userId) : Promise.resolve(undefined),
    store.hGetAll(keys.dayGuessStats(blendDay)),
  ]);
  const guess = parseGuess(guessRaw);
  const hasBlend = blend.values !== null;
  const answer = promptForDay(blendDay);
  const tier = tierForDay(blendDay + 1);
  const total = Number(stats.total ?? 0);
  const correctCount = Number(stats.correct ?? 0);
  // The answer is shown once the player guessed, or when there was nothing to guess
  // but the day did have drawings (blend hidden / too small).
  const showAnswer = guess !== null || (!hasBlend && blend.total > 0);
  return {
    correct: guess ? guess.correct : null,
    pickedId: guess?.pickedId ?? null,
    answerId: showAnswer ? answer.id : null,
    answerWord: showAnswer ? answer.word : null,
    choices: guess ? choicesForDay(blendDay, tier.choices) : null,
    pctCorrect: guess && total > 0 ? Math.round((correctCount / total) * 100) : null,
    blend: hasBlend ? blend : null,
    syncPct: sync ? Math.round(sync.sync * 100) : null,
    syncBonus: sync?.bonus ?? 0,
    pointsEarned: live && guess ? guess.points : 0,
    timedOut: guess !== null && guess.pickedId === null,
    elapsedMs: guess?.elapsedMs ?? null,
    tier: hasBlend ? tierInfo(tier) : null,
    format: formatForDay(blendDay + 1),
  };
};

const buildResult = async (
  deps: Deps,
  who: Who,
  day: DayIndex,
  today: DayIndex,
  streakMilestone: number | null = null
): Promise<ResultPayload> => {
  const [liveBlend, myCells, scoreToday, leaderboard, state, commented] = await Promise.all([
    getBlend(deps, day),
    getMyCells(deps, day, who.userId),
    scoreForDay(deps, day, who.userId),
    getLeaderboard(deps, day, who.userId),
    who.userId ? getUserState(deps, who.userId) : Promise.resolve(null),
    hasCommented(deps, day, who.userId),
  ]);
  const summary = state ? userSummary(who, state, today) : null;
  const drew = myCells !== null && myCells.length > 0;
  return {
    liveBlend,
    myCells: myCells ?? [],
    scoreToday,
    streak: summary?.streak ?? 0,
    bestStreak: summary?.bestStreak ?? 0,
    rankToday: leaderboard.rankToday,
    leaderboard,
    drew,
    streakMilestone,
    shareText: await shareTextFor(deps, who.userId, day, drew, summary?.streak ?? 0),
    commented,
  };
};

export const init = async (deps: Deps, who: Who, post: PostRef): Promise<InitResponse> => {
  const { postDay, today, isArchive } = await resolveDay(deps, post);
  const blendDay = postDay - 1;
  const live = !isArchive;

  const [sync, state, todayPostId, pendingDuelId] = await Promise.all([
    live ? awardSyncIfDue(deps, who, today) : Promise.resolve(null),
    who.userId ? getUserState(deps, who.userId) : Promise.resolve(null),
    isArchive ? getDayPostId(deps, today) : Promise.resolve(post.postId ?? null),
    getPendingDuel(deps, who),
  ]);

  const base = {
    postDay,
    today,
    isArchive,
    todayPostId,
    subredditName: post.subredditName,
    user: state ? userSummary(who, state, today) : null,
    firstTime: state ? state.daysPlayed === 0 && state.seenHints.length === 0 : true,
    seenHints: state?.seenHints ?? [],
    nextRolloverUtcMs: nextRolloverMs(deps.now()),
    tier: tierInfo(tierForDay(postDay)),
    format: formatForDay(postDay),
    pendingDuelId,
  };

  const blend = await getBlend(deps, blendDay);
  const guessRaw = who.userId ? await deps.store.hGet(keys.dayGuesses(blendDay), who.userId) : undefined;
  const needsGuess = blend.values !== null && guessRaw === undefined;

  if (needsGuess) {
    return { ...base, phase: 'guess', guess: await buildGuessPayload(deps, who, postDay, blend) };
  }

  const reveal = await buildReveal(deps, who, blendDay, live, sync);

  if (isArchive || !who.userId) {
    if (isArchive) {
      return { ...base, phase: 'done', reveal, result: await buildResult(deps, who, postDay, today) };
    }
    // Logged out on today's post with no blend to guess: nothing secret is sent.
    return { ...base, phase: 'draw', reveal };
  }

  const drewRaw = await deps.store.hGet(keys.dayDrawings(postDay), who.userId);
  if (drewRaw !== undefined) {
    return { ...base, phase: 'done', reveal, result: await buildResult(deps, who, postDay, today) };
  }
  return { ...base, phase: 'draw', reveal, draw: drawPayload(postDay) };
};

/** Start the guess clock (idempotent: a reload keeps the original start). Returns the real blend + choices. */
export const startGuess = async (deps: Deps, who: Who, post: PostRef, day: unknown): Promise<GuessStartResponse> => {
  const userId = requireUser(who);
  const { postDay } = await resolveDay(deps, post);
  const blendDay = postDay - 1;
  if (day !== blendDay) throw new ApiFail('BAD_INPUT', 'That guess is for a different day.');
  const blend = await getBlend(deps, blendDay);
  if (!blend.values) throw new ApiFail('WRONG_PHASE', 'There is no blend to guess today.');
  if ((await deps.store.hGet(keys.dayGuesses(blendDay), userId)) !== undefined) {
    throw new ApiFail('ALREADY_DONE', 'You already guessed this one.');
  }
  await deps.store.hSetNX(keys.dayGuessStarts(blendDay), userId, String(deps.now()));
  await deps.store.expire(keys.dayGuessStarts(blendDay), USER_DAY_TTL_SECONDS);
  return { guess: await buildGuessPayload(deps, who, postDay, blend) };
};

export const guess = async (deps: Deps, who: Who, post: PostRef, req: GuessRequest): Promise<GuessResponse> => {
  const userId = requireUser(who);
  const { postDay, today, isArchive } = await resolveDay(deps, post);
  const blendDay = postDay - 1;
  if (!req || req.day !== blendDay) throw new ApiFail('BAD_INPUT', 'That guess is for a different day.');
  const tier = tierForDay(postDay);
  const choices = choicesForDay(blendDay, tier.choices);
  if (req.choiceId !== null && (typeof req.choiceId !== 'string' || !choices.some((c) => c.id === req.choiceId))) {
    throw new ApiFail('BAD_INPUT', 'Unknown choice.');
  }
  const blend = await getBlend(deps, blendDay);
  if (!blend.values) throw new ApiFail('WRONG_PHASE', 'There is no blend to guess today.');

  const startRaw = await deps.store.hGet(keys.dayGuessStarts(blendDay), userId);
  if (startRaw === undefined) throw new ApiFail('WRONG_PHASE', 'Start the clock first.');
  const elapsedMs = Math.max(0, deps.now() - Number(startRaw));
  const timedOut = req.choiceId === null || isLate(elapsedMs, tier.guessSeconds);
  const correct = !timedOut && req.choiceId === promptForDay(blendDay).id;
  const points = timedPoints(correct, elapsedMs, tier.guessSeconds, tier.multiplier);

  const record = encodeGuess({ pickedId: timedOut ? null : req.choiceId, correct, points, elapsedMs });
  const claimed = await deps.store.hSetNX(keys.dayGuesses(blendDay), userId, record);
  if (claimed === 0) throw new ApiFail('ALREADY_DONE', 'You already guessed this one.');
  await deps.store.expire(keys.dayGuesses(blendDay), USER_DAY_TTL_SECONDS);

  const live = !isArchive;
  if (live) {
    await Promise.all([
      deps.store.hIncrBy(keys.dayGuessStats(blendDay), 'total', 1),
      correct ? deps.store.hIncrBy(keys.dayGuessStats(blendDay), 'correct', 1) : Promise.resolve(0),
      points > 0 ? addPoints(deps, userId, who.username, today, points) : Promise.resolve(),
    ]);
  }

  const sync = live ? await awardSyncIfDue(deps, who, today) : null;
  const reveal = await buildReveal(deps, who, blendDay, live, sync);
  if (isArchive) return { reveal, draw: null, result: await buildResult(deps, who, postDay, today) };

  const drew = (await deps.store.hGet(keys.dayDrawings(postDay), userId)) !== undefined;
  return drew
    ? { reveal, draw: null, result: await buildResult(deps, who, postDay, today) }
    : { reveal, draw: drawPayload(postDay), result: null };
};

export const skipGuess = async (deps: Deps, who: Who, post: PostRef): Promise<SkipGuessResponse> => {
  requireUser(who);
  const { postDay, today, isArchive } = await resolveDay(deps, post);
  if (isArchive) throw new ApiFail('WRONG_PHASE', 'Old Blurprints are guess-only.');
  const blend = await getBlend(deps, postDay - 1);
  if (blend.values) throw new ApiFail('WRONG_PHASE', 'Guess the blur first!');
  const sync = await awardSyncIfDue(deps, who, today);
  return { draw: drawPayload(postDay), reveal: await buildReveal(deps, who, postDay - 1, true, sync) };
};

export const validateCells = (cells: unknown): number[] => {
  if (!Array.isArray(cells)) throw new ApiFail('BAD_INPUT', 'cells must be an array.');
  const seen = new Set<number>();
  for (const c of cells) {
    if (typeof c !== 'number' || !Number.isInteger(c) || c < 0 || c >= GRID_CELLS) {
      throw new ApiFail('BAD_INPUT', 'cells must be integers inside the grid.');
    }
    if (seen.has(c)) throw new ApiFail('BAD_INPUT', 'cells must be unique.');
    seen.add(c);
  }
  if (seen.size < MIN_CELLS) throw new ApiFail('BAD_INPUT', 'Draw a bit more!');
  if (seen.size > MAX_CELLS) throw new ApiFail('BAD_INPUT', 'That drawing is too big.');
  return [...seen];
};

export const draw = async (
  deps: Deps,
  who: Who,
  post: PostRef,
  req: DrawRequest
): Promise<{ result: ResultPayload; milestone: number | null }> => {
  const userId = requireUser(who);
  const { postDay, today, isArchive } = await resolveDay(deps, post);
  if (isArchive) throw new ApiFail('WRONG_PHASE', 'Drawing is only open on today’s Blurprint.');
  if (!req || req.day !== postDay) throw new ApiFail('BAD_INPUT', 'That drawing is for a different day.');

  const blendDay = postDay - 1;
  const blend = await getBlend(deps, blendDay);
  if (blend.values) {
    const guessed = await deps.store.hGet(keys.dayGuesses(blendDay), userId);
    if (guessed === undefined) throw new ApiFail('WRONG_PHASE', 'Guess the blur first!');
  }

  const { store } = deps;
  const drawingsKey = keys.dayDrawings(postDay);

  // Time ran out with too few cells: the day counts as guessed only (no drawing, no streak).
  if (req.timedOut === true && (!Array.isArray(req.cells) || new Set(req.cells).size < MIN_CELLS)) {
    const claimed = await store.hSetNX(drawingsKey, userId, DRAWING_TIMEOUT);
    if (claimed === 0) throw new ApiFail('ALREADY_DONE', 'You already finished today.');
    await store.expire(drawingsKey, USER_DAY_TTL_SECONDS);
    return { result: await buildResult(deps, who, postDay, today), milestone: null };
  }

  const cells = validateCells(req.cells);
  const normalized = normalize(indicesToGrid(cells));
  const claimed = await store.hSetNX(drawingsKey, userId, gridToBits(normalized));
  if (claimed === 0) throw new ApiFail('ALREADY_DONE', 'You already drew today.');
  await store.expire(drawingsKey, USER_DAY_TTL_SECONDS);

  const filled = gridToIndices(normalized);
  await Promise.all([
    ...filled.map((i) => store.hIncrBy(keys.dayCells(postDay), String(i), 1)),
    store.incrBy(keys.dayTotal(postDay), 1),
  ]);

  const { prev, next } = await recordDrawDay(deps, userId, today);
  await Promise.all([
    addPoints(deps, userId, who.username, today, drawDayPoints(next.streak)),
    recordStreakBoard(deps, userId, today, next.streak),
  ]);
  const prevStreak = prev.lastPlayedDay !== null && prev.lastPlayedDay >= today - 1 ? prev.streak : 0;
  const milestone = milestoneReached(prevStreak, next.streak);

  if (milestone !== null && FEATURES.streakFlair && who.username) {
    try {
      await deps.platform.setUserFlair(who.username, `🔥 ${milestone}`);
    } catch (e) {
      console.warn('streak flair failed', e instanceof Error ? e.message : e);
    }
  }

  return { result: await buildResult(deps, who, postDay, today, milestone), milestone };
};

/** Live blend for polling. Only today's or older days, never the future. */
export const blendFor = async (deps: Deps, day: number): Promise<BlendPayload> => {
  if (!Number.isInteger(day)) throw new ApiFail('BAD_INPUT', 'day must be an integer.');
  const today = await getToday(deps);
  if (day > today) throw new ApiFail('NOT_FOUND', 'Not yet.');
  return getBlend(deps, day);
};

export const splash = async (deps: Deps, who: Who, post: PostRef): Promise<SplashResponse> => {
  const { postDay, today, isArchive } = await resolveDay(deps, post);
  const blend = await getBlend(deps, postDay - 1);
  const [drewRaw, state] = await Promise.all([
    who.userId && !isArchive ? deps.store.hGet(keys.dayDrawings(postDay), who.userId) : Promise.resolve(undefined),
    who.userId ? getUserState(deps, who.userId) : Promise.resolve(null),
  ]);
  return {
    postDay,
    isArchive,
    // Feed view: only the coarse teaser, so the guess clock is the first real look.
    blend: blend.values ? { ...blend, values: coarsen(blend.values, TEASER_BLOCK, GRID_SIZE) } : null,
    players: blend.total,
    doneToday: drewRaw !== undefined,
    streak: state ? userSummary(who, state, today).streak : 0,
    loggedIn: Boolean(who.userId),
  };
};
