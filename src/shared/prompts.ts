/**
 * Prompt bank (spec §4.2). Content owner: Fadhil.
 *
 * Every group holds prompts with SIMILAR SILHOUETTES so the three decoys are
 * fair but tricky. Rules for words: simple English nouns a non-native speaker
 * knows; nothing offensive, branded or political. Each group needs at least
 * GUESS_CHOICES (4) prompts; 6 gives variety in decoys.
 *
 * Season 1 (GROUPS) is frozen: days 1–72 are its seeded shuffle, and seed data,
 * the demo levels and the docs rely on that order. New words go in SEASON_2
 * (or a later season): each season is shuffled on its own and played after the
 * previous one, so adding words never moves a day that was already scheduled.
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
  | 'flying'
  | 'wheels'
  | 'many-legs'
  | 'clothes'
  | 'boxy';

export type Prompt = {
  id: string;
  word: string;
  group: PromptGroup;
};

const GROUPS: Partial<Record<PromptGroup, readonly string[]>> = {
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

/**
 * Season 2 (D-30): 95 more words so a daily player meets ~5 months of words
 * before any repeat. Same rules: drawable in a 10×10 grid, known to
 * non-native speakers, similar silhouettes inside a group.
 */
const SEASON_2: Record<PromptGroup, readonly string[]> = {
  round: ['ball', 'orange', 'wheel', 'coin', 'planet', 'button'],
  'tall-thin': ['pencil', 'ladder', 'lollipop', 'carrot', 'microphone', 'ice cream'],
  dome: ['turtle', 'helmet', 'beehive', 'snail', 'hamburger', 'volcano'],
  house: ['windmill', 'doghouse', 'cabin', 'factory', 'palace'],
  'four-legged': ['elephant', 'pig', 'sheep', 'lion', 'bed', 'bench'],
  long: ['boat', 'crocodile', 'shark', 'truck', 'whale', 'caterpillar'],
  'heart-drop': ['pear', 'cherry', 'egg', 'lemon', 'onion', 'acorn'],
  spiky: ['pineapple', 'starfish', 'porcupine', 'palm tree'],
  'cup-bowl': ['vase', 'basket', 'jar', 'cauldron', 'bathtub'],
  face: ['alien', 'snowman', 'teddy bear', 'frog', 'panda'],
  tool: ['spoon', 'axe', 'broom', 'shovel', 'paintbrush', 'toothbrush'],
  flying: ['helicopter', 'bee', 'dragon', 'parrot', 'swan'],
  wheels: ['bicycle', 'scooter', 'skateboard', 'tractor', 'wagon', 'motorbike', 'stroller', 'wheelchair'],
  'many-legs': ['spider', 'crab', 'octopus', 'ant', 'beetle', 'lobster', 'scorpion'],
  clothes: ['hat', 'shoe', 'sock', 'glove', 'shirt', 'dress', 'boot'],
  boxy: ['book', 'television', 'gift', 'suitcase', 'fridge', 'door', 'phone', 'envelope'],
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
  'wheels',
  'many-legs',
  'clothes',
  'boxy',
];

const seasonPrompts = (season: Partial<Record<PromptGroup, readonly string[]>>): Prompt[] =>
  PROMPT_GROUPS.flatMap((group) => (season[group] ?? []).map((word) => ({ id: toId(word), word, group })));

/** Prompts per season, in a fixed order (schedule.ts shuffles each season separately). */
export const SEASONS: readonly (readonly Prompt[])[] = [seasonPrompts(GROUPS), seasonPrompts(SEASON_2)];
export const SEASON_1_SIZE = SEASONS[0]!.length;

export const PROMPTS: readonly Prompt[] = SEASONS.flat();

const BY_ID = new Map(PROMPTS.map((p) => [p.id, p]));

export const getPromptById = (id: string): Prompt | undefined => BY_ID.get(id);

export const promptsInGroup = (group: PromptGroup): Prompt[] =>
  PROMPTS.filter((p) => p.group === group);
