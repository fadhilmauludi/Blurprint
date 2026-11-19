import './styles/base.css';
import './components/components.css';
import './screens/screens.css';
import './screens/features.css';

import { context, getShareData, showLoginPrompt } from '@devvit/web/client';
import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MIN_CELLS } from '../shared/config';
import { parseDuelShare } from '../shared/duel';
import type { DrawPayload, HintId, InitResponse, ResultPayload, RevealPayload } from '../shared/types';
import { api } from './api';
import { sfx } from './audio';
import { BlendCanvas } from './components/BlendCanvas';
import { TopBar } from './components/TopBar';
import { DrawScreen } from './screens/DrawScreen';
import { DuelScreen } from './screens/DuelScreen';
import { GuessScreen } from './screens/GuessScreen';
import { IntroScreen } from './screens/IntroScreen';
import { ResultScreen } from './screens/ResultScreen';
import { RevealScreen } from './screens/RevealScreen';
import { ArchiveBanner, ErrorScreen, LoadingScreen } from './screens/States';
import { track } from './telemetry';

type Stage = 'loading' | 'error' | 'guess' | 'reveal' | 'intro' | 'draw' | 'result' | 'loggedOut' | 'duel';

/**
 * A duel invite from the share link this view was opened with (validated;
 * untrusted). Share data stays the same for the page's lifetime, so it is
 * cached and cleared once the player leaves the duel — otherwise every reload
 * would bounce them back into it.
 */
let sharedInvite: string | null | undefined;
const sharedDuelId = (): string | null => {
  if (sharedInvite === undefined) {
    try {
      sharedInvite = parseDuelShare(getShareData());
    } catch {
      sharedInvite = null;
    }
  }
  return sharedInvite;
};
const forgetSharedDuel = () => {
  sharedInvite = null;
};

const stageFor = (init: InitResponse): Stage => {
  if (init.phase === 'guess') return 'guess';
  if (init.phase === 'done') return 'result';
  if (!init.user) return 'loggedOut';
  return init.reveal && init.reveal.correct !== null ? 'reveal' : 'intro';
};

export const App = () => {
  const [stage, setStage] = useState<Stage>('loading');
  const [init, setInit] = useState<InitResponse | null>(null);
  const [reveal, setReveal] = useState<RevealPayload | null>(null);
  const [draw, setDraw] = useState<DrawPayload | null>(null);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timedOutNote, setTimedOutNote] = useState(false);
  const [rawCells, setRawCells] = useState<number[] | null>(null);
  const [seenHints, setSeenHints] = useState<HintId[]>([]);
  const [streak, setStreak] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  /** Duel to open (null = hub) and where "Back" returns to. */
  const [duel, setDuel] = useState<{ id: string | null; back: Stage } | null>(null);

  const applyInit = useCallback((r: Awaited<ReturnType<typeof api.init>>) => {
    if (!r.ok) {
      setError(r.error.error);
      setStage('error');
      return;
    }
    const data = r.data;
    setInit(data);
    setReveal(data.reveal ?? null);
    setDraw(data.draw ?? null);
    setResult(data.result ?? null);
    setSeenHints(data.seenHints);
    setStreak(data.user?.streak ?? null);
    setActionError(null);
    const daily = stageFor(data);
    const invite = data.pendingDuelId ?? sharedDuelId();
    if (invite) {
      setDuel({ id: invite, back: daily });
      setStage('duel');
    } else setStage(daily);
  }, []);

  const load = useCallback(async () => {
    setStage('loading');
    applyInit(await api.init());
  }, [applyInit]);

  useEffect(() => {
    void api.init().then((r) => {
      applyInit(r);
      track.appReady();
    });
  }, [applyInit]);

  const dismissHint = (hint: HintId) => {
    setSeenHints((s) => [...s, hint]);
    void api.hint(hint);
  };

  const onStartGuess = async () => {
    if (!init?.guess) return;
    track.ensureStarted(init.postDay, init.isArchive, init.firstTime);
    track.guessStarted(init.postDay, init.guess.tier.level);
    setStarting(true);
    setActionError(null);
    const r = await api.guessStart(init.guess.blend.day);
    setStarting(false);
    if (!r.ok) {
      if (r.error.code === 'ALREADY_DONE' || r.error.code === 'WRONG_PHASE') return void load();
      setActionError(r.error.error);
      return;
    }
    sfx.play('start');
    setInit({ ...init, guess: r.data.guess });
  };

  /** choiceId null = the clock ran out. */
  const onGuess = async (choiceId: string | null) => {
    if (!init?.guess || pendingChoice !== null) return;
    track.ensureStarted(init.postDay, init.isArchive, init.firstTime);
    if (choiceId) sfx.play('tap');
    setPendingChoice(choiceId ?? '');
    setActionError(null);
    const r = await api.guess({ day: init.guess.blend.day, choiceId });
    setPendingChoice(null);
    if (!r.ok) {
      if (r.error.code === 'ALREADY_DONE' || r.error.code === 'WRONG_PHASE') return void load();
      setActionError(r.error.error);
      return;
    }
    track.guessSubmitted(init.guess.blend.day, r.data.reveal.correct === true);
    setReveal(r.data.reveal);
    setDraw(r.data.draw);
    setResult(r.data.result);
    setStage('reveal');
  };

  const goDraw = () => {
    if (!init) return;
    track.ensureStarted(init.postDay, init.isArchive, init.firstTime);
    setActionError(null);
    setStage(draw ? 'draw' : result ? 'result' : 'loading');
    if (!draw && !result) void load();
  };

  const onDrawStart = useCallback(() => {
    if (init) track.drawStarted(init.postDay);
  }, [init]);

  const onDrawSubmit = async (cells: number[], timedOut: boolean) => {
    if (!init) return;
    setSubmitting(true);
    setActionError(null);
    setRawCells(cells);
    const short = cells.length < MIN_CELLS;
    const r = await api.draw({ day: init.postDay, cells: short ? [] : cells, timedOut });
    setSubmitting(false);
    if (!r.ok) {
      if (r.error.code === 'ALREADY_DONE' || r.error.code === 'WRONG_PHASE') return void load();
      setActionError(r.error.error);
      return;
    }
    if (short && timedOut) track.drawTimeout(init.postDay);
    else track.drawSubmitted(init.postDay, cells.length);
    setTimedOutNote(short && timedOut);
    sfx.play(short && timedOut ? 'timeout' : 'submit');
    setResult(r.data.result);
    setStreak(r.data.result.streak);
    setStage('result');
  };

  if (stage === 'loading') return <LoadingScreen />;
  if (stage === 'error' || !init) return <ErrorScreen message={error ?? 'Unknown error.'} onRetry={() => void load()} />;

  const day = init.postDay;
  const loggedIn = init.user !== null;

  const openDuel = (id: string | null) => {
    setDuel({ id, back: stage === 'duel' ? (duel?.back ?? stageFor(init)) : stage });
    setStage('duel');
  };
  const closeDuel = () => {
    forgetSharedDuel();
    if (init.pendingDuelId) void api.duelDismiss();
    const back = duel?.back ?? stageFor(init);
    setDuel(null);
    // The daily state may have moved on while duelling (e.g. a new day): reload it.
    if (init.pendingDuelId) void load();
    else setStage(back);
  };

  return (
    <main className="app" data-stage={stage}>
      {init.isArchive ? <ArchiveBanner subredditName={init.subredditName} todayPostId={init.todayPostId} /> : null}
      <TopBar day={day} streak={streak} tier={stage === 'duel' ? null : init.tier} />

      {stage === 'duel' && duel ? <DuelScreen key={duel.id ?? 'hub'} duelId={duel.id} loggedIn={loggedIn} onExit={closeDuel} /> : null}

      {stage === 'guess' && init.guess ? (
        <GuessScreen
          guess={init.guess}
          isArchive={init.isArchive}
          loggedIn={loggedIn}
          showHint={loggedIn && !seenHints.includes('squint')}
          onDismissHint={() => dismissHint('squint')}
          onStart={() => void onStartGuess()}
          starting={starting}
          onPick={(id) => void onGuess(id)}
          onTimeout={() => void onGuess(null)}
          pendingId={pendingChoice}
          error={actionError}
        />
      ) : null}

      {stage === 'reveal' && reveal ? (
        <RevealScreen
          reveal={reveal}
          nextLabel={draw ? 'Draw today’s →' : 'See the result →'}
          onNext={goDraw}
        />
      ) : null}

      {stage === 'intro' ? <IntroScreen reveal={reveal} nextLabel="Draw today’s →" onNext={goDraw} /> : null}

      {stage === 'loggedOut' ? <IntroScreenLoggedOut /> : null}

      {stage === 'draw' && draw ? (
        <DrawScreen
          draw={draw}
          showHint={!seenHints.includes('draw')}
          onDismissHint={() => dismissHint('draw')}
          onStart={onDrawStart}
          onSubmit={(cells, timedOut) => void onDrawSubmit(cells, timedOut)}
          submitting={submitting}
          error={actionError}
        />
      ) : null}

      {stage === 'result' && result ? (
        <ResultScreen
          result={result}
          reveal={reveal}
          day={day}
          isArchive={init.isArchive}
          subredditName={init.subredditName}
          postId={context.postId ?? null}
          nextRolloverUtcMs={init.nextRolloverUtcMs}
          timedOutNote={timedOutNote}
          rawCells={rawCells}
          onForgotten={() => void load()}
          onDuel={() => openDuel(null)}
        />
      ) : null}
    </main>
  );
};

/** Logged-out viewer on a day with nothing to guess yet. */
const IntroScreenLoggedOut = () => (
  <>
    <div>
      <h1 className="heading">Today’s Blurprint is live.</h1>
      <p className="subheading">Everyone draws the same secret word. Tomorrow, the crowd’s blurry average becomes the puzzle.</p>
    </div>
    <div className="hero">
      <div className="square">
        <BlendCanvas values={null} total={0} label="No blend yet." />
      </div>
    </div>
    <button type="button" className="btn btn-primary btn-block" onClick={() => showLoginPrompt()}>
      Log in to play
    </button>
  </>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
