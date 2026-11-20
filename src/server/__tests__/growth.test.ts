import { beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS } from '../../shared/config';
import { tierForDay } from '../../shared/difficulty';
import { choicesForDay, promptForDay } from '../../shared/schedule';
import { ApiFail, type Deps, type Who } from '../deps';
import { keys } from '../redisKeys';
import * as game from '../services/gameService';
import type { PostRef } from '../services/gameService';
import { createDayPost, dayPostTitle } from '../services/postService';
import { commentResult } from '../services/shareService';
import { forgetUser } from '../services/userService';
import { createFakePlatform, type FakePlatform } from '../testing/fakePlatform';
import { MemoryStore } from '../testing/memoryStore';

const EPOCH = Date.UTC(2026, 11, 1);
let now = EPOCH + 3_600_000;
let deps: Deps;
let store: MemoryStore;
let platform: FakePlatform;
const alice: Who = { userId: 't2_alice', username: 'alice' };
const bob: Who = { userId: 't2_bob', username: 'bob' };
const anon: Who = { userId: undefined, username: undefined };
const square = [33, 34, 35, 43, 45, 53, 54, 55];

const setDay = (day: number) => {
  now = EPOCH + (day - 1) * DAY_MS + 3_600_000;
};
const postFor = async (day: number): Promise<PostRef> => ({
  postId: (await createDayPost(deps, day)).postId,
  postData: { day },
  subredditName: 'blurprint_dev',
});
const expectFail = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toBeInstanceOf(ApiFail);
  await expect(p).rejects.toMatchObject({ code });
};
const crowdDraws = async (day: number, n: number) => {
  const post = await postFor(day);
  for (let i = 0; i < n; i++) {
    const who = { userId: `t2_c${day}_${i}`, username: `crowd_${i}` };
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

describe('daily post', () => {
  it('titles carry the level and the format as a hook', () => {
    expect(dayPostTitle(1)).toBe('Blurprint #1 · Warm-up · Focus pull — can you read the crowd’s blur?');
    expect(dayPostTitle(8)).toContain('Hard · Tile reveal');
  });

  it('pins a results thread with yesterday’s winners (no u/ pings)', async () => {
    await crowdDraws(1, 3);
    setDay(2);
    const { postId } = await createDayPost(deps, 2);
    const pinned = platform.comments.find((c) => c.parentId === postId && c.pinned);
    expect(pinned).toBeDefined();
    expect(pinned!.asUser).toBe(false);
    expect(pinned!.text).toMatch(/results thread/i);
    expect(pinned!.text).toContain('crowd_0');
    expect(pinned!.text).not.toContain('u/');
    expect(await store.get(keys.dayResultsComment(2))).toBe(pinned!.id);
  });

  it('a failing pin never blocks the day’s post', async () => {
    platform.pinComment = async () => {
      throw new Error('not a mod');
    };
    const r = await createDayPost(deps, 1);
    expect(r.created).toBe(true);
    expect(await store.get(keys.dayResultsComment(1))).toBeUndefined();
  });
});

describe('comment my result', () => {
  beforeEach(async () => {
    await crowdDraws(1, 6);
    setDay(2);
  });

  const playToday = async (who: Who, post: PostRef) => {
    await game.startGuess(deps, who, post, 1);
    now += 2500;
    await game.guess(deps, who, post, { day: 1, choiceId: promptForDay(1).id });
    return (await game.draw(deps, who, post, { day: 2, cells: square })).result;
  };

  it('the result carries a spoiler-free share text', async () => {
    const post = await postFor(2);
    const result = await playToday(alice, post);
    expect(result.shareText).toContain('Blurprint #2');
    expect(result.shareText).toContain('2.5s');
    expect(result.shareText.toLowerCase()).not.toContain(promptForDay(1).word);
    expect(result.shareText.toLowerCase()).not.toContain(promptForDay(2).word);
    expect(result.commented).toBe(false);
  });

  it('posts the server-built text as the user, replying to the pinned thread, once a day', async () => {
    const post = await postFor(2);
    const result = await playToday(alice, post);
    const r = await commentResult(deps, alice, post);
    const mine = platform.comments.find((c) => c.asUser);
    expect(mine).toMatchObject({ text: result.shareText, parentId: await store.get(keys.dayResultsComment(2)) });
    expect(r.text).toBe(result.shareText);
    await expectFail(commentResult(deps, alice, post), 'ALREADY_DONE');
    expect((await game.init(deps, alice, post)).result?.commented).toBe(true);
  });

  it('creates the results thread lazily if the pin is missing', async () => {
    const post = await postFor(2);
    await store.del(keys.dayResultsComment(2));
    await playToday(alice, post);
    await commentResult(deps, alice, post);
    expect(await store.get(keys.dayResultsComment(2))).toBeTruthy();
  });

  it('needs a login, a finished day, and today’s post', async () => {
    const post = await postFor(2);
    await expectFail(commentResult(deps, anon, post), 'NOT_LOGGED_IN');
    await expectFail(commentResult(deps, bob, post), 'WRONG_PHASE');
    await playToday(alice, post);
    const old = await postFor(1);
    await expectFail(commentResult(deps, alice, old), 'WRONG_PHASE');
  });

  it('“delete my data” forgets the marker', async () => {
    const post = await postFor(2);
    await playToday(alice, post);
    await commentResult(deps, alice, post);
    await forgetUser(deps, alice.userId!, 2);
    expect(await store.hGet(keys.dayCommented(2), alice.userId!)).toBeUndefined();
  });
});
