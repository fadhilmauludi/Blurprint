import { useEffect, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** Animates a number from 0 to `target` (ease-out). Reduced motion → the target at once. */
export const useCountUp = (target: number, ms = 700): number => {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduced || target <= 0) return;
    let raf = 0;
    const t0 = performance.now();
    const frame = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setValue(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduced]);
  return reduced || target <= 0 ? target : value;
};
