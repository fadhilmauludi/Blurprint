/** Duel ids and share-link payloads (untrusted input: validate before use). */

const ID_RE = /^[a-z0-9]{10}$/;

export const isDuelId = (id: unknown): id is string => typeof id === 'string' && ID_RE.test(id);

/** The share-sheet `data` for a duel invite. */
export const duelShareData = (id: string): string => JSON.stringify({ t: 'duel', id });

/** Reads a duel id out of share data; anything else (or tampered data) → null. */
export const parseDuelShare = (raw: string | undefined | null): string | null => {
  if (!raw || raw.length > 1024) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v === 'object' && v !== null && 't' in v && v.t === 'duel' && 'id' in v && isDuelId(v.id)) return v.id;
  } catch {
    /* not ours */
  }
  return null;
};
