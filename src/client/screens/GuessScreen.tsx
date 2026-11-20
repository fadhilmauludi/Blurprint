import { showLoginPrompt } from '@devvit/web/client';
import { POINTS } from '../../shared/config';
import { FORMAT_INFO } from '../../shared/formats';
import type { GuessPayload } from '../../shared/types';
import { BlendCanvas } from '../components/BlendCanvas';
import { ChoiceButtons } from '../components/ChoiceButtons';
import { Hint } from '../components/Hint';
import { QuestionStage } from '../components/QuestionStage';
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
  const { blend, choices, tier, started, format, formatSeed } = guess;
  const info = FORMAT_INFO[format];
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
            <span className="format-chip">
              <span aria-hidden="true">{info.icon}</span> {info.name}
            </span>{' '}
            {tier.choices} choices · {tier.guessSeconds} s · up to {maxPoints} pts
          </p>
        </div>
        {showHint ? <Hint text={`${info.rule} Guess early for more points!`} onDismiss={onDismissHint} /> : null}
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
      <h1 className="heading heading-compact">
        What did {blend.total} people draw?{' '}
        <span className="format-chip">
          <span aria-hidden="true">{info.icon}</span> {info.name}
        </span>
      </h1>
      <TimerBar
        seconds={tier.guessSeconds}
        remainingMs={guess.remainingMs ?? tier.guessSeconds * 1000}
        running={pendingId === null}
        onEnd={onTimeout}
        warnAt={Math.min(5, Math.ceil(tier.guessSeconds / 3))}
      />
      <div className="hero">
        <div className="square">
          <QuestionStage
            format={format}
            seed={formatSeed}
            blend={blend}
            seconds={tier.guessSeconds}
            remainingMs={guess.remainingMs ?? tier.guessSeconds * 1000}
            frozen={pendingId !== null}
            startBlur={tier.startBlur}
            startZoom={tier.startZoom}
            label={`A blend of ${blend.total} drawings (${info.name.toLowerCase()}). Guess what it shows.`}
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
