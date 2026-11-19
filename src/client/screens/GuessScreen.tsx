import { showLoginPrompt } from '@devvit/web/client';
import { POINTS } from '../../shared/config';
import type { GuessPayload } from '../../shared/types';
import { BlendCanvas } from '../components/BlendCanvas';
import { ChoiceButtons } from '../components/ChoiceButtons';
import { Hint } from '../components/Hint';
import { TimerBar } from '../components/TimerBar';

type Props = {
  guess: GuessPayload;
  isArchive: boolean;
  loggedIn: boolean;
  showHint: boolean;
  onDismissHint: () => void;
  /** Start the guess clock (server records the start time). */
  onStart: () => void;
  starting: boolean;
  onPick: (id: string) => void;
  /** The clock ran out. */
  onTimeout: () => void;
  pendingId: string | null;
  error: string | null;
};

/** Pre-start: a coarse teaser + the rules for today's tier. Started: the timed focus pull. */
export const GuessScreen = ({
  guess,
  isArchive,
  loggedIn,
  showHint,
  onDismissHint,
  onStart,
  starting,
  onPick,
  onTimeout,
  pendingId,
  error,
}: Props) => {
  const { blend, choices, tier, started } = guess;
  const when = !isArchive ? 'Yesterday' : blend.day <= 0 ? 'Before launch' : `On Day ${blend.day}`;
  const maxPoints = Math.round(POINTS.correctGuess * tier.multiplier);

  const errorBox = error ? (
    <p className="notice" role="alert">
      {error}
    </p>
  ) : null;

  if (!started || !choices) {
    return (
      <>
        <div>
          <h1 className="heading">
            {when}, {blend.total} people drew the same thing. What was it?
          </h1>
          <p className="subheading tier-rules">
            {tier.choices} choices · {tier.guessSeconds} s clock · up to {maxPoints} pts
          </p>
        </div>
        {showHint ? <Hint text="The blur sharpens while the clock runs. Guess early for more points!" onDismiss={onDismissHint} /> : null}
        <div className="hero">
          <div className="square">
            <BlendCanvas
              values={blend.values}
              total={blend.total}
              hidden={blend.hidden}
              blurScale={1.8}
              animateIn
              label="A very blurry preview of the crowd’s blend. Start the clock to see it properly."
            />
            <span className="teaser-tag mono" aria-hidden="true">
              PREVIEW
            </span>
          </div>
        </div>
        {errorBox}
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={starting}
          onClick={loggedIn ? onStart : () => showLoginPrompt()}
        >
          {!loggedIn ? 'Log in to play' : starting ? 'Starting…' : `Start the clock · ${tier.guessSeconds} s`}
        </button>
        <p className="subheading" style={{ textAlign: 'center' }}>
          One guess. {isArchive ? 'Archive guesses don’t score.' : 'Fastest right answer wins the most.'}
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="heading heading-compact">What did {blend.total} people draw?</h1>
      <TimerBar
        seconds={tier.guessSeconds}
        remainingMs={guess.remainingMs ?? tier.guessSeconds * 1000}
        running={pendingId === null}
        onEnd={onTimeout}
        warnAt={Math.min(5, Math.ceil(tier.guessSeconds / 3))}
      />
      <div className="hero">
        <div className="square">
          <BlendCanvas
            values={blend.values}
            total={blend.total}
            hidden={blend.hidden}
            focusPull={{
              seconds: tier.guessSeconds,
              startBlur: tier.startBlur,
              remainingMs: guess.remainingMs ?? tier.guessSeconds * 1000,
              frozen: pendingId !== null,
            }}
            label={`A blurry blend of ${blend.total} drawings, slowly sharpening. Guess what it shows.`}
          />
        </div>
      </div>
      {errorBox}
      <ChoiceButtons
        choices={choices}
        onPick={onPick}
        disabled={pendingId !== null}
        pendingId={pendingId}
        compact={choices.length > 4}
      />
    </>
  );
};
