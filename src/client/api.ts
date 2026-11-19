import type {
  ApiError,
  BlendPayload,
  DrawRequest,
  DrawResponse,
  GuessRequest,
  GuessResponse,
  HintId,
  InitResponse,
  LeaderboardPayload,
  SkipGuessResponse,
  SplashResponse,
} from '../shared/types';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

const FRIENDLY: Record<ApiError['code'], string> = {
  NOT_LOGGED_IN: 'Log in to play.',
  ALREADY_DONE: 'You already did that today.',
  BAD_INPUT: 'Something about that didn’t look right.',
  WRONG_PHASE: 'Things moved on — let’s reload.',
  NOT_FOUND: 'This Blurprint isn’t available.',
  SERVER: 'The server hiccuped. Try again?',
};

const isApiError = (v: unknown): v is ApiError =>
  typeof v === 'object' && v !== null && 'code' in v && 'error' in v && typeof v.error === 'string';

const request = async <T>(path: string, init?: RequestInit): Promise<ApiResult<T>> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(path, {
      ...init,
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null);
      if (isApiError(body)) return { ok: false, error: { code: body.code, error: body.error || FRIENDLY[body.code] } };
      return { ok: false, error: { code: 'SERVER', error: FRIENDLY.SERVER } };
    }
    // The server is typed against the same shared contract (src/shared/types.ts).
    const data: T = await res.json();
    return { ok: true, data };
  } catch {
    return { ok: false, error: { code: 'SERVER', error: 'Can’t reach the server. Check your connection and retry.' } };
  } finally {
    clearTimeout(timer);
  }
};

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const api = {
  init: () => request<InitResponse>('/api/init'),
  splash: () => request<SplashResponse>('/api/splash'),
  guess: (body: GuessRequest) => post<GuessResponse>('/api/guess', body),
  skipGuess: () => post<SkipGuessResponse>('/api/skip-guess'),
  draw: (body: DrawRequest) => post<DrawResponse>('/api/draw', body),
  blend: (day: number) => request<BlendPayload>(`/api/blend?day=${day}`),
  leaderboard: (day: number) => request<LeaderboardPayload>(`/api/leaderboard?day=${day}`),
  hint: (hint: HintId) => post<{ ok: true }>('/api/hint', { hint }),
  forget: () => post<{ ok: true }>('/api/forget'),
  subscribe: () => post<{ ok: true }>('/api/subscribe'),
};
