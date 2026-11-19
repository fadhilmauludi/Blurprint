/** Demo settings live in the URL hash (#day9-newbie) so a reload keeps them. */
export type Player = 'alice' | 'newbie';
export type DemoSettings = { day: number; player: Player };

export const LEVELS: readonly { day: number; label: string }[] = [
  { day: 2, label: 'Warm-up · Day 2' },
  { day: 6, label: 'Tricky · Day 6' },
  { day: 9, label: 'Hard · Day 9' },
  { day: 16, label: 'Expert · Day 16' },
];

export const readSettings = (): DemoSettings => {
  const m = /^#day(\d+)(-newbie)?$/.exec(location.hash);
  const day = m ? Number(m[1]) : 2;
  return { day: LEVELS.some((l) => l.day === day) ? day : 2, player: m?.[2] ? 'newbie' : 'alice' };
};

export const settingsHash = (s: DemoSettings): string => `#day${s.day}${s.player === 'newbie' ? '-newbie' : ''}`;
