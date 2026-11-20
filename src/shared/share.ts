/**
 * Spoiler-free result text for the share sheet and the "comment my result"
 * button (D-28). Never includes the answer word.
 */
export type ResultSummary = {
  day: number;
  tierName: string;
  tierLevel: number;
  formatName: string;
  /** null when there was nothing to guess. */
  correct: boolean | null;
  timedOut: boolean;
  elapsedMs: number | null;
  points: number;
  drew: boolean;
  streak: number;
};

export const RESULT_COMMENT_MAX = 300;

export const resultShareText = (r: ResultSummary): string => {
  const lines = [`Blurprint #${r.day} ${'◆'.repeat(Math.max(1, r.tierLevel))} ${r.tierName} · ${r.formatName}`];
  if (r.correct === true) {
    const time = r.elapsedMs !== null ? ` in ${(r.elapsedMs / 1000).toFixed(1)}s` : '';
    lines.push(`🟦 Read the crowd${time} (+${r.points})`);
  } else if (r.timedOut) lines.push('⏱ Ran out of time');
  else if (r.correct === false) lines.push('⬛ The blur fooled me');
  const extras = [r.drew ? '✏️ Drew today’s word' : '', r.streak > 0 ? `🔥 ${r.streak}` : ''].filter(Boolean);
  if (extras.length) lines.push(extras.join(' · '));
  return lines.join('\n').slice(0, RESULT_COMMENT_MAX);
};
