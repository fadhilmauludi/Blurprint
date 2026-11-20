import { beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS } from '../../shared/config';
import { tierForDay } from '../../shared/difficulty';
import { formatForDay } from '../../shared/formats';
import { choicesForDay, promptForDay } from '../../shared/schedule';
import type { Deps, Who } from '../deps';
import { keys } from '../redisKeys';
import * as duels from '../services/duelService';
import * as game from '../services/gameService';
import type { PostRef } from '../services/gameService';
import { createDayPost } from '../services/postService';
import { createFakePlatform } from '../testing/fakePlatform';
import { MemoryStore } from '../testing/memoryStore';

const EPOCH = Date.UTC(2026, 11, 1);
let now = EPOCH + 3_600_000;
let deps: Deps;
let store: MemoryStore;
const alice: Who = { userId: 't2_alice', username: 'alice' };
const bob: Who = { userId: 't2_bob', username: 'bob' };
const square = [33, 34, 35, 43, 45, 53, 54, 55];

const setDay = (day: number) => {
  now = EPOCH + (day - 1) * DAY_MS + 3_600_000;
};
const postFor = async (day: number): Promise<PostRef> => ({
  postId: (await createDayPost(deps, day)).postId,
  postData: { day },
  subredditName: 'blurprint_dev',
});
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
  deps = { store, platform: createFakePlatform(), now: () => now };
  await store.set(keys.launchEpoch(), String(EPOCH));
});

describe('daily format', () => {
  it('the guess, the reveal and init all carry the day’s format', async () => {
    // Day 3 needs a blend for day 4's guess.
    setDay(3);
    await crowdDraws(3, 6);
    setDay(4);
    const post = await postFor(4);
    const init = await game.init(deps, alice, post);
    expect(init.format).toBe(formatForDay(4));
    expect(init.guess?.format).toBe('zoom');
    expect(typeof init.guess?.formatSeed).toBe('number');
    expect(init.guess?.tier.startZoom).toBeGreaterThan(1);
    await game.startGuess(deps, alice, post, 3);
    const r = await game.guess(deps, alice, post, { day: 3, choiceId: promptForDay(3).id });
    expect(r.reveal.format).toBe('zoom');
  });
});

describe('duel formats', () => {
  it('rounds mix formats; "pick the blend" sends 4 blends with opaque ids and scores the right one', async () => {
    setDay(1);
    const d = await duels.createDuel(deps, alice);
    const kinds: string[] = [];
    for (let r = 0; r < d.rounds; r++) {
      const round = await duels.startDuelRound(deps, alice, d.id, r);
      kinds.push(round.format);
      if (round.format === 'pick') {
        expect(round.word).toBeTruthy();
        expect(round.options).toHaveLength(4);
        expect(round.choices.map((c) => c.id)).toEqual(round.options!.map((o) => o.id));
        for (const o of round.options!) {
          expect(o.id).toMatch(/^o\d$/);
          expect(o.blend.values).not.toBeNull();
        }
        const meta = JSON.parse((await store.hGet(keys.duel(d.id), 'meta'))!) as { rounds: { answerId: string }[] };
        const res = await duels.answerDuelRound(deps, alice, { id: d.id, round: r, choiceId: meta.rounds[r]!.answerId });
        expect(res.correct).toBe(true);
        expect(res.answerWord).toBe(round.word);
        expect(res.answerId).toBe(meta.rounds[r]!.answerId);
      } else {
        expect(round.options).toBeUndefined();
        await duels.answerDuelRound(deps, alice, { id: d.id, round: r, choiceId: null });
      }
    }
    expect(kinds[0]).toBe('focus');
    expect(new Set(kinds).size).toBeGreaterThanOrEqual(3);
    expect(kinds).toContain('pick');
    // Opponent sees the same rounds.
    await duels.joinDuel(deps, bob, d.id);
    const b0 = await duels.startDuelRound(deps, bob, d.id, 0);
    expect(b0.format).toBe(kinds[0]);
  });
});
