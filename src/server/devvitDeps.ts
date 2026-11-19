import { context, redis } from '@devvit/web/server';
import type { Deps, Who } from './deps';
import { devvitPlatform } from './platform';
import type { PostRef } from './services/gameService';

export const deps: Deps = { store: redis, platform: devvitPlatform, now: () => Date.now() };

/** Identity comes from the Devvit request context only. */
export const who = (): Who => ({ userId: context.userId, username: context.username });

export const postRef = (): PostRef => ({
  postId: context.postId,
  postData: context.postData,
  subredditName: context.subredditName,
});
