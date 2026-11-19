import type { Platform } from '../deps';

export type FakePlatform = Platform & {
  posts: { id: string; day: number; title: string }[];
  stickied: string | null;
  flairs: Record<string, string>;
  subscribed: number;
  deletedUsers: Set<string>;
};

export const createFakePlatform = (): FakePlatform => {
  const p: FakePlatform = {
    posts: [],
    stickied: null,
    flairs: {},
    subscribed: 0,
    deletedUsers: new Set(),
    async createDayPost({ day, title }) {
      const id = `t3_day${day}_${p.posts.length}`;
      p.posts.push({ id, day, title });
      return { id, url: `https://reddit.com/r/test/comments/${id}` };
    },
    async stickyPost(id) {
      p.stickied = id;
    },
    async unstickyPost(id) {
      if (p.stickied === id) p.stickied = null;
    },
    async setUserFlair(username, text) {
      p.flairs[username] = text;
    },
    async subscribeCurrentUser() {
      p.subscribed++;
    },
    async userExists(userId) {
      return !p.deletedUsers.has(userId);
    },
  };
  return p;
};
