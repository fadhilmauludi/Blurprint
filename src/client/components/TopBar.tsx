import type { ReactNode } from 'react';

type Props = { day: number; streak?: number | null; right?: ReactNode };

export const TopBar = ({ day, streak, right }: Props) => (
  <header className="topbar">
    <span>
      <strong>BLURPRINT</strong> <span className="mono">#{day}</span>
    </span>
    {right ?? (streak ? <span className="streak-chip" aria-label={`${streak}-day streak`}>🔥 {streak}</span> : <span />)}
  </header>
);
