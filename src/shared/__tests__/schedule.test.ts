import { describe, expect, it } from 'vitest';
import { DAY_MS, GUESS_CHOICES } from '../config';
import { PROMPTS, PROMPT_GROUPS, SEASON_1_SIZE, getPromptById, promptsInGroup } from '../prompts';
import {
  choicesForDay,
  dayStartMs,
  getDayIndex,
  getShuffledBank,
  mulberry32,
  nextRolloverMs,
  promptForDay,
  startOfGameDayUtc,
} from '../schedule';

const EPOCH = Date.UTC(2026, 11, 1); // Day 1 = 1 Dec 2026 00:00 UTC

describe('getDayIndex', () => {
  it('is 1 on launch day, at the first and last second', () => {
    expect(getDayIndex(EPOCH, EPOCH)).toBe(1);
    expect(getDayIndex(EPOCH + DAY_MS - 1000, EPOCH)).toBe(1); // 23:59:59
  });
  it('rolls over exactly at 00:00:00 UTC', () => {
    expect(getDayIndex(EPOCH + DAY_MS, EPOCH)).toBe(2);
    expect(getDayIndex(EPOCH + DAY_MS - 1, EPOCH)).toBe(1);
  });
  it('is 0 / negative before launch (seeded days)', () => {
    expect(getDayIndex(EPOCH - 1, EPOCH)).toBe(0);
    expect(getDayIndex(EPOCH - DAY_MS - 1, EPOCH)).toBe(-1);
  });
  it('round-trips with dayStartMs', () => {
    for (const d of [-3, 0, 1, 2, 40, 365]) expect(getDayIndex(dayStartMs(d, EPOCH), EPOCH)).toBe(d);
  });
});

describe('startOfGameDayUtc / nextRolloverMs', () => {
  it('aligns to UTC midnight', () => {
    const t = Date.UTC(2026, 10, 19, 13, 37, 5);
    expect(startOfGameDayUtc(t)).toBe(Date.UTC(2026, 10, 19));
    expect(nextRolloverMs(t)).toBe(Date.UTC(2026, 10, 20));
  });
  it('treats exactly midnight as the start of the new day', () => {
    const t = Date.UTC(2026, 10, 20);
    expect(startOfGameDayUtc(t)).toBe(t);
    expect(nextRolloverMs(t)).toBe(t + DAY_MS);
  });
});

describe('prompt bank', () => {
  it('has at least 60 prompts in 12+ groups, unique ids', () => {
    expect(PROMPTS.length).toBeGreaterThanOrEqual(60);
    expect(PROMPT_GROUPS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(PROMPTS.map((p) => p.id)).size).toBe(PROMPTS.length);
  });
  it('every group can supply GUESS_CHOICES prompts', () => {
    for (const g of PROMPT_GROUPS) expect(promptsInGroup(g).length).toBeGreaterThanOrEqual(GUESS_CHOICES);
  });
  it('looks up by id', () => {
    expect(getPromptById('plant-pot')?.word).toBe('plant pot');
    expect(getPromptById('nope')).toBeUndefined();
  });
});

describe('schedule', () => {
  it('mulberry32 is deterministic', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
  });
  it('shuffled bank is a permutation of the bank', () => {
    const bank = getShuffledBank();
    expect(bank.length).toBe(PROMPTS.length);
    expect(new Set(bank.map((p) => p.id))).toEqual(new Set(PROMPTS.map((p) => p.id)));
  });
  it('never repeats a prompt within one cycle', () => {
    const n = PROMPTS.length;
    const seen = new Set<string>();
    for (let d = 1; d <= n; d++) seen.add(promptForDay(d).id);
    expect(seen.size).toBe(n);
    expect(promptForDay(1).id).toBe(promptForDay(1 + n).id);
  });
  it('works for pre-launch days', () => {
    // Pre-launch days stay on the last season-1 words (the ones with seed drawings).
    expect(promptForDay(0).id).toBe(promptForDay(SEASON_1_SIZE).id);
    expect(promptForDay(-1).id).toBe(promptForDay(SEASON_1_SIZE - 1).id);
    expect(promptForDay(0).id).toBe('heart');
  });
  it('choices: 4 unique, include the answer, decoys from the same group', () => {
    for (let d = -5; d <= 200; d++) {
      const answer = promptForDay(d);
      const choices = choicesForDay(d);
      expect(choices).toHaveLength(GUESS_CHOICES);
      expect(new Set(choices.map((c) => c.id)).size).toBe(GUESS_CHOICES);
      expect(choices.some((c) => c.id === answer.id)).toBe(true);
      for (const c of choices) expect(getPromptById(c.id)?.group).toBe(answer.group);
    }
  });
  it('choices are identical for every call (same for every player)', () => {
    expect(choicesForDay(17)).toEqual(choicesForDay(17));
  });
  it('the answer is not always in the same slot', () => {
    const slots = new Set<number>();
    for (let d = 1; d <= 40; d++) slots.add(choicesForDay(d).findIndex((c) => c.id === promptForDay(d).id));
    expect(slots.size).toBeGreaterThan(1);
  });
});
