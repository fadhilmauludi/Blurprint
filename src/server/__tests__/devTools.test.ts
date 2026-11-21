import { beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS } from '../../shared/config';
import { tierForDay } from '../../shared/difficulty';
import { type Deps } from '../deps';
import { keys } from '../redisKeys';
import { getBlend, getToday } from '../services/dayService';
import { canUseDevTools, jumpToDay } from '../services/devService';
import * as game from '../services/gameService';
import { createFakePlatform } from '../testing/fakePlatform';
import { MemoryStore } from '../testing/memoryStore';

const EPOCH = Date.UTC(2026, 10, 20);
const now = EPOCH + DAY_MS + 5 * 3_600_000; // Day 2, 05:00 UTC
let deps: Deps;
let store: MemoryStore;

beforeEach(async () => {
  store = new MemoryStore(() => now);
  deps = { store, platform: createFakePlatform(), now: () => now };
  await store.set(keys.launchEpoch(), String(EPOCH));
});

describe('jump to day N (test communities only)', () => {
  it('only runs in subreddits whose name ends in _dev', () => {
    expect(canUseDevTools('blurprint_xenix_dev')).toBe(true);
    expect(canUseDevTools('Blurprint_Dev')).toBe(true);
    expect(canUseDevTools('BlurprintGame')).toBe(false);
    expect(canUseDevTools('dev_blurprint')).toBe(false);
  });

  it('makes today Day 15 (Expert), with a blend to guess and a post', async () => {
    const r = await jumpToDay(deps, 15);
    expect(await getToday(deps)).toBe(15);
    expect(tierForDay(15).name).toBe('Expert');
    expect(r.day).toBe(15);
    expect(r.seeded).toBeGreaterThanOrEqual(5);
    expect((await getBlend(deps, 14)).values).not.toBeNull();
    const postId = await store.get(keys.dayPostId(15));
    expect(postId).toBeDefined();
    const init = await game.init(deps, { userId: 't2_me', username: 'me' }, { postId: postId!, postData: { day: 15 }, subredditName: 'x_dev' });
    expect(init.phase).toBe('guess');
    expect(init.tier.name).toBe('Expert');
  });

  it('keeps the time of day, so the next rollover is still at 00:00 UTC', async () => {
    await jumpToDay(deps, 15);
    expect(await getToday(deps)).toBe(15);
    deps = { ...deps, now: () => EPOCH + 2 * DAY_MS };
    expect(await getToday(deps)).toBe(16);
  });

  it('rejects silly day numbers', async () => {
    await expect(jumpToDay(deps, 0)).rejects.toMatchObject({ code: 'BAD_INPUT' });
    await expect(jumpToDay(deps, 400)).rejects.toMatchObject({ code: 'BAD_INPUT' });
  });
});
