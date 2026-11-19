/**
 * Journeys wrapper (spec §8.7). Every call is fire-and-forget and swallows
 * errors, so a missing / not-yet-approved Journeys setup is a no-op.
 * No PII ever goes into action / actionDetails — only day numbers and enums.
 */
import { telemetry } from '@devvit/analytics/client/reddit';

let started = false;
let ready = false;
const seenResults = new Set<string>();

const safe = (fn: () => Promise<unknown>): void => {
  try {
    void fn().catch(() => undefined);
  } catch {
    /* no-op */
  }
};

export const track = {
  /** Game view finished loading and is interactive. */
  appReady: () => {
    if (ready) return;
    ready = true;
    safe(() => telemetry.appReady());
  },

  /** Call on the FIRST committed user action (Journey.Start must not fire on load). */
  ensureStarted: (day: number, isArchive: boolean, firstTime: boolean) => {
    if (started) return;
    started = true;
    safe(async () => {
      await telemetry.startJourney();
      await telemetry.interaction({
        action: 'session_start',
        actionDetails: `day:${day};archive:${isArchive ? 1 : 0};first:${firstTime ? 1 : 0}`,
      });
    });
  },

  guessSubmitted: (day: number, correct: boolean) =>
    safe(() => telemetry.progress({ progress: 0.3, action: 'guess_submitted', actionDetails: `day:${day};correct:${correct ? 1 : 0}` })),
  drawStarted: (day: number) => safe(() => telemetry.progress({ progress: 0.5, action: 'draw_started', actionDetails: `day:${day}` })),
  drawSubmitted: (day: number, cellCount: number) =>
    safe(() => telemetry.progress({ progress: 0.8, action: 'draw_submitted', actionDetails: `day:${day};cells:${cellCount}` })),
  drawTimeout: (day: number) => safe(() => telemetry.interaction({ action: 'draw_timeout', actionDetails: `day:${day}` })),

  resultViewed: (day: number, streak: number, win: boolean, score: number) => {
    const key = `${day}:${score}`;
    if (seenResults.has(key)) return;
    seenResults.add(key);
    safe(async () => {
      await telemetry.interaction({ action: 'result_viewed', actionDetails: `day:${day};streak:${streak}` });
      if (started) await telemetry.endJourney({ complete: true, game: { win, score } });
      started = false;
    });
  },

  cta: (kind: 'comment' | 'subscribe', day: number) =>
    safe(() => telemetry.interaction({ action: `cta_${kind}`, actionDetails: `day:${day}` })),
  streakMilestone: (streak: number) => safe(() => telemetry.interaction({ action: 'streak_milestone', actionDetails: `streak:${streak}` })),
  guessStarted: (day: number, tier: number) =>
    safe(() => telemetry.interaction({ action: 'guess_started', actionDetails: `day:${day};tier:${tier}` })),
  duel: (kind: 'created' | 'invite_shared' | 'joined' | 'finished', detail = '') =>
    safe(() => telemetry.interaction({ action: `duel_${kind}`, actionDetails: detail })),
  leaderboardViewed: (tab: 'today' | 'streaks' | 'all') => safe(() => telemetry.interaction({ action: 'leaderboard_viewed', actionDetails: `tab:${tab}` })),
};
