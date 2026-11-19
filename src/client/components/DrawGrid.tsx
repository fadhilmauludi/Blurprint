import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
} from 'react';
import { GRID_SIZE, MAX_CELLS } from '../../shared/config';
import './draw.css';

export type Tool = 'pen' | 'eraser';

export type DrawGridHandle = {
  getCells: () => number[];
  undo: () => void;
  clear: () => void;
};

type Props = {
  ref?: Ref<DrawGridHandle>;
  tool: Tool;
  disabled: boolean;
  /** Called once per finished stroke (not per pointer move). */
  onChange: (count: number, canUndo: boolean) => void;
  /** Called when a tap is ignored because MAX_CELLS was reached. */
  onLimit?: () => void;
};

const S = GRID_SIZE;

/** All cells on the segment between two cells (Bresenham), so fast drags never skip. */
const line = (x0: number, y0: number, x1: number, y1: number): [number, number][] => {
  const out: [number, number][] = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    out.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
};

/**
 * Drag-to-paint grid. All drawing state lives in refs and is painted straight
 * onto the canvas; React only hears about it at stroke end (spec §9 perf).
 */
export const DrawGrid = ({ ref, tool, disabled, onChange, onLimit }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cells = useRef<boolean[]>(new Array<boolean>(S * S).fill(false));
  const history = useRef<boolean[][]>([]);
  const last = useRef<[number, number] | null>(null);
  const drawing = useRef(false);
  const hitLimit = useRef(false);
  const toolRef = useRef(tool);
  const [size, setSize] = useState(0);
  const [cursor, setCursor] = useState<[number, number] | null>(null);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  const count = () => cells.current.reduce((n, v) => n + (v ? 1 : 0), 0);

  const paintAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || size === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const px = Math.round(size * dpr);
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cell = px / S;
    ctx.fillStyle = '#072a66';
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = '#ffffff';
    const inset = Math.max(1, cell * 0.06);
    cells.current.forEach((on, i) => {
      if (!on) return;
      ctx.fillRect((i % S) * cell + inset, Math.floor(i / S) * cell + inset, cell - 2 * inset, cell - 2 * inset);
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = Math.max(1, dpr * 0.75);
    ctx.beginPath();
    for (let k = 1; k < S; k++) {
      const p = Math.round(k * cell) + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, px);
      ctx.moveTo(0, p);
      ctx.lineTo(px, p);
    }
    ctx.stroke();
  }, [size]);

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => setSize(Math.round(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => paintAll(), [paintAll]);

  const notify = () => onChange(count(), history.current.length > 0);

  const setCell = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= S || y >= S) return false;
    const i = y * S + x;
    const want = toolRef.current === 'pen';
    if (cells.current[i] === want) return false;
    if (want && count() >= MAX_CELLS) {
      hitLimit.current = true;
      return false;
    }
    cells.current[i] = want;
    return true;
  };

  const cellAt = (e: { clientX: number; clientY: number }): [number, number] | null => {
    const el = canvasRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * S);
    const y = Math.floor(((e.clientY - r.top) / r.height) * S);
    return [Math.min(S - 1, Math.max(0, x)), Math.min(S - 1, Math.max(0, y))];
  };

  const beginStroke = () => {
    history.current.push(cells.current.slice());
    if (history.current.length > 50) history.current.shift();
    hitLimit.current = false;
  };
  const endStroke = () => {
    const prev = history.current[history.current.length - 1];
    // Drop no-op strokes from history.
    if (prev && prev.every((v, i) => v === cells.current[i])) history.current.pop();
    if (hitLimit.current) onLimit?.();
    notify();
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const c = cellAt(e);
    if (!c) return;
    drawing.current = true;
    beginStroke();
    last.current = c;
    if (setCell(c[0], c[1])) paintAll();
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const c = cellAt(e);
    if (!c || !last.current) return;
    if (c[0] === last.current[0] && c[1] === last.current[1]) return;
    let changed = false;
    for (const [x, y] of line(last.current[0], last.current[1], c[0], c[1])) changed = setCell(x, y) || changed;
    last.current = c;
    if (changed) paintAll();
  };

  const onPointerUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    endStroke();
  };

  // Disabled mid-stroke (timer ran out): finish the stroke cleanly.
  useEffect(() => {
    if (disabled && drawing.current) onPointerUp();
  });

  // Keyboard drawing: arrows move, Space/Enter paints with the current tool.
  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const [cx, cy] = cursor ?? [Math.floor(S / 2), Math.floor(S / 2)];
    const moves: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      setCursor([Math.min(S - 1, Math.max(0, cx + m[0])), Math.min(S - 1, Math.max(0, cy + m[1]))]);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      beginStroke();
      if (setCell(cx, cy)) paintAll();
      setCursor([cx, cy]);
      endStroke();
    }
  };

  useImperativeHandle(ref, () => ({
    getCells: () => cells.current.flatMap((on, i) => (on ? [i] : [])),
    undo: () => {
      const prev = history.current.pop();
      if (!prev) return;
      cells.current = prev;
      paintAll();
      notify();
    },
    clear: () => {
      if (count() === 0) return;
      history.current.push(cells.current.slice());
      cells.current = new Array<boolean>(S * S).fill(false);
      paintAll();
      notify();
    },
  }));

  return (
    <div className="draw-wrap">
      <canvas
        ref={canvasRef}
        className={`draw-canvas${disabled ? ' is-disabled' : ''}`}
        tabIndex={disabled ? -1 : 0}
        aria-label={`Drawing grid, ${S} by ${S}. Drag to fill squares, or use arrow keys and Space.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
        onKeyDown={onKeyDown}
        onFocus={() => setCursor((c) => c ?? [Math.floor(S / 2), Math.floor(S / 2)])}
        onBlur={() => setCursor(null)}
      />
      {cursor && !disabled ? (
        <span
          className="draw-cursor"
          aria-hidden="true"
          style={{ left: `${(cursor[0] / S) * 100}%`, top: `${(cursor[1] / S) * 100}%`, width: `${100 / S}%`, height: `${100 / S}%` }}
        />
      ) : null}
    </div>
  );
};
