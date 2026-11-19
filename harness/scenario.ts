/**
 * Builds a realistic multi-day state in memory using the REAL services:
 *   today = Day 2 · Day 1 (ghost) has 18 crowd drawings · Day 0 (heart) seeded
 *   alice: played Day 1 (guess + draw) → sync bonus + streak 2 today
 *   bob / anon / newbie: fresh
 * buildScenario(9) jumps today to Day 9 (tier "Hard") with a crowd on Day 8,
 * to check the 6-choice layout: POST /__harness/reset?today=9
 */
import { DAY_MS } from '../src/shared/config';
import { promptForDay, startOfGameDayUtc } from '../src/shared/schedule';
import type { Deps, Who } from '../src/server/deps';
import { keys } from '../src/server/redisKeys';
import { SEED_BANK } from '../src/server/seed/seedBank';
import * as game from '../src/server/services/gameService';
import { createDayPost } from '../src/server/services/postService';
import { loadSeedRange } from '../src/server/services/seedService';
import { createFakePlatform } from '../src/server/testing/fakePlatform';
import { MemoryStore } from '../src/server/testing/memoryStore';

export type Harness = { deps: Deps; setClock: (ms: number) => void; realNow: () => number };

export const buildScenario = async (today = 2): Promise<Harness> => {
  const offset = { ms: 0 };
  const now = () => Date.now() + offset.ms;
  const store = new MemoryStore(now);
  const platform = createFakePlatform();
  platform.createDayPost = async ({ day, title }) => {
    const id = `harness_day${day}`;
    platform.posts.push({ id, day, title });
    return { id, url: `https://reddit.com/r/blurprint_dev/comments/${id}` };
  };
  const deps: Deps = { store, platform, now };
  const epoch = startOfGameDayUtc(Date.now()) - (today - 1) * DAY_MS;
  await store.set(keys.launchEpoch(), String(epoch));
  await loadSeedRange(deps, -2, 0);

  const at = (day: number) => {
    offset.ms = epoch + (day - 1) * DAY_MS + 3_600_000 - Date.now();
  };
  const ref = async (day: number) => ({
    postId: (await createDayPost(deps, day)).postId,
    postData: { day },
    subredditName: 'blurprint_dev',
  });
  const play = async (who: Who, day: number, cells: number[] | null, pick?: (ids: string[]) => string) => {
    const post = await ref(day);
    const init = await game.init(deps, who, post);
    if (init.phase === 'guess') {
      const { guess } = await game.startGuess(deps, who, post, day - 1);
      const ids = (guess.choices ?? []).map((c) => c.id);
      await game.guess(deps, who, post, { day: day - 1, choiceId: pick ? pick(ids) : ids[0]! });
    }
    if (cells) await game.draw(deps, who, post, { day, cells });
  };

  // Day 1 — ghost.
  at(1);
  const ghost = SEED_BANK[promptForDay(1).id] ?? [];
  for (let i = 0; i < ghost.length; i++) {
    await play({ userId: `t2_crowd${i}`, username: `crowd_${i}` }, 1, ghost[i]!, (ids) => ids[i % ids.length]!);
  }
  await play({ userId: 't2_alice', username: 'alice' }, 1, ghost[3]!, () => promptForDay(0).id);

  if (today > 2) {
    // Yesterday gets a crowd too (ghost shapes: only the layout matters here).
    at(today - 1);
    for (let i = 0; i < 8; i++) {
      await play({ userId: `t2_late${i}`, username: `late_crowd_${i}` }, today - 1, ghost[i]!, (ids) => ids[0]!);
    }
  }

  // Today — a few early birds.
  at(today);
  const drops = SEED_BANK[promptForDay(2).id] ?? [];
  for (let i = 0; i < 6; i++) {
    await play({ userId: `t2_early${i}`, username: `early_bird_${i}` }, today, drops[i]!, (ids) =>
      i % 3 === 0 ? ids[0]! : promptForDay(today - 1).id
    );
  }
  offset.ms = 0;
  return { deps, setClock: (ms) => (offset.ms = ms - Date.now()), realNow: () => Date.now() };
};
