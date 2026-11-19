import { showLoginPrompt } from '@devvit/web/client';
import type { GuessPayload } from '../../shared/types';
import { BlendCanvas } from '../components/BlendCanvas';
import { ChoiceButtons } from '../components/ChoiceButtons';
import { Hint } from '../components/Hint';

type Props = {
  guess: GuessPayload;
  isArchive: boolean;
  loggedIn: boolean;
  showHint: boolean;
  onDismissHint: () => void;
  onPick: (id: string) => void;
  pendingId: string | null;
  error: string | null;
};

export const GuessScreen = ({ guess, isArchive, loggedIn, showHint, onDismissHint, onPick, pendingId, error }: Props) => {
  const { blend, choices } = guess;
  return (
    <>
      <div>
        <h1 className="heading">
          {isArchive ? `On Day ${blend.day}` : 'Yesterday'}, {blend.total} people drew the same thing. What was it?
        </h1>
      </div>
      {showHint ? <Hint text="Squint! This is everyone’s drawing blended together." onDismiss={onDismissHint} /> : null}
      <div className="hero">
        <div className="square">
          <BlendCanvas
            values={blend.values}
            total={blend.total}
            hidden={blend.hidden}
            animateIn
            label={`A blurry blend of ${blend.total} drawings. Guess what it shows.`}
          />
        </div>
      </div>
      {error ? (
        <p className="notice" role="alert">
          {error}
        </p>
      ) : null}
      <ChoiceButtons choices={choices} onPick={onPick} disabled={!loggedIn || pendingId !== null} pendingId={pendingId} />
      {!loggedIn ? (
        <button type="button" className="btn btn-primary btn-block" onClick={() => showLoginPrompt()}>
          Log in to play
        </button>
      ) : (
        <p className="subheading" style={{ textAlign: 'center' }}>
          One guess. No timer. {isArchive ? 'Archive guesses don’t score.' : ''}
        </p>
      )}
    </>
  );
};
