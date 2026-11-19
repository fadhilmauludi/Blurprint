import type { Store } from './store';

/** Reddit-side effects, abstracted so services run in tests and the local harness. */
export type Platform = {
  createDayPost(opts: { day: number; title: string; fallbackText: string }): Promise<{ id: string; url: string }>;
  stickyPost(postId: string): Promise<void>;
  unstickyPost(postId: string): Promise<void>;
  setUserFlair(username: string, text: string): Promise<void>;
  /** Subscribe the CURRENT user to the subreddit (explicit button only — Devvit Rules). */
  subscribeCurrentUser(): Promise<void>;
  /** false when the account was deleted (Devvit Rules: purge its data). */
  userExists(userId: string): Promise<boolean>;
};

export type Deps = {
  store: Store;
  platform: Platform;
  now: () => number;
};

/** The caller, always taken from the Devvit request context — never the body. */
export type Who = { userId: string | undefined; username: string | undefined };

export type ApiFailCode = 'NOT_LOGGED_IN' | 'ALREADY_DONE' | 'BAD_INPUT' | 'WRONG_PHASE' | 'NOT_FOUND' | 'SERVER';

type FailStatus = 400 | 401 | 404 | 409 | 500;

const STATUS: Record<ApiFailCode, FailStatus> = {
  NOT_LOGGED_IN: 401,
  ALREADY_DONE: 409,
  BAD_INPUT: 400,
  WRONG_PHASE: 409,
  NOT_FOUND: 404,
  SERVER: 500,
};

/** Typed, user-safe failure. Routes turn it into an `ApiError` JSON body. */
export class ApiFail extends Error {
  readonly status: FailStatus;
  constructor(
    readonly code: ApiFailCode,
    message: string
  ) {
    super(message);
    this.status = STATUS[code];
  }
}
