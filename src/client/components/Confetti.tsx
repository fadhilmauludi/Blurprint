import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Props = { /** Fires a burst whenever this key changes (and is not null). */ burstKey: string | number | null; pieces?: number };

const COLORS = ['#7fdbff', '#ffffff', '#ffc94d', '#6bffb0'];

/** A short burst of blueprint-coloured squares. Pure canvas, no assets; off for reduced motion. */
export const Confetti = ({ burstKey, pieces = 70 }: Props) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const canvas = ref.current;
    if (burstKey === null || reduced || !canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const ox = innerWidth / 2;
    const oy = innerHeight * 0.32;
    const parts = Array.from({ length: pieces }, () => {
      const a = Math.random() * Math.PI * 2;
      const v = 4 + Math.random() * 7;
      return {
        x: ox,
        y: oy,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 5,
        s: 4 + Math.random() * 5,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        c: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      };
    });
    const t0 = performance.now();
    let raf = 0;
    const frame = (t: number) => {
      const life = (t - t0) / 1400;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      if (life >= 1) return;
      ctx.globalAlpha = 1 - life * life;
      for (const p of parts) {
        p.vy += 0.32;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [burstKey, pieces, reduced]);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
};
