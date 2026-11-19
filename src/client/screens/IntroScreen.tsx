import type { RevealPayload } from '../../shared/types';
import { BlendCanvas } from '../components/BlendCanvas';

type Props = { reveal: RevealPayload | null; onNext: () => void; nextLabel: string };

/** Shown when there's no yesterday blend to guess (day 1, too few drawings, or hidden). */
export const IntroScreen = ({ reveal, onNext, nextLabel }: Props) => (
  <>
    <div>
      <h1 className="heading">No blend yet — you’re one of the first artists.</h1>
      <p className="subheading">Everyone draws the same secret word. Tomorrow, you guess what the crowd drew.</p>
    </div>
    <div className="hero">
      <div className="square">
        <BlendCanvas values={null} total={0} label="No blend yet." />
      </div>
    </div>
    {reveal?.answerWord ? (
      <p className="notice">
        Yesterday’s word was <strong className="answer-word">{reveal.answerWord}</strong>
        {reveal.syncPct !== null ? ` · your sync: ${reveal.syncPct}%` : ''}
      </p>
    ) : null}
    {reveal && reveal.syncPct !== null && !reveal.answerWord ? (
      <p className="notice">Your drawing yesterday was {reveal.syncPct}% in sync with the crowd.</p>
    ) : null}
    <button type="button" className="btn btn-primary btn-block" onClick={onNext}>
      {nextLabel}
    </button>
  </>
);
