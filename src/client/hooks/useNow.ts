import { useEffect, useState } from 'react';

/** Re-renders every `ms` (for countdown clocks). */
export const useNow = (ms = 30_000): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
};

export const formatCountdown = (msLeft: number): string => {
  const m = Math.max(0, Math.floor(msLeft / 60_000));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
