import type { Platform } from '../deps';

export type FakePlatform = Platform & {
  posts: { id: string; day: number; title: string }[];
  stickied: string | null;
  flairs: Record<string, string>;
  subscribed: number;
  deletedUsers: Set<string>;
  published: { channel: string; msg: unknown }[];
  comments: { id: string; parentId: string; text: string; pinned: boolean; asUser: boolean }[];
};

export const createFakePlatform = (): FakePlatform => {
  const p: FakePlatform = {
    posts: [],
    stickied: null,
    flairs: {},
    subscribed: 0,
    deletedUsers: new Set(),
    published: [],
    comments: [],
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
    async pinComment(postId, text) {
      const id = `t1_pin${p.comments.length}`;
      p.comments.push({ id, parentId: postId, text, pinned: true, asUser: false });
      return id;
    },
    async commentAsUser(parentId, text) {
      const id = `t1_user${p.comments.length}`;
      p.comments.push({ id, parentId, text, pinned: false, asUser: true });
      return id;
    },
    async publish(channel, msg) {
      p.published.push({ channel, msg });
    },
  };
  return p;
};
