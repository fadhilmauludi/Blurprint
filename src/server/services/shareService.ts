/**
 * Getting the game seen on Reddit (D-28): the daily pinned "results thread"
 * and the explicit "comment my result" button.
 *
 * Devvit user-action rules: score comments must be posted AS THE USER, only
 * from an explicit button that says so, never as a condition for anything, and
 * generic score comments go as replies to a pinned comment. The text is built
 * here from stored results — never taken from the client — and never contains
 * the answer.
 */
import { tierForDay } from '../../shared/difficulty';
import { FORMAT_INFO, formatForDay } from '../../shared/formats';
import { resultShareText } from '../../shared/share';
import type { CommentResultResponse, DayIndex, LeaderboardEntry } from '../../shared/types';
import { ApiFail, type Deps, type Who } from '../deps';
import { DRAWING_TIMEOUT, keys } from '../redisKeys';
import { getPostDay, getToday } from './dayService';
import { parseGuess } from './guessRecord';
import { getLeaderboard } from './leaderboardService';
import { USER_DAY_TTL_SECONDS, getUserState, userSummary } from './userService';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Body of the app's pinned comment on day N's post. Names without "u/" so nobody gets pinged. */
export const resultsThreadText = (day: DayIndex, winners: LeaderboardEntry[]): string => {
  const lines = [
    `📌 **Blurprint #${day} results thread** — reply here with your result (the game has a “Comment my result” button). No spoilers in replies, please!`,
  ];
  if (winners.length > 0) {
    lines.push('', `🏆 Yesterday’s top crowd-readers: ${winners.map((w, i) => `${MEDALS[i] ?? `#${w.rank}`} ${w.username} (${w.score})`).join(' · ')}`);
  }
  lines.push('', 'Tomorrow’s puzzle is made from today’s drawings — draw yours before midnight UTC.');
  return lines.join('\n');
};

/** Pin today's results thread (best effort: needs the app account to be a moderator). */
export const pinResultsThread = async (deps: Deps, day: DayIndex, postId: string): Promise<string | null> => {
  const existing = await deps.store.get(keys.dayResultsComment(day));
  if (existing) return existing;
  try {
    const { yesterday } = await getLeaderboard(deps, day, undefined);
    const id = await deps.platform.pinComment(postId, resultsThreadText(day, yesterday));
    await deps.store.set(keys.dayResultsComment(day), id);
    return id;
  } catch (e) {
    console.warn('results thread pin failed', e instanceof Error ? e.message : e);
    return null;
  }
};

/** The player's spoiler-free result text for a day (empty when they haven't played it). */
export const shareTextFor = async (
  deps: Deps,
  userId: string | undefined,
  day: DayIndex,
  drew: boolean,
  streak: number
): Promise<string> => {
  if (!userId) return '';
  const guess = parseGuess(await deps.store.hGet(keys.dayGuesses(day - 1), userId));
  const tier = tierForDay(day);
  return resultShareText({
    day,
    tierName: tier.name,
    tierLevel: tier.level,
    formatName: FORMAT_INFO[formatForDay(day)].name,
    correct: guess ? guess.correct : null,
    timedOut: guess !== null && guess.pickedId === null,
    elapsedMs: guess?.elapsedMs ?? null,
    points: guess?.points ?? 0,
    drew,
    streak,
  });
};

export const hasCommented = async ({ store }: Deps, day: DayIndex, userId: string | undefined): Promise<boolean> =>
  userId ? (await store.hGet(keys.dayCommented(day), userId)) !== undefined : false;

/** "Comment my result": reply to today's pinned results thread as the user. Once per day. */
export const commentResult = async (
  deps: Deps,
  who: Who,
  post: { postId: string | undefined; postData: unknown }
): Promise<CommentResultResponse> => {
  if (!who.userId) throw new ApiFail('NOT_LOGGED_IN', 'Log in first.');
  const today = await getToday(deps);
  const day = await getPostDay(deps, post.postId, post.postData);
  if (day !== today || !post.postId) throw new ApiFail('WRONG_PHASE', 'You can share results on today’s Blurprint only.');

  const drawing = await deps.store.hGet(keys.dayDrawings(day), who.userId);
  if (drawing === undefined) throw new ApiFail('WRONG_PHASE', 'Finish today’s Blurprint first.');
  if (await hasCommented(deps, day, who.userId)) throw new ApiFail('ALREADY_DONE', 'You already shared today’s result.');

  const state = await getUserState(deps, who.userId);
  const text = await shareTextFor(deps, who.userId, day, drawing !== DRAWING_TIMEOUT, userSummary(who, state, today).streak);
  const parent = (await pinResultsThread(deps, day, post.postId)) ?? post.postId;

  // Claim first so a double tap can't post twice; release if Reddit refuses.
  const claimed = await deps.store.hSetNX(keys.dayCommented(day), who.userId, 'pending');
  if (claimed === 0) throw new ApiFail('ALREADY_DONE', 'You already shared today’s result.');
  try {
    const id = await deps.platform.commentAsUser(parent, text);
    await deps.store.hSet(keys.dayCommented(day), { [who.userId]: id });
    await deps.store.expire(keys.dayCommented(day), USER_DAY_TTL_SECONDS);
  } catch (e) {
    await deps.store.hDel(keys.dayCommented(day), [who.userId]);
    console.warn('comment as user failed', e instanceof Error ? e.message : e);
    throw new ApiFail('SERVER', 'Reddit didn’t accept the comment. Try again in a moment.');
  }
  return { ok: true, text };
};
