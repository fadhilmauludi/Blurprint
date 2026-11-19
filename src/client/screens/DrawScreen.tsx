import { useCallback, useEffect, useRef, useState } from 'react';
import { COUNTDOWN_SECONDS, MAX_CELLS, MIN_CELLS } from '../../shared/config';
import type { DrawPayload } from '../../shared/types';
import { DrawGrid, type DrawGridHandle, type Tool } from '../components/DrawGrid';
import { Hint } from '../components/Hint';
import { TimerBar } from '../components/TimerBar';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { sfx } from '../audio';

type Props = {
  draw: DrawPayload;
  showHint: boolean;
  onDismissHint: () => void;
  onStart: () => void;
  onSubmit: (cells: number[], timedOut: boolean) => void;
  submitting: boolean;
  error: string | null;
};

type Stage = 'countdown' | 'drawing' | 'done';

export const DrawScreen = ({ draw, showHint, onDismissHint, onStart, onSubmit, submitting, error }: Props) => {
  const grid = useRef<DrawGridHandle>(null);
  const [stage, setStage] = useState<Stage>('countdown');
  const [count, setCount] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [tool, setTool] = useState<Tool>('pen');
  const [tick, setTick] = useState(COUNTDOWN_SECONDS);
  const [limitNote, setLimitNote] = useState(false);
  const lastCells = useRef<number[]>([]);
  const reduced = useReducedMotion();

  // 3-2-1 countdown, then the timer starts.
  useEffect(() => {
    if (stage !== 'countdown') return;
    sfx.play('tick');
    const id = setTimeout(() => {
      if (tick <= 1) {
        sfx.play('go');
        setStage('drawing');
        onStart();
      } else setTick(tick - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [stage, tick, onStart]);

  const finish = useCallback(
    (timedOut: boolean) => {
      if (stage === 'done') return;
      setStage('done');
      const cells = grid.current?.getCells() ?? [];
      lastCells.current = cells;
      onSubmit(cells, timedOut);
    },
    [onSubmit, stage]
  );

  const onTimerEnd = useCallback(() => finish(true), [finish]);
  const drawingOpen = stage === 'drawing';

  return (
    <>
      <div className="draw-head">
        <h1 className="heading draw-prompt">
          Draw: <span className="prompt-word">{draw.promptWord}</span>
        </h1>
        <p className="subheading">Anywhere, any size — we line everyone up.</p>
      </div>
      <TimerBar seconds={draw.seconds} running={drawingOpen} onEnd={onTimerEnd} />
      {showHint ? <Hint text="Fill squares by tapping or dragging." onDismiss={onDismissHint} /> : null}
      <div className="hero">
        <div className="square">
          <DrawGrid
            ref={grid}
            tool={tool}
            disabled={!drawingOpen}
            onChange={(n, u) => {
              if (n !== count) sfx.play('paint');
              setCount(n);
              setCanUndo(u);
              if (n < MAX_CELLS) setLimitNote(false);
            }}
            onLimit={() => setLimitNote(true)}
          />
          {stage === 'countdown' ? (
            <div className="countdown" aria-live="assertive">
              <span key={tick} className={`countdown-num mono${reduced ? '' : ' pop'}`}>
                {tick}
              </span>
              <span className="countdown-sub">Get ready to draw {draw.promptWord}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="tools" role="toolbar" aria-label="Drawing tools">
        <div className="tabs tool-toggle" role="radiogroup" aria-label="Tool">
          <button type="button" className="tab" role="radio" aria-checked={tool === 'pen'} aria-selected={tool === 'pen'} onClick={() => setTool('pen')}>
            ✎ Pen
          </button>
          <button
            type="button"
            className="tab"
            role="radio"
            aria-checked={tool === 'eraser'}
            aria-selected={tool === 'eraser'}
            onClick={() => setTool('eraser')}
          >
            ⌫ Eraser
          </button>
        </div>
        <button type="button" className="btn btn-small btn-ghost" disabled={!drawingOpen || !canUndo} onClick={() => grid.current?.undo()}>
          ↶ Undo
        </button>
        <button type="button" className="btn btn-small btn-ghost" disabled={!drawingOpen || count === 0} onClick={() => grid.current?.clear()}>
          Clear
        </button>
      </div>
      {error ? (
        <div className="notice" role="alert">
          <span style={{ flex: 1 }}>{error}</span>
          <button type="button" className="btn btn-small" disabled={submitting} onClick={() => onSubmit(lastCells.current, lastCells.current.length < MIN_CELLS)}>
            Retry
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!drawingOpen || count < MIN_CELLS || submitting}
        onClick={() => finish(false)}
      >
        {submitting
          ? 'Sending…'
          : stage === 'countdown'
            ? 'Get ready…'
            : count < MIN_CELLS
              ? 'Draw a bit more!'
              : limitNote
                ? `That’s the max (${MAX_CELLS}) — Submit`
                : `Submit · ${count} squares`}
      </button>
    </>
  );
};
