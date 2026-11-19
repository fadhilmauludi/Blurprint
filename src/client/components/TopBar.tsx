import { useSyncExternalStore, type ReactNode } from 'react';
import type { TierInfo } from '../../shared/types';
import { sfx } from '../audio';

type Props = { day: number; streak?: number | null; tier?: TierInfo | null; right?: ReactNode };

const useMuted = (): boolean => useSyncExternalStore(sfx.subscribe, sfx.isMuted, sfx.isMuted);

export const MuteButton = () => {
  const muted = useMuted();
  return (
    <button
      type="button"
      className="icon-btn"
      aria-pressed={!muted}
      aria-label={muted ? 'Sound off. Turn sound on' : 'Sound on. Turn sound off'}
      onClick={() => {
        sfx.setMuted(!muted);
        if (muted) sfx.play('tap');
      }}
    >
      <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
    </button>
  );
};

export const TierBadge = ({ tier }: { tier: TierInfo }) => (
  <span className={`tier-badge tier-${tier.level}`} title={`Difficulty: ${tier.name}`}>
    <span aria-hidden="true">{'◆'.repeat(tier.level)}</span> {tier.name}
  </span>
);

export const TopBar = ({ day, streak, tier, right }: Props) => (
  <header className="topbar">
    <span className="topbar-left">
      <strong>BLURPRINT</strong> <span className="mono">#{day}</span>
      {tier ? <TierBadge tier={tier} /> : null}
    </span>
    <span className="topbar-right">
      {right ?? (streak ? <span className="streak-chip" aria-label={`${streak}-day streak`}>🔥 {streak}</span> : null)}
      <MuteButton />
    </span>
  </header>
);
