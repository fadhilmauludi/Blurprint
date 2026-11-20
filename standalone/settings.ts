/** Demo settings live in the URL hash (#day9-newbie) so a reload keeps them. */
export type Player = 'alice' | 'newbie';
export type DemoSettings = { day: number; player: Player };

/** Demo days whose puzzles have drawings in the seed bank, one per level, covering every format. */
export const LEVELS: readonly { day: number; label: string }[] = [
  { day: 2, label: 'Warm-up · Focus' },
  { day: 7, label: 'Tricky · Zoom' },
  { day: 8, label: 'Hard · Tiles' },
  { day: 16, label: 'Expert · Zoom' },
];

export const readSettings = (): DemoSettings => {
  const m = /^#day(\d+)(-newbie)?$/.exec(location.hash);
  const day = m ? Number(m[1]) : 2;
  return { day: LEVELS.some((l) => l.day === day) ? day : 2, player: m?.[2] ? 'newbie' : 'alice' };
};

export const settingsHash = (s: DemoSettings): string => `#day${s.day}${s.player === 'newbie' ? '-newbie' : ''}`;
