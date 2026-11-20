/**
 * Drawings for the standalone demo: the shared (placeholder) seed bank, which
 * now covers 35 prompts — enough for every demo level and for duels.
 */
import { SEED_BANK } from '../src/server/seed/seedBank';

export const drawingsFor = (promptId: string): number[][] => SEED_BANK[promptId] ?? [];
