import { beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS } from '../../shared/config';
import { ApiFail, type Deps, type Who } from '../deps';
import { keys } from '../redisKeys';
import * as game from '../services/gameService';
import type { PostRef } from '../services/gameService';
import { removeOutliers, restoreRemoved } from '../services/moderationService';
import { createDayPost } from '../services/postService';
import { forgetUser } from '../services/userService';
import { createFakePlatform } from '../testing/fakePlatform';
import { MemoryStore } from '../testing/memoryStore';

const EPOCH = Date.UTC(2026, 11, 1);
let now = EPOCH + 3_600_000;
let deps: Deps;
let store: MemoryStore;

/** A ring (the crowd's shape) and a diagonal line (the "crude" odd one out). */
const ring = [33, 34, 35, 36, 43, 46, 53, 56, 63, 64, 65, 66];
const diagonal = [0, 11, 22, 33, 44, 55, 66, 77, 88, 99];

const setDay = (day: number) => {
  now = EPOCH + (day - 1) * DAY_MS + 3_600_000;
};
const postFor = async (day: number): Promise<PostRef> => ({
  postId: (await createDayPost(deps, day)).postId,
  postData: { day },
  subredditName: 'blurprint_dev',
});
const drawAs = async (day: number, who: Who, cells: number[]) => {
  const post = await postFor(day);
  const init = await game.init(deps, who, post);
  if (init.phase === 'guess') await game.skipGuess(deps, who, post);
  await game.draw(deps, who, post, { day, cells });
};
const cellsTotal = async (day: number) =>
  Object.values(await store.hGetAll(keys.dayCells(day))).reduce((a, v) => a + Number(v), 0);
const expectFail = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toBeInstanceOf(ApiFail);
  await expect(p).rejects.toMatchObject({ code });
};

beforeEach(async () => {
  now = EPOCH + 3_600_000;
  store = new MemoryStore(() => now);
  deps = { store, platform: createFakePlatform(), now: () => now };
  await store.set(keys.launchEpoch(), String(EPOCH));
  setDay(3);
  for (let i = 0; i < 6; i++) await drawAs(3, { userId: `t2_ok${i}`, username: `ok${i}` }, ring);
  await drawAs(3, { userId: 't2_troll', username: 'troll' }, diagonal);
});

describe('remove odd-one-out drawings', () => {
  it('removes the drawing least like the crowd from the blend', async () => {
    const before = await cellsTotal(3);
    const r = await removeOutliers(deps, 3, 1);
    expect(r).toMatchObject({ removed: 1, total: 6 });
    expect(await store.get(keys.dayTotal(3))).toBe('6');
    expect(await cellsTotal(3)).toBeLessThan(before);
    expect(await store.hGet(keys.dayRemoved(3), 't2_troll')).toBeDefined();
    // Every remaining cell count comes from the six rings only.
    const counts = await store.hGetAll(keys.dayCells(3));
    for (const v of Object.values(counts)) expect([0, 6]).toContain(Number(v));
  });

  it('never removes the same drawing twice', async () => {
    await removeOutliers(deps, 3, 1);
    const again = await removeOutliers(deps, 3, 1);
    expect(again.removed).toBe(1);
    expect(await store.get(keys.dayTotal(3))).toBe('5');
    expect(await store.hGet(keys.dayRemoved(3), 't2_troll')).toBeDefined();
  });

  it('the player keeps their streak and still sees their own drawing', async () => {
    await removeOutliers(deps, 3, 1);
    expect(await store.hGet(keys.dayDrawings(3), 't2_troll')).toBeDefined();
  });

  it('restores everything it removed', async () => {
    const before = await store.hGetAll(keys.dayCells(3));
    await removeOutliers(deps, 3, 2);
    const r = await restoreRemoved(deps, 3);
    expect(r).toMatchObject({ restored: 2, total: 7 });
    expect(await store.hGetAll(keys.dayCells(3))).toEqual(before);
    expect(await store.hGetAll(keys.dayRemoved(3))).toEqual({});
  });

  it('forgetting a removed player does not subtract their drawing twice', async () => {
    await removeOutliers(deps, 3, 1);
    const cells = await store.hGetAll(keys.dayCells(3));
    await forgetUser(deps, 't2_troll', 3);
    expect(await store.get(keys.dayTotal(3))).toBe('6');
    expect(await store.hGetAll(keys.dayCells(3))).toEqual(cells);
    expect(await store.hGet(keys.dayRemoved(3), 't2_troll')).toBeUndefined();
  });

  it('rejects future days and silly counts', async () => {
    await expectFail(removeOutliers(deps, 4, 1), 'BAD_INPUT');
    await expectFail(removeOutliers(deps, 3, 0), 'BAD_INPUT');
    await expectFail(removeOutliers(deps, 3, 99), 'BAD_INPUT');
  });

  it('reports nothing to remove once drawings have expired', async () => {
    await store.del(keys.dayDrawings(3));
    expect(await removeOutliers(deps, 3, 1)).toMatchObject({ removed: 0, total: 7 });
  });

  it('works for the day whose blend is being guessed (yesterday)', async () => {
    setDay(4);
    const who = { userId: 't2_late', username: 'late' };
    const post = await postFor(4);
    await game.init(deps, who, post);
    await game.startGuess(deps, who, post, 3);
    await removeOutliers(deps, 3, 1);
    const blend = await game.blendFor(deps, 3);
    expect(blend.total).toBe(6);
  });
});
