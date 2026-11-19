import { useEffect, useRef, useState } from 'react';
import { TIMER_WARN_SECONDS } from '../../shared/config';
import { sfx } from '../audio';

type Props = {
  /** Full length of the clock (the bar's 100 %). */
  seconds: number;
  /** Time left when `running` turns on (resume after reload). Defaults to the full clock. */
  remainingMs?: number;
  running: boolean;
  onEnd: () => void;
  /** Seconds at which the bar turns amber and starts ticking. */
  warnAt?: number;
};

/**
 * Bar across the top that empties over `seconds`. Width is updated on
 * requestAnimationFrame via a ref (no re-render per frame); the number label
 * re-renders once per second. Turns amber (and ticks) at `warnAt`.
 */
export const TimerBar = ({ seconds, remainingMs, running, onEnd, warnAt = TIMER_WARN_SECONDS }: Props) => {
  const fill = useRef<HTMLDivElement>(null);
  const startLeft = Math.min(seconds * 1000, remainingMs ?? seconds * 1000) / 1000;
  const [left, setLeft] = useState(Math.ceil(startLeft));
  const endRef = useRef(onEnd);
  useEffect(() => {
    endRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    let raf = 0;
    let lastShown = -1;
    let warned = false;
    const tick = (t: number) => {
      const remaining = Math.max(0, startLeft - (t - start) / 1000);
      if (fill.current) fill.current.style.transform = `scaleX(${remaining / seconds})`;
      const shown = Math.ceil(remaining);
      if (shown !== lastShown) {
        lastShown = shown;
        setLeft(shown);
        if (shown <= warnAt && shown > 0) {
          sfx.play(shown <= 2 ? 'warn' : 'tick');
          if (!warned) {
            warned = true;
            if ('vibrate' in navigator) navigator.vibrate?.(15);
          }
        }
      }
      if (remaining <= 0) {
        endRef.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, seconds, startLeft, warnAt]);

  const warn = left <= warnAt;
  return (
    <div className={`timer${warn ? ' is-warn' : ''}`} role="timer" aria-live="off">
      <div className="timer-track">
        <div ref={fill} className="timer-fill" style={{ transform: `scaleX(${startLeft / seconds})` }} />
      </div>
      <span className="timer-label mono" aria-label={`${left} seconds left`}>
        {left}s
      </span>
    </div>
  );
};
