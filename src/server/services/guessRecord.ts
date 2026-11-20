/** How a player's guess is stored in `day:N:guesses` (shared by the game and share services). */
export type StoredGuess = { pickedId: string | null; correct: boolean; points: number; elapsedMs: number | null };

/** Stored as "{choiceId}|{0|1}|{points}|{elapsedMs}"; choiceId '' = the clock ran out. */
export const encodeGuess = (g: StoredGuess): string => `${g.pickedId ?? ''}|${g.correct ? 1 : 0}|${g.points}|${g.elapsedMs ?? ''}`;

export const parseGuess = (raw: string | undefined): StoredGuess | null => {
  if (raw === undefined || raw === '') return null;
  const [pickedId, flag, points, elapsed] = raw.split('|');
  const n = (x: string | undefined) => (x === undefined || x === '' || !Number.isFinite(Number(x)) ? null : Number(x));
  return { pickedId: pickedId ? pickedId : null, correct: flag === '1', points: n(points) ?? 0, elapsedMs: n(elapsed) };
};

