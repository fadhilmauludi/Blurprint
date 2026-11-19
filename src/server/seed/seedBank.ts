import seed from './seed-bank.json';

/** promptId → list of raw drawings (cell indices). See tools/make-seed.ts and spec §11. */
export const SEED_BANK: Record<string, number[][]> = Object.fromEntries(Object.entries(seed.prompts));
export const SEED_IS_PLACEHOLDER: boolean = seed.placeholder;
