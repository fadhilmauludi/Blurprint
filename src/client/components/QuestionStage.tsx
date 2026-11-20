import { useEffect, useMemo, useRef } from 'react';
import { tileOrder, tilesOpen, zoomAt, zoomFocus, type QuestionFormat } from '../../shared/formats';
import type { BlendPayload, Choice } from '../../shared/types';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { BlendCanvas } from './BlendCanvas';

type Clock = { seconds: number; remainingMs: number; frozen: boolean };

type Props = Clock & {
  format: QuestionFormat;
  seed: number;
  blend: BlendPayload;
  startBlur: number;
  startZoom: number;
  label: string;
  /** 'pick' only. */
  options?: { id: string; blend: BlendPayload }[] | undefined;
  optionChoices?: Choice[] | undefined;
  onPick?: ((id: string) => void) | undefined;
  answerId?: string | null | undefined;
  pickedId?: string | null | undefined;
  pendingId?: string | null | undefined;
};

const TILE_SIDE = 4;

/**
 * Runs `apply(elapsedMs)` every frame while the clock runs (no React
 * re-renders). With reduced motion, steps once per second.
 */
const useClockFrames = ({ seconds, remainingMs, frozen }: Clock, apply: (elapsed: number) => void) => {
  const reduced = useReducedMotion();
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  }, [apply]);
  useEffect(() => {
    const atMount = seconds * 1000 - remainingMs;
    const t0 = performance.now();
    const step = (e: number) => applyRef.current(reduced ? Math.floor(e / 1000) * 1000 : e);
    step(atMount);
    if (frozen) return;
    let raf = 0;
    const frame = (t: number) => {
      const e = atMount + (t - t0);
      step(e);
      if (e < seconds * 1000) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [seconds, remainingMs, frozen, reduced]);
};

const ZoomStage = (p: Props) => {
  const inner = useRef<HTMLDivElement>(null);
  const focus = useMemo(() => zoomFocus(p.seed), [p.seed]);
  useClockFrames(p, (e) => {
    if (inner.current) inner.current.style.transform = `scale(${zoomAt(e, p.seconds, p.startZoom).toFixed(3)})`;
  });
  return (
    <div className="stage-clip">
      <div
        ref={inner}
        className="stage-zoom"
        style={{ transformOrigin: `${(focus.x * 100).toFixed(1)}% ${(focus.y * 100).toFixed(1)}%`, transform: `scale(${p.startZoom})` }}
      >
        <BlendCanvas values={p.blend.values} total={p.blend.total} hidden={p.blend.hidden} label={p.label} />
      </div>
    </div>
  );
};

const TilesStage = (p: Props) => {
  const tiles = useRef<(HTMLSpanElement | null)[]>([]);
  const order = useMemo(() => tileOrder(p.seed, TILE_SIDE * TILE_SIDE), [p.seed]);
  useClockFrames(p, (e) => {
    const open = tilesOpen(e, p.seconds, order.length);
    order.forEach((tile, rank) => tiles.current[tile]?.classList.toggle('is-open', rank < open));
  });
  return (
    <div className="stage-clip">
      <BlendCanvas values={p.blend.values} total={p.blend.total} hidden={p.blend.hidden} label={p.label} />
      <div className="stage-tiles" aria-hidden="true">
        {order.map((_, i) => (
          <span
            key={i}
            ref={(el) => {
              tiles.current[i] = el;
            }}
            className="stage-tile"
          />
        ))}
      </div>
    </div>
  );
};

const PickStage = (p: Props) => {
  const revealed = p.answerId !== undefined && p.answerId !== null;
  return (
    <div className="stage-pick" role="group" aria-label="Pick the blend">
      {(p.options ?? []).map((o, i) => {
        const label = p.optionChoices?.[i]?.word ?? `Blend ${i + 1}`;
        const isAnswer = revealed && o.id === p.answerId;
        const isWrong = revealed && o.id === p.pickedId && o.id !== p.answerId;
        return (
          <button
            key={o.id}
            type="button"
            className={`pick-option${isAnswer ? ' is-answer' : ''}${isWrong ? ' is-wrong' : ''}${p.pendingId === o.id ? ' is-pending' : ''}`}
            disabled={revealed || p.pendingId !== null}
            onClick={() => p.onPick?.(o.id)}
            aria-label={`${label}${isAnswer ? ' (the answer)' : ''}${isWrong ? ' (your pick, wrong)' : ''}`}
          >
            <BlendCanvas values={o.blend.values} total={o.blend.total} sharp={revealed} label={label} />
            <span className="pick-tag mono" aria-hidden="true">
              {isAnswer ? '✓' : isWrong ? '✗' : 'ABCD'[i]}
            </span>
          </button>
        );
      })}
    </div>
  );
};

/** The guess "stage": the same blend revealed in different ways (D-25). */
export const QuestionStage = (p: Props) => {
  if (p.format === 'pick') return <PickStage {...p} />;
  if (p.format === 'zoom') return <ZoomStage {...p} />;
  if (p.format === 'tiles') return <TilesStage {...p} />;
  return (
    <BlendCanvas
      values={p.blend.values}
      total={p.blend.total}
      hidden={p.blend.hidden}
      focusPull={{ seconds: p.seconds, startBlur: p.startBlur, remainingMs: p.remainingMs, frozen: p.frozen }}
      label={p.label}
    />
  );
};
