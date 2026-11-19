import type { Choice } from '../../shared/types';

type Props = {
  choices: Choice[];
  onPick?: (id: string) => void;
  disabled?: boolean;
  /** After the guess: which one was right and which one the player picked. */
  answerId?: string | null;
  pickedId?: string | null;
  pendingId?: string | null;
  compact?: boolean;
};

/** Grid of big choice buttons (2 columns for 4, 3 columns for 5–6). Correct/wrong always use an icon + text, never color alone. */
export const ChoiceButtons = ({ choices, onPick, disabled, answerId, pickedId, pendingId, compact }: Props) => {
  const revealed = answerId !== undefined && answerId !== null;
  return (
    <div className={`choices n-${choices.length}${compact ? ' is-compact' : ''}`} role="group" aria-label="Choices">
      {choices.map((c) => {
        const isAnswer = revealed && c.id === answerId;
        const isWrongPick = revealed && c.id === pickedId && c.id !== answerId;
        const state = isAnswer ? 'is-answer' : isWrongPick ? 'is-wrong' : revealed ? 'is-dim' : '';
        return (
          <button
            key={c.id}
            type="button"
            className={`choice ${state}${pendingId === c.id ? ' is-pending' : ''}`}
            disabled={disabled || revealed}
            onClick={() => onPick?.(c.id)}
            aria-pressed={pickedId === c.id}
          >
            {isAnswer ? <span aria-hidden="true">✓</span> : null}
            {isWrongPick ? <span aria-hidden="true">✗</span> : null}
            <span className="choice-word">{c.word}</span>
            {isAnswer ? <span className="visually-hidden">(the answer)</span> : null}
            {isWrongPick ? <span className="visually-hidden">(your pick, wrong)</span> : null}
          </button>
        );
      })}
    </div>
  );
};
