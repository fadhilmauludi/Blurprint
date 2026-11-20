import { describe, expect, it } from 'vitest';
import { RESULT_COMMENT_MAX, resultShareText, type ResultSummary } from '../share';

const base: ResultSummary = {
  day: 12,
  tierName: 'Hard',
  tierLevel: 3,
  formatName: 'Zoom out',
  correct: true,
  timedOut: false,
  elapsedMs: 3200,
  points: 130,
  drew: true,
  streak: 5,
};

describe('result share text', () => {
  it('summarises the day without spoiling the answer', () => {
    const t = resultShareText(base);
    expect(t).toContain('Blurprint #12');
    expect(t).toContain('◆◆◆ Hard');
    expect(t).toContain('3.2s');
    expect(t).toContain('+130');
    expect(t).toContain('🔥 5');
    expect(t).toContain('Zoom out');
  });

  it('describes a miss and a timeout differently', () => {
    expect(resultShareText({ ...base, correct: false, points: 0 })).toMatch(/fooled me/i);
    expect(resultShareText({ ...base, correct: false, timedOut: true, points: 0, elapsedMs: null })).toMatch(/out of time/i);
  });

  it('works for a day with no guess (launch day) and no drawing', () => {
    const t = resultShareText({ ...base, correct: null, timedOut: false, elapsedMs: null, points: 0, drew: false, streak: 0 });
    expect(t).toContain('Blurprint #12');
    expect(t).not.toContain('🔥');
    expect(t).not.toContain('undefined');
    expect(t).not.toContain('null');
  });

  it('stays short enough for a comment', () => {
    expect(resultShareText(base).length).toBeLessThanOrEqual(RESULT_COMMENT_MAX);
  });
});
