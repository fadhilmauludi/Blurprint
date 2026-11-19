import type { Context } from 'hono';
import type { ApiError } from '../../shared/types';
import { ApiFail } from '../deps';

/** Turn any thrown error into a typed ApiError JSON response. */
export const fail = (c: Context, err: unknown) => {
  if (err instanceof ApiFail) {
    return c.json<ApiError>({ error: err.message, code: err.code }, err.status);
  }
  console.error('Unhandled API error:', err instanceof Error ? err.stack ?? err.message : err);
  return c.json<ApiError>({ error: 'Something went wrong. Please try again.', code: 'SERVER' }, 500);
};

export const readJson = async (c: Context): Promise<unknown> => {
  try {
    return await c.req.json<unknown>();
  } catch {
    return null;
  }
};

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
