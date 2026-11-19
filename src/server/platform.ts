import { context, realtime, reddit } from '@devvit/web/server';
import { isT2, isT3 } from '@devvit/web/shared';
import type { Platform } from './deps';

/** Production Platform backed by the Devvit Reddit API. */
export const devvitPlatform: Platform = {
  async createDayPost({ day, title, fallbackText }) {
    const post = await reddit.submitCustomPost({
      title,
      entry: 'default',
      postData: { day },
      textFallback: { text: fallbackText },
    });
    return { id: post.id, url: post.url };
  },
  async stickyPost(postId) {
    if (!isT3(postId)) return;
    const post = await reddit.getPostById(postId);
    await post.sticky(1);
  },
  async unstickyPost(postId) {
    if (!isT3(postId)) return;
    const post = await reddit.getPostById(postId);
    await post.unsticky();
  },
  async setUserFlair(username, text) {
    await reddit.setUserFlair({ subredditName: context.subredditName, username, text });
  },
  async subscribeCurrentUser() {
    await reddit.subscribeToCurrentSubreddit();
  },
  async userExists(userId) {
    if (!isT2(userId)) return true;
    return (await reddit.getUserById(userId)) !== undefined;
  },
  async publish(channel, msg) {
    await realtime.send(channel, msg);
  },
};
