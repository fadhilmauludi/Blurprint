import { useEffect, useRef, useState } from 'react';
import { TIMER_WARN_SECONDS } from '../../shared/config';

type Props = {
  seconds: number;
  running: boolean;
  onEnd: () => void;
};

/**
 * Bar across the top that empties over `seconds`. Width is updated on
 * requestAnimationFrame via a ref (no re-render per frame); the number label
 * re-renders once per second. Turns amber at TIMER_WARN_SECONDS.
 */
export const TimerBar = ({ seconds, running, onEnd }: Props) => {
  const fill = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(seconds);
  const endRef = useRef(onEnd);
  useEffect(() => {
    endRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    let raf = 0;
    let lastShown = seconds;
    let warned = false;
    const tick = (t: number) => {
      const elapsed = (t - start) / 1000;
      const remaining = Math.max(0, seconds - elapsed);
      if (fill.current) fill.current.style.transform = `scaleX(${remaining / seconds})`;
      const shown = Math.ceil(remaining);
      if (shown !== lastShown) {
        lastShown = shown;
        setLeft(shown);
        if (shown <= TIMER_WARN_SECONDS && !warned) {
          warned = true;
          if ('vibrate' in navigator) navigator.vibrate?.(15);
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
  }, [running, seconds]);

  const warn = left <= TIMER_WARN_SECONDS;
  return (
    <div className={`timer${warn ? ' is-warn' : ''}`} role="timer" aria-live="off">
      <div className="timer-track">
        <div ref={fill} className="timer-fill" />
      </div>
      <span className="timer-label mono" aria-label={`${left} seconds left`}>
        {left}s
      </span>
    </div>
  );
};
