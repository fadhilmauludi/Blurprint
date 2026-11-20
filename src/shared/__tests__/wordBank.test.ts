import { describe, expect, it } from 'vitest';
import { MAX_GUESS_CHOICES } from '../config';
import { PROMPTS, PROMPT_GROUPS, SEASON_1_SIZE, promptsInGroup } from '../prompts';
import { choicesForDay, getShuffledBank, promptForDay } from '../schedule';

/** Day 1..72 as shipped before the word list grew (seed data, demo levels and docs rely on it). */
const SEASON_1_ORDER = ["ghost","raindrop","cookie","fork","kite","trophy","mug","candle","igloo","balloon","horse","castle","mushroom","train","table","skull","robot","strawberry","bat","giraffe","umbrella","submarine","donut","smiley","jellyfish","plant-pot","flower","church","car","pizza","snake","anchor","barn","lighthouse","cactus","bus","bucket","house","owl","leaf","tent","rainbow","birdhouse","firework","rocket","bowl","dragonfly","dog","bottle","bell","clock","guitar","chair","pumpkin","snowflake","hedgehog","star","cow","teacup","fish","butterfly","apple","plane","bird","key","cat","tree","hammer","sword","sun","crown","heart"];

describe('bigger word bank', () => {
  it('has at least 150 unique words', () => {
    expect(PROMPTS.length).toBeGreaterThanOrEqual(150);
    expect(new Set(PROMPTS.map((p) => p.id)).size).toBe(PROMPTS.length);
    expect(new Set(PROMPTS.map((p) => p.word.toLowerCase())).size).toBe(PROMPTS.length);
  });

  it('keeps the first 72 days exactly as before', () => {
    expect(SEASON_1_SIZE).toBe(72);
    expect(getShuffledBank().slice(0, 72).map((p) => p.id)).toEqual(SEASON_1_ORDER);
    for (let d = 1; d <= 72; d++) expect(promptForDay(d).id).toBe(SEASON_1_ORDER[d - 1]);
  });

  it('plays every new word before any repeat', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= PROMPTS.length; d++) seen.add(promptForDay(d).id);
    expect(seen.size).toBe(PROMPTS.length);
  });

  it('every group can fill the hardest level (6 choices) with real decoys', () => {
    for (const g of PROMPT_GROUPS) expect(promptsInGroup(g).length).toBeGreaterThanOrEqual(MAX_GUESS_CHOICES + 1);
    for (let d = 1; d <= PROMPTS.length * 2; d++) {
      const c = choicesForDay(d, MAX_GUESS_CHOICES);
      expect(new Set(c.map((x) => x.id)).size).toBe(MAX_GUESS_CHOICES);
    }
  });

  it('words are short, plain lowercase nouns (no digits or punctuation)', () => {
    for (const p of PROMPTS) {
      expect(p.word).toMatch(/^[a-z]+( [a-z]+)?$/);
      expect(p.word.length).toBeLessThanOrEqual(12);
    }
  });
});
