import { useState } from 'react';
import type { RevealPayload } from '../../shared/types';
import { BlendCanvas } from '../components/BlendCanvas';
import { ChoiceButtons } from '../components/ChoiceButtons';

type Props = {
  reveal: RevealPayload;
  nextLabel: string;
  onNext: () => void;
};

export const RevealScreen = ({ reveal, nextLabel, onNext }: Props) => {
  const [sharp, setSharp] = useState(false);
  const { correct, answerWord, pctCorrect, blend, choices, syncPct, syncBonus, pointsEarned } = reveal;
  return (
    <>
      <div
        className={`banner ${correct ? 'is-correct' : 'is-wrong'} fade-in`}
        role="status"
      >
        <span className="banner-icon" aria-hidden="true">
          {correct ? '✓' : '✗'}
        </span>
        <span>
          {correct ? 'Nailed it! The crowd drew ' : 'Not quite — the crowd drew '}
          <strong className="answer-word">{answerWord}</strong>
        </span>
        {pointsEarned > 0 ? <span className="points mono">+{pointsEarned}</span> : null}
      </div>
      <div className="hero">
        <div className="square">
          {blend ? (
            <BlendCanvas values={blend.values} total={blend.total} sharp={sharp} label={`The blend of ${blend.total} drawings of ${answerWord ?? 'the prompt'}.`} />
          ) : null}
          <button
            type="button"
            className="btn btn-small sharpen-toggle"
            aria-pressed={sharp}
            onClick={() => setSharp((s) => !s)}
          >
            {sharp ? 'Blur it' : 'Sharpen'}
          </button>
        </div>
      </div>
      {choices ? <ChoiceButtons choices={choices} answerId={reveal.answerId} pickedId={reveal.pickedId} compact /> : null}
      {pctCorrect !== null ? (
        <div className="pct" aria-label={`${pctCorrect}% guessed right`}>
          <div className="pct-track">
            <div className="pct-fill" style={{ width: `${pctCorrect}%` }} />
          </div>
          <span className="mono">{pctCorrect}% guessed right</span>
        </div>
      ) : null}
      {syncPct !== null ? (
        <p className="sync fade-in">
          Your drawing yesterday was <strong className="mono">{syncPct}%</strong> in sync with the crowd
          {syncBonus > 0 ? <span className="points mono"> +{syncBonus}</span> : null}
        </p>
      ) : null}
      <button type="button" className="btn btn-primary btn-block" onClick={onNext}>
        {nextLabel}
      </button>
    </>
  );
};
