import { beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS, DUEL_CREATES_PER_DAY, DUEL_ROUNDS, GUESS_GRACE_MS } from '../../shared/config';
import { tierForDay } from '../../shared/difficulty';
import { choicesForDay, promptForDay } from '../../shared/schedule';
import { ApiFail, type Deps, type Who } from '../deps';
import { keys } from '../redisKeys';
import * as duels from '../services/duelService';
import * as game from '../services/gameService';
import type { PostRef } from '../services/gameService';
import { createDayPost } from '../services/postService';
import { forgetUser } from '../services/userService';
import { createFakePlatform, type FakePlatform } from '../testing/fakePlatform';
import { MemoryStore } from '../testing/memoryStore';

const EPOCH = Date.UTC(2026, 11, 1);
let now = EPOCH + 3_600_000;
let store: MemoryStore;
let platform: FakePlatform;
let deps: Deps;

const alice: Who = { userId: 't2_alice', username: 'alice' };
const bob: Who = { userId: 't2_bob', username: 'bob' };
const carol: Who = { userId: 't2_carol', username: 'carol' };
const square = [33, 34, 35, 43, 45, 53, 54, 55];

const setDay = (day: number) => {
  now = EPOCH + (day - 1) * DAY_MS + 3_600_000;
};
const postFor = async (day: number): Promise<PostRef> => {
  const { postId } = await createDayPost(deps, day);
  return { postId, postData: { day }, subredditName: 'blurprint_dev' };
};
const expectFail = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toBeInstanceOf(ApiFail);
  await expect(p).rejects.toMatchObject({ code });
};
/** Day `day` gets n drawings; each crowd member answers any open guess instantly. */
const crowdDraws = async (day: number, n: number) => {
  const post = await postFor(day);
  for (let i = 0; i < n; i++) {
    const who = { userId: `t2_c${day}_${i}`, username: `c${i}` };
    const init = await game.init(deps, who, post);
    if (init.phase === 'guess') {
      await game.startGuess(deps, who, post, day - 1);
      await game.guess(deps, who, post, { day: day - 1, choiceId: choicesForDay(day - 1, tierForDay(day).choices)[0]!.id });
    }
    await game.draw(deps, who, post, { day, cells: square });
  }
};

beforeEach(async () => {
  now = EPOCH + 3_600_000;
  store = new MemoryStore(() => now);
  platform = createFakePlatform();
  deps = { store, platform, now: () => now };
  await store.set(keys.launchEpoch(), String(EPOCH));
});

describe('timed guessing', () => {
  beforeEach(async () => {
    await crowdDraws(1, 6);
    setDay(2);
  });

  it('withholds the real blend and choices until the clock starts; resumes after reload', async () => {
    const post = await postFor(2);
    await expectFail(game.guess(deps, alice, post, { day: 1, choiceId: promptForDay(1).id }), 'WRONG_PHASE');
    const { guess } = await game.startGuess(deps, alice, post, 1);
    expect(guess.started).toBe(true);
    expect(guess.choices).toHaveLength(tierForDay(2).choices);
    expect(guess.remainingMs).toBe(tierForDay(2).guessSeconds * 1000);
    now += 4000;
    const again = await game.init(deps, alice, post);
    expect(again.guess?.started).toBe(true);
    expect(again.guess?.remainingMs).toBe(tierForDay(2).guessSeconds * 1000 - 4000);
    // Starting again does not reset the clock.
    expect((await game.startGuess(deps, alice, post, 1)).guess.remainingMs).toBe(tierForDay(2).guessSeconds * 1000 - 4000);
  });

  it('slower correct answers score less', async () => {
    const post = await postFor(2);
    await game.startGuess(deps, alice, post, 1);
    now += 10_000; // half of the 20 s tier-1 clock
    const r = await game.guess(deps, alice, post, { day: 1, choiceId: promptForDay(1).id });
    expect(r.reveal.correct).toBe(true);
    expect(r.reveal.pointsEarned).toBe(75);
    expect(r.reveal.elapsedMs).toBe(10_000);
    expect(r.reveal.tier?.name).toBe('Warm-up');
  });

  it('a late or null answer is a timeout: wrong, 0 points, counted in stats', async () => {
    const post = await postFor(2);
    await game.startGuess(deps, alice, post, 1);
    now += 20_000 + GUESS_GRACE_MS + 1;
    const r = await game.guess(deps, alice, post, { day: 1, choiceId: promptForDay(1).id });
    expect(r.reveal.correct).toBe(false);
    expect(r.reveal.timedOut).toBe(true);
    expect(r.reveal.pickedId).toBeNull();
    expect(r.reveal.pointsEarned).toBe(0);
    expect(r.draw).not.toBeNull(); // still allowed to draw

    await game.startGuess(deps, bob, post, 1);
    const b = await game.guess(deps, bob, post, { day: 1, choiceId: null });
    expect(b.reveal.timedOut).toBe(true);
    expect(await store.hGetAll(keys.dayGuessStats(1))).toMatchObject({ total: '2' });
  });

  it('day 8 is Hard: 6 choices, 13 s, ×1.5', async () => {
    setDay(7);
    await crowdDraws(7, 6);
    setDay(8);
    const post = await postFor(8);
    const { guess } = await game.startGuess(deps, alice, post, 7);
    expect(guess.tier.name).toBe('Hard');
    expect(guess.choices).toHaveLength(6);
    const r = await game.guess(deps, alice, post, { day: 7, choiceId: promptForDay(7).id });
    expect(r.reveal.pointsEarned).toBe(150);
  });

  it('splash only gets the coarse teaser', async () => {
    const post = await postFor(2);
    const s = await game.splash(deps, alice, post);
    const real = (await game.startGuess(deps, alice, post, 1)).guess.blend.values;
    expect(s.blend?.values).not.toEqual(real);
  });
});

describe('streak board + yesterday podium', () => {
  it('ranks today by streak and shows yesterday’s top scores', async () => {
    const p1 = await postFor(1);
    await game.draw(deps, alice, p1, { day: 1, cells: square });
    await crowdDraws(1, 5);
    setDay(2);
    const p2 = await postFor(2);
    await game.startGuess(deps, alice, p2, 1);
    await game.guess(deps, alice, p2, { day: 1, choiceId: promptForDay(1).id });
    const { result } = await game.draw(deps, alice, p2, { day: 2, cells: square });
    await game.startGuess(deps, bob, p2, 1);
    await game.guess(deps, bob, p2, { day: 1, choiceId: null });
    await game.draw(deps, bob, p2, { day: 2, cells: square });

    const lb = (await game.init(deps, bob, p2)).result!.leaderboard;
    expect(lb.streaks[0]).toMatchObject({ username: 'alice', score: 2, rank: 1 });
    expect(lb.streaks.find((e) => e.isMe)).toMatchObject({ username: 'bob', score: 1 });
    expect(lb.rankStreak).toBe(2);
    expect(lb.yesterday.length).toBeLessThanOrEqual(3);
    expect(lb.yesterday[0]?.score).toBe(30); // day 1: 20 drawing + 10 streak, all tied
    expect(result.leaderboard.streaks[0]?.isMe).toBe(true);

    await forgetUser(deps, alice.userId!, 2);
    expect(await store.zScore(keys.lbStreakDay(2), alice.userId!)).toBeUndefined();
  });
});

describe('duels', () => {
  const playAll = async (who: Who, id: string, correctRounds: number[], delayMs = 0) => {
    for (let r = 0; r < DUEL_ROUNDS.length; r++) {
      const round = await duels.startDuelRound(deps, who, id, r);
      const answer = (await duels.getDuel(deps, who, id)).rounds;
      expect(answer).toBe(DUEL_ROUNDS.length);
      now += delayMs;
      const meta = JSON.parse((await store.hGet(keys.duel(id), 'meta'))!) as { rounds: { answerId: string }[] };
      const right = meta.rounds[r]!.answerId;
      const wrong = round.choices.find((c) => c.id !== right)!.id;
      await duels.answerDuelRound(deps, who, { id, round: r, choiceId: correctRounds.includes(r) ? right : wrong });
    }
  };

  beforeEach(() => setDay(1));

  it('full 1v1: create, join, escalating rounds, winner credited once, nudges sent', async () => {
    const created = await duels.createDuel(deps, alice);
    expect(created.status).toBe('waiting');
    expect(created.me).toBe('host');
    expect(created.rounds).toBe(5);

    const first = await duels.startDuelRound(deps, alice, created.id, 0);
    expect(first.choices).toHaveLength(DUEL_ROUNDS[0]!.choices);
    // Never today's or yesterday's prompt (yesterday's blend is today's puzzle).
    const meta = JSON.parse((await store.hGet(keys.duel(created.id), 'meta'))!) as { rounds: { answerId: string; choiceIds: string[]; format: string; word?: string }[] };
    for (const r of meta.rounds) {
      const answer = r.format === 'pick' ? r.word : r.answerId;
      expect([promptForDay(1).id, promptForDay(0).id, promptForDay(1).word, promptForDay(0).word]).not.toContain(answer);
    }
    // Word rounds follow the difficulty table; "pick the blend" rounds always show 4 blends.
    expect(meta.rounds.map((r) => r.choiceIds.length)).toEqual(
      DUEL_ROUNDS.map((s, i) => (meta.rounds[i]!.format === 'pick' ? 4 : s.choices))
    );
    await expectFail(duels.startDuelRound(deps, alice, created.id, 2), 'WRONG_PHASE');
    await duels.answerDuelRound(deps, alice, { id: created.id, round: 0, choiceId: meta.rounds[0]!.answerId });
    await expectFail(
      duels.answerDuelRound(deps, alice, { id: created.id, round: 0, choiceId: meta.rounds[0]!.answerId }),
      'ALREADY_DONE'
    );
    for (let r = 1; r < 5; r++) {
      await duels.startDuelRound(deps, alice, created.id, r);
      await duels.answerDuelRound(deps, alice, { id: created.id, round: r, choiceId: meta.rounds[r]!.answerId });
    }

    const joined = await duels.joinDuel(deps, bob, created.id);
    expect(joined.me).toBe('guest');
    expect(joined.status).toBe('playing');
    expect(platform.published.at(-1)).toMatchObject({ channel: `duel_${created.id}`, msg: { kind: 'joined' } });
    await expectFail(duels.joinDuel(deps, carol, created.id), 'ALREADY_DONE');

    await playAll(bob, created.id, [0, 1], 3000);
    const end = await duels.getDuel(deps, alice, created.id);
    expect(end.status).toBe('finished');
    expect(end.winner).toBe('host');
    expect(end.host.score).toBe(500);
    expect(end.guest!.score).toBeLessThan(200);
    expect(platform.published.at(-1)).toMatchObject({ msg: { kind: 'finished' } });
    await duels.getDuel(deps, bob, created.id);
    expect(await duels.duelWins(deps, alice.userId)).toBe(1);
    expect(await duels.duelWins(deps, bob.userId)).toBe(0);
  });

  it('unanswered expired rounds count as misses; settles after 24 h', async () => {
    const d = await duels.createDuel(deps, alice);
    await duels.joinDuel(deps, bob, d.id);
    await duels.startDuelRound(deps, alice, d.id, 0);
    now += 60_000;
    const v = await duels.getDuel(deps, alice, d.id);
    expect(v.host.marks[0]).toEqual({ correct: false, points: 0 });
    expect(v.myNextRound).toBe(1);
    now += 25 * 3_600_000;
    const settled = await duels.getDuel(deps, bob, d.id);
    expect(settled.status).toBe('finished');
    expect(settled.winner).toBe('tie');
  });

  it('invites hand off from splash to game, are validated, and rate limits apply', async () => {
    const d = await duels.createDuel(deps, alice);
    await expectFail(duels.rememberInvite(deps, bob, 'nope'), 'NOT_FOUND');
    await duels.rememberInvite(deps, bob, d.id);
    const post = await postFor(1);
    expect((await game.init(deps, bob, post)).pendingDuelId).toBe(d.id);
    await duels.joinDuel(deps, bob, d.id);
    expect((await game.init(deps, bob, post)).pendingDuelId).toBeNull();

    for (let i = 1; i < DUEL_CREATES_PER_DAY; i++) await duels.createDuel(deps, carol);
    await duels.createDuel(deps, carol);
    await expectFail(duels.createDuel(deps, carol), 'RATE_LIMITED');
  });

  it('“delete my data” removes duels', async () => {
    const d = await duels.createDuel(deps, alice);
    await duels.joinDuel(deps, bob, d.id);
    await forgetUser(deps, bob.userId!, 1);
    await expectFail(duels.getDuel(deps, alice, d.id), 'NOT_FOUND');
  });
});
