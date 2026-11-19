import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { displayValues } from '../../shared/blend';
import { BLEND_BLUR_PX, GRID_SIZE, MIN_BLEND_DRAWINGS } from '../../shared/config';
import { useReducedMotion } from '../hooks/useReducedMotion';
import './blend.css';

type Props = {
  values: number[] | null;
  total: number;
  hidden?: boolean;
  /** Hard cells, no blur (reveal "Sharpen" toggle). */
  sharp?: boolean;
  /** Cells to flash cyan for ~1.5 s (the player's own drawing). */
  highlight?: number[] | undefined;
  /** Animate the blur from heavy → normal on mount (600 ms). */
  animateIn?: boolean;
  /** Accessible description of what the image shows. */
  label: string;
};

type Rgb = [number, number, number];
const BG: Rgb = [11, 61, 145];
const CYAN: Rgb = [127, 219, 255];
const WHITE: Rgb = [255, 255, 255];

/** Blueprint ramp: background blue → cyan → white. */
const rampColor = (t: number): Rgb => {
  const [a, b, u]: [Rgb, Rgb, number] = t < 0.7 ? [BG, CYAN, t / 0.7] : [CYAN, WHITE, (t - 0.7) / 0.3];
  const mix = (i: 0 | 1 | 2) => Math.round(a[i] + (b[i] - a[i]) * u);
  return [mix(0), mix(1), mix(2)];
};

/**
 * The hero of every screen: the crowd's averaged drawing. 10×10 values are
 * painted on a tiny offscreen canvas, scaled up with smoothing on, then
 * softened with a CSS blur for the signature "blurprint" look.
 */
export const BlendCanvas = ({ values, total, hidden = false, sharp = false, highlight, animateIn = false, label }: Props) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const [enteredState, setEntered] = useState(false);
  const [flashDoneFor, setFlashDoneFor] = useState<number[] | null>(null);
  const reduced = useReducedMotion();
  const entered = enteredState || !animateIn || reduced;
  const flashing = Boolean(highlight?.length) && flashDoneFor !== highlight;

  // Track the rendered size so the backing store matches device pixels.
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => setSize(Math.round(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!animateIn || reduced) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [animateIn, reduced]);

  useEffect(() => {
    if (!highlight?.length) return;
    const id = setTimeout(() => setFlashDoneFor(highlight), reduced ? 1500 : 2100);
    return () => clearTimeout(id);
  }, [highlight, reduced]);

  // Paint the blend.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !values || size === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const px = Math.round(size * dpr);
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const d = displayValues(values);
    const S = GRID_SIZE;
    // One cell of background padding on each side so edges fade into the paper.
    const off = document.createElement('canvas');
    off.width = S + 2;
    off.height = S + 2;
    const octx = off.getContext('2d');
    if (!octx) return;
    const img = octx.createImageData(S + 2, S + 2);
    for (let y = 0; y < S + 2; y++)
      for (let x = 0; x < S + 2; x++) {
        const inside = x > 0 && y > 0 && x <= S && y <= S;
        const [r, g, b] = inside ? rampColor(d[(y - 1) * S + (x - 1)] ?? 0) : BG;
        const o = (y * (S + 2) + x) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    octx.putImageData(img, 0, 0);

    ctx.fillStyle = `rgb(${BG.join(',')})`;
    ctx.fillRect(0, 0, px, px);
    ctx.imageSmoothingEnabled = !sharp;
    ctx.imageSmoothingQuality = 'high';
    const cell = px / S;
    // Map the padded image so the inner S×S cells cover the canvas exactly.
    ctx.drawImage(off, -cell, -cell, px + 2 * cell, px + 2 * cell);
  }, [values, size, sharp]);

  // Paint the player's own cells (flash overlay).
  useEffect(() => {
    const canvas = flashRef.current;
    if (!canvas || !highlight?.length || size === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const px = Math.round(size * dpr);
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, px, px);
    const cell = px / GRID_SIZE;
    ctx.fillStyle = 'rgba(127, 219, 255, 0.55)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = Math.max(1, dpr);
    for (const i of highlight) {
      const x = (i % GRID_SIZE) * cell;
      const y = Math.floor(i / GRID_SIZE) * cell;
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
    }
  }, [highlight, size]);

  const blur = sharp ? 0 : (BLEND_BLUR_PX * size) / 300;
  const filter = `blur(${(entered ? blur : blur * 3.5).toFixed(1)}px)`;

  return (
    <div ref={frameRef} className={`blend-frame${sharp ? ' is-sharp' : ''}`} role="img" aria-label={label}>
      {values ? (
        <canvas ref={canvasRef} className="blend-canvas" style={{ filter }} />
      ) : (
        <div className="blend-placeholder">
          <div className="blend-placeholder-cells" aria-hidden="true">
            {Array.from({ length: 16 }, (_, i) => (
              <span key={i} style={{ animationDelay: `${(i * 137) % 1600}ms` }} />
            ))}
          </div>
          <p className="blend-placeholder-text">
            {hidden
              ? 'This blend was hidden by the moderators.'
              : total === 0
                ? 'No drawings yet — be the first!'
                : `The blend appears at ${MIN_BLEND_DRAWINGS} drawings · ${total} so far`}
          </p>
        </div>
      )}
      {values && highlight?.length ? (
        <canvas ref={flashRef} className={`blend-flash${flashing ? ' is-on' : ''}${reduced ? ' is-static' : ''}`} aria-hidden="true" />
      ) : null}
      <span className="blend-corner tl" aria-hidden="true" />
      <span className="blend-corner tr" aria-hidden="true" />
      <span className="blend-corner bl" aria-hidden="true" />
      <span className="blend-corner br" aria-hidden="true" />
    </div>
  );
};
