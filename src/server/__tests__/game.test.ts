import { beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS, MIN_BLEND_DRAWINGS } from '../../shared/config';
import { choicesForDay, promptForDay } from '../../shared/schedule';
import { ApiFail, type Deps, type Who } from '../deps';
import { keys } from '../redisKeys';
import { getBlend, setHidden } from '../services/dayService';
import * as game from '../services/gameService';
import type { PostRef } from '../services/gameService';
import { createDayPost, rollover } from '../services/postService';
import { sweepDeletedUsers } from '../services/purgeService';
import { loadSeedForDay } from '../services/seedService';
import { forgetUser, getUserState } from '../services/userService';
import { createFakePlatform, type FakePlatform } from '../testing/fakePlatform';
import { MemoryStore } from '../testing/memoryStore';

const EPOCH = Date.UTC(2026, 11, 1);
let now = EPOCH + 3_600_000; // Day 1, 01:00 UTC
let store: MemoryStore;
let platform: FakePlatform;
let deps: Deps;

const alice: Who = { userId: 't2_alice', username: 'alice' };
const bob: Who = { userId: 't2_bob', username: 'bob' };
const anon: Who = { userId: undefined, username: undefined };

const square = [33, 34, 35, 43, 45, 53, 54, 55]; // 3×3 ring

const postFor = async (day: number): Promise<PostRef> => {
  const { postId } = await createDayPost(deps, day);
  return { postId, postData: { day }, subredditName: 'blurprint_dev' };
};
const setDay = (day: number) => {
  now = EPOCH + (day - 1) * DAY_MS + 3_600_000;
};
const expectFail = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toBeInstanceOf(ApiFail);
  await expect(p).rejects.toMatchObject({ code });
};
/** Start the guess clock and answer immediately (full speed points). */
const guessNow = async (who: Who, post: PostRef, day: number, choiceId: string | null) => {
  await game.startGuess(deps, who, post, day);
  return game.guess(deps, who, post, { day, choiceId });
};
/** n fake players draw `cells` on `day`'s post (no guess needed when there's no blend). */
const crowdDraws = async (day: number, n: number, cells = square, offset = 0) => {
  const post = await postFor(day);
  for (let i = offset; i < offset + n; i++) {
    const who = { userId: `t2_crowd${day}_${i}`, username: `crowd${i}` };
    const init = await game.init(deps, who, post);
    if (init.phase === 'guess') await guessNow(who, post, day - 1, choicesForDay(day - 1)[0]!.id);
    await game.draw(deps, who, post, { day, cells });
  }
};

beforeEach(async () => {
  now = EPOCH + 3_600_000;
  store = new MemoryStore(() => now);
  platform = createFakePlatform();
  deps = { store, platform, now: () => now };
  await store.set(keys.launchEpoch(), String(EPOCH));
});

describe('day 1 with no yesterday', () => {
  it('skips guessing and goes straight to draw', async () => {
    const post = await postFor(1);
    const init = await game.init(deps, alice, post);
    expect(init.postDay).toBe(1);
    expect(init.isArchive).toBe(false);
    expect(init.phase).toBe('draw');
    expect(init.draw?.promptWord).toBe(promptForDay(1).word);
    expect(init.reveal?.correct).toBeNull();
    expect(init.guess).toBeUndefined();
    expect(init.firstTime).toBe(true);
  });

  it('skip-guess returns the draw payload only when there is no blend', async () => {
    const post = await postFor(1);
    const r = await game.skipGuess(deps, alice, post);
    expect(r.draw?.promptWord).toBe(promptForDay(1).word);
  });

  it('logged-out viewers never receive the prompt', async () => {
    const post = await postFor(1);
    const init = await game.init(deps, anon, post);
    expect(init.user).toBeNull();
    expect(init.draw).toBeUndefined();
    await expectFail(game.draw(deps, anon, post, { day: 1, cells: square }), 'NOT_LOGGED_IN');
  });
});

describe('drawing', () => {
  it('validates input', async () => {
    const post = await postFor(1);
    await expectFail(game.draw(deps, alice, post, { day: 1, cells: [1, 2] }), 'BAD_INPUT'); // < MIN
    await expectFail(game.draw(deps, alice, post, { day: 1, cells: [1, 1, 2, 3] }), 'BAD_INPUT'); // dupes
    await expectFail(game.draw(deps, alice, post, { day: 1, cells: [1, 2, 100] }), 'BAD_INPUT'); // out of range
    await expectFail(game.draw(deps, alice, post, { day: 1, cells: Array.from({ length: 71 }, (_, i) => i) }), 'BAD_INPUT');
    await expectFail(game.draw(deps, alice, post, { day: 2, cells: square }), 'BAD_INPUT'); // wrong day
  });

  it('stores only the normalized drawing, counts it once, scores and starts a streak', async () => {
    const post = await postFor(1);
    const { result } = await game.draw(deps, alice, post, { day: 1, cells: square });
    expect(result.drew).toBe(true);
    expect(result.liveBlend.total).toBe(1);
    expect(result.liveBlend.values).toBeNull(); // under MIN_BLEND_DRAWINGS
    expect(result.streak).toBe(1);
    expect(result.scoreToday).toBe(20 + 10);
    expect(result.myCells.length).toBeGreaterThan(square.length); // normalized = scaled up
    await expectFail(game.draw(deps, alice, post, { day: 1, cells: square }), 'ALREADY_DONE');
    expect((await getBlend(deps, 1)).total).toBe(1);
    const init = await game.init(deps, alice, post);
    expect(init.phase).toBe('done');
    expect(init.draw).toBeUndefined();
  });

  it('timeout under MIN_CELLS finishes the day without a streak', async () => {
    const post = await postFor(1);
    const { result } = await game.draw(deps, alice, post, { day: 1, cells: [5], timedOut: true });
    expect(result.drew).toBe(false);
    expect(result.streak).toBe(0);
    expect((await getBlend(deps, 1)).total).toBe(0);
    expect((await game.init(deps, alice, post)).phase).toBe('done');
  });

  it('a timed-out drawing with enough cells is submitted normally', async () => {
    const post = await postFor(1);
    const { result } = await game.draw(deps, alice, post, { day: 1, cells: square, timedOut: true });
    expect(result.drew).toBe(true);
  });

  it('shows the blend publicly only from MIN_BLEND_DRAWINGS', async () => {
    await crowdDraws(1, MIN_BLEND_DRAWINGS - 1);
    expect((await getBlend(deps, 1)).values).toBeNull();
    await crowdDraws(1, 1, [11, 12, 13], MIN_BLEND_DRAWINGS);
    const blend = await getBlend(deps, 1);
    expect(blend.total).toBe(MIN_BLEND_DRAWINGS);
    expect(blend.values).toHaveLength(100);
    expect(Math.max(...blend.values!)).toBeLessThanOrEqual(1);
  });
});

describe('guess → reveal → draw on day 2', () => {
  beforeEach(async () => {
    await loadSeedForDay(deps, 1); // no seed for day 1's prompt → skipped
    await crowdDraws(1, 6);
    setDay(2);
  });

  it('requires a guess first, scores it once, then unlocks drawing', async () => {
    const post = await postFor(2);
    const init = await game.init(deps, alice, post);
    expect(init.phase).toBe('guess');
    // Before the clock starts: a coarse teaser and no choices.
    expect(init.guess?.started).toBe(false);
    expect(init.guess?.choices).toBeNull();
    expect(init.guess?.blend.values).not.toBeNull();
    expect(init.guess?.blend.values).not.toEqual((await getBlend(deps, 1)).values);
    expect(init.draw).toBeUndefined(); // today's prompt stays secret
    expect(JSON.stringify(init)).not.toContain(`"answerId"`);

    await expectFail(game.draw(deps, alice, post, { day: 2, cells: square }), 'WRONG_PHASE');
    await expectFail(game.skipGuess(deps, alice, post), 'WRONG_PHASE');
    await expectFail(guessNow(alice, post, 1, 'not-a-choice'), 'BAD_INPUT');
    await expectFail(guessNow(alice, post, 2, promptForDay(1).id), 'BAD_INPUT');

    const r = await guessNow(alice, post, 1, promptForDay(1).id);
    expect(r.reveal.correct).toBe(true);
    expect(r.reveal.answerWord).toBe(promptForDay(1).word);
    expect(r.reveal.pctCorrect).toBe(100);
    expect(r.reveal.pointsEarned).toBe(100);
    expect(r.draw?.promptWord).toBe(promptForDay(2).word);
    await expectFail(guessNow(alice, post, 1, promptForDay(1).id), 'ALREADY_DONE');

    const again = await game.init(deps, alice, post);
    expect(again.phase).toBe('draw');
    expect(again.reveal?.correct).toBe(true);

    const { result } = await game.draw(deps, alice, post, { day: 2, cells: square });
    expect(result.scoreToday).toBe(100 + 20 + 10);
  });

  it('pctCorrect reflects everyone', async () => {
    const post = await postFor(2);
    const wrong = choicesForDay(1).find((c) => c.id !== promptForDay(1).id)!.id;
    await guessNow(bob, post, 1, wrong);
    const r = await guessNow(alice, post, 1, promptForDay(1).id);
    expect(r.reveal.pctCorrect).toBe(50);
    const b = await game.init(deps, bob, post);
    expect(b.reveal?.correct).toBe(false);
    expect(b.reveal?.pickedId).toBe(wrong);
  });

  it('a hidden blend skips the guess', async () => {
    await setHidden(deps, 1, true);
    const post = await postFor(2);
    const init = await game.init(deps, alice, post);
    expect(init.phase).toBe('draw');
    expect(init.reveal?.blend).toBeNull();
  });
});

describe('streaks + crowd sync across days', () => {
  it('awards sync once on the next day and grows the streak', async () => {
    const p1 = await postFor(1);
    await crowdDraws(1, 5);
    await game.draw(deps, alice, p1, { day: 1, cells: square }); // identical to the crowd

    setDay(2);
    const p2 = await postFor(2);
    const init = await game.init(deps, alice, p2);
    expect(init.phase).toBe('guess');
    const r = await guessNow(alice, p2, 1, promptForDay(1).id);
    expect(r.reveal.syncPct).toBe(100);
    expect(r.reveal.syncBonus).toBe(50);
    // Re-opening doesn't double-award.
    await game.init(deps, alice, p2);
    const { result } = await game.draw(deps, alice, p2, { day: 2, cells: square });
    expect(result.streak).toBe(2);
    expect(result.scoreToday).toBe(50 + 100 + 20 + 20);
    expect((await getUserState(deps, alice.userId!)).totalScore).toBe(30 + 50 + 100 + 40);
  });

  it('a missed day resets the streak; milestone 3 is reported', async () => {
    for (const d of [1, 2, 3]) {
      setDay(d);
      const p = await postFor(d);
      const init = await game.init(deps, alice, p);
      if (init.phase === 'guess') await guessNow(alice, p, d - 1, choicesForDay(d - 1)[0]!.id);
      const { result } = await game.draw(deps, alice, p, { day: d, cells: square });
      expect(result.streak).toBe(d);
      expect(result.streakMilestone).toBe(d === 3 ? 3 : null);
    }
    setDay(5);
    const p5 = await postFor(5);
    expect((await game.init(deps, alice, p5)).user?.streak).toBe(0);
    const { result } = await game.draw(deps, alice, p5, { day: 5, cells: square });
    expect(result.streak).toBe(1);
    expect(result.bestStreak).toBe(3);
  });
});

describe('archive mode', () => {
  it('old posts are guess-only, score nothing, and link to today', async () => {
    await loadSeedForDay(deps, -1);
    const seededDay = [-2, -1, 0].find((d) => promptForDay(d).id === 'heart')!;
    await loadSeedForDay(deps, seededDay);
    expect((await getBlend(deps, 0)).values).not.toBeNull();
    const p1 = await postFor(1);
    setDay(2);
    const p2 = await postFor(2);
    const init = await game.init(deps, alice, p1);
    expect(init.isArchive).toBe(true);
    expect(init.todayPostId).toBe(p2.postId);
    expect(init.phase).toBe('guess');
    const r = await guessNow(alice, p1, 0, promptForDay(0).id);
    expect(r.reveal.pointsEarned).toBe(0);
    expect(r.draw).toBeNull();
    expect(r.result).not.toBeNull();
    expect(await store.zScore(keys.lbAll(), alice.userId!)).toBeUndefined();
    expect(await store.hGetAll(keys.dayGuessStats(0))).toEqual({});
    await expectFail(game.draw(deps, alice, p1, { day: 1, cells: square }), 'WRONG_PHASE');
    expect((await game.init(deps, alice, p1)).phase).toBe('done');
  });

  it('future posts are rejected', async () => {
    const p3 = await postFor(3);
    await expectFail(game.init(deps, alice, p3), 'NOT_FOUND');
  });
});

describe('seed', () => {
  it('loads once per day and counts seeded drawings as players', async () => {
    const r = await loadSeedForDay(deps, 0); // heart
    expect(r.promptWord).toBe('heart');
    expect(r.loaded).toBeGreaterThanOrEqual(15);
    const again = await loadSeedForDay(deps, 0);
    expect(again.skipped).toBe(true);
    expect((await getBlend(deps, 0)).total).toBe(r.loaded);
  });
});

describe('rollover', () => {
  it('creates one post per day, maps it both ways and rotates the sticky', async () => {
    const a = await rollover(deps);
    const b = await rollover(deps);
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.postId).toBe(a.postId);
    expect(platform.posts).toHaveLength(1);
    expect(platform.posts[0]!.title).toBe('Blurprint #1 · Warm-up · Focus pull — can you read the crowd’s blur?');
    expect(await store.get(keys.postDay(a.postId))).toBe('1');
    setDay(2);
    const c = await rollover(deps);
    expect(c.day).toBe(2);
    expect(platform.stickied).toBe(c.postId);
  });

  it('releases the lock when post creation fails', async () => {
    platform.createDayPost = async () => {
      throw new Error('reddit down');
    };
    await expect(rollover(deps)).rejects.toThrow('reddit down');
    expect(await store.hGet(keys.rolloverLocks(), '1')).toBeUndefined();
  });
});

describe('privacy', () => {
  it('forgetUser removes the user and subtracts their drawing from the blend', async () => {
    const p1 = await postFor(1);
    await crowdDraws(1, 5);
    await game.draw(deps, alice, p1, { day: 1, cells: square });
    const before = await getBlend(deps, 1);
    await forgetUser(deps, alice.userId!, 1);
    const after = await getBlend(deps, 1);
    expect(after.total).toBe(before.total - 1);
    expect(await store.hGet(keys.dayDrawings(1), alice.userId!)).toBeUndefined();
    expect(await store.zScore(keys.lbAll(), alice.userId!)).toBeUndefined();
    expect(await store.hGet(keys.usernames(), alice.userId!)).toBeUndefined();
    expect(store.keys()).not.toContain(keys.user(alice.userId!));
  });

  it('the sweep purges deleted accounts only', async () => {
    const p1 = await postFor(1);
    await game.draw(deps, alice, p1, { day: 1, cells: square });
    await game.draw(deps, bob, p1, { day: 1, cells: square });
    platform.deletedUsers.add(bob.userId!);
    const r = await sweepDeletedUsers(deps);
    expect(r).toEqual({ checked: 2, purged: 1 });
    expect(await store.zScore(keys.lbAll(), bob.userId!)).toBeUndefined();
    expect(await store.zScore(keys.lbAll(), alice.userId!)).toBeDefined();
  });

  it('per-user per-day data expires after the TTL', async () => {
    const p1 = await postFor(1);
    await game.draw(deps, alice, p1, { day: 1, cells: square });
    now += 31 * DAY_MS;
    expect(await store.hGet(keys.dayDrawings(1), alice.userId!)).toBeUndefined();
    expect((await getBlend(deps, 1)).total).toBe(1); // aggregate kept for archive
  });
});

describe('leaderboard', () => {
  it('ranks by score and appends "you" outside the top 5', async () => {
    const p1 = await postFor(1);
    for (let i = 0; i < 6; i++) await game.draw(deps, { userId: `t2_u${i}`, username: `u${i}` }, p1, { day: 1, cells: square });
    await store.zIncrBy(keys.lbDay(1), 't2_u3', 500);
    const { result } = await game.draw(deps, alice, p1, { day: 1, cells: square });
    const lb = result.leaderboard;
    expect(lb.today[0]!.username).toBe('u3');
    expect(lb.today).toHaveLength(6);
    expect(lb.today[5]!.isMe).toBe(true);
    expect(lb.rankToday).toBeGreaterThan(1);
  });
});
