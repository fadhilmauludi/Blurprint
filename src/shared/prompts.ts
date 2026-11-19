/**
 * Prompt bank (spec §4.2). Content owner: Fadhil.
 *
 * Every group holds prompts with SIMILAR SILHOUETTES so the three decoys are
 * fair but tricky. Rules for words: simple English nouns a non-native speaker
 * knows; nothing offensive, branded or political. Each group needs at least
 * GUESS_CHOICES (4) prompts; 6 gives variety in decoys.
 *
 * Changing this list reshuffles the whole schedule (see schedule.ts). Only edit
 * between seasons, or append and bump PROMPT_SHUFFLE_SEED knowingly.
 */

export type PromptGroup =
  | 'round'
  | 'tall-thin'
  | 'dome'
  | 'house'
  | 'four-legged'
  | 'long'
  | 'heart-drop'
  | 'spiky'
  | 'cup-bowl'
  | 'face'
  | 'tool'
  | 'flying';

export type Prompt = {
  id: string;
  word: string;
  group: PromptGroup;
};

const GROUPS: Record<PromptGroup, readonly string[]> = {
  round: ['sun', 'cookie', 'flower', 'clock', 'pizza', 'donut'],
  'tall-thin': ['candle', 'tree', 'rocket', 'lighthouse', 'bottle', 'giraffe'],
  dome: ['umbrella', 'mushroom', 'jellyfish', 'bell', 'igloo', 'rainbow'],
  house: ['house', 'tent', 'barn', 'castle', 'church', 'birdhouse'],
  'four-legged': ['cat', 'dog', 'horse', 'cow', 'table', 'chair'],
  long: ['car', 'train', 'fish', 'snake', 'bus', 'submarine'],
  'heart-drop': ['heart', 'strawberry', 'apple', 'balloon', 'raindrop', 'leaf'],
  spiky: ['star', 'snowflake', 'crown', 'cactus', 'hedgehog', 'firework'],
  'cup-bowl': ['mug', 'bowl', 'bucket', 'plant pot', 'trophy', 'teacup'],
  face: ['smiley', 'ghost', 'skull', 'owl', 'robot', 'pumpkin'],
  tool: ['key', 'anchor', 'hammer', 'sword', 'fork', 'guitar'],
  flying: ['bird', 'plane', 'butterfly', 'kite', 'bat', 'dragonfly'],
};

const toId = (word: string): string => word.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const PROMPT_GROUPS: readonly PromptGroup[] = [
  'round',
  'tall-thin',
  'dome',
  'house',
  'four-legged',
  'long',
  'heart-drop',
  'spiky',
  'cup-bowl',
  'face',
  'tool',
  'flying',
];

export const PROMPTS: readonly Prompt[] = PROMPT_GROUPS.flatMap((group) =>
  GROUPS[group].map((word) => ({ id: toId(word), word, group }))
);

const BY_ID = new Map(PROMPTS.map((p) => [p.id, p]));

export const getPromptById = (id: string): Prompt | undefined => BY_ID.get(id);

export const promptsInGroup = (group: PromptGroup): Prompt[] =>
  PROMPTS.filter((p) => p.group === group);
