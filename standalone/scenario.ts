/**
 * In-browser game state for the standalone demo, built with the REAL services:
 * a crowd drew yesterday's prompt (so there is a puzzle), a few early birds drew
 * today's, and "alice" played yesterday (returning player with a streak).
 */
import { DAY_MS } from '../src/shared/config';
import { promptForDay, startOfGameDayUtc } from '../src/shared/schedule';
import type { Deps, Who } from '../src/server/deps';
import { keys } from '../src/server/redisKeys';
import * as game from '../src/server/services/gameService';
import { createDayPost } from '../src/server/services/postService';
import { loadSeedRange } from '../src/server/services/seedService';
import { createFakePlatform } from '../src/server/testing/fakePlatform';
import { MemoryStore } from '../src/server/testing/memoryStore';
import { drawingsFor } from './demoSeed';

export type Demo = { deps: Deps; today: number };

export const buildDemo = async (today: number): Promise<Demo> => {
  const offset = { ms: 0 };
  const now = () => Date.now() + offset.ms;
  const store = new MemoryStore(now);
  const platform = createFakePlatform();
  platform.createDayPost = async ({ day, title }) => {
    const id = `demo_day${day}`;
    platform.posts.push({ id, day, title });
    return { id, url: `#day${day}` };
  };
  const deps: Deps = { store, platform, now };
  const epoch = startOfGameDayUtc(Date.now()) - (today - 1) * DAY_MS;
  await store.set(keys.launchEpoch(), String(epoch));
  await loadSeedRange(deps, -2, 0);

  const at = (day: number) => {
    offset.ms = epoch + (day - 1) * DAY_MS + 3_600_000 - Date.now();
  };
  const play = async (who: Who, day: number, cells: number[] | undefined, pickRight: boolean) => {
    const post = { postId: (await createDayPost(deps, day)).postId, postData: { day }, subredditName: 'blurprint' };
    const init = await game.init(deps, who, post);
    if (init.phase === 'guess') {
      const { guess } = await game.startGuess(deps, who, post, day - 1);
      const ids = (guess.choices ?? []).map((c) => c.id);
      offset.ms += 2000 + Math.floor(Math.random() * 8000);
      const answer = promptForDay(day - 1).id;
      await game.guess(deps, who, post, { day: day - 1, choiceId: pickRight ? answer : (ids.find((i) => i !== answer) ?? null) });
    }
    if (cells) await game.draw(deps, who, post, { day, cells });
  };

  // Yesterday: the crowd that made today's puzzle.
  at(today - 1);
  const yesterday = drawingsFor(promptForDay(today - 1).id);
  for (let i = 0; i < yesterday.length; i++) {
    await play({ userId: `t2_crowd${i}`, username: `crowd_${i}` }, today - 1, yesterday[i], i % 3 !== 0);
  }
  await play({ userId: 't2_alice', username: 'alice' }, today - 1, yesterday[3], true);

  // Today: a few early birds (the live blend you'll join after drawing).
  at(today);
  const todays = drawingsFor(promptForDay(today).id);
  for (let i = 0; i < 6; i++) {
    await play({ userId: `t2_early${i}`, username: `early_bird_${i}` }, today, todays[i], i % 4 !== 0);
  }
  offset.ms = 0;
  return { deps, today };
};
