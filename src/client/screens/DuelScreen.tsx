import { showLoginPrompt, showShareSheet, showToast } from '@devvit/web/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DUEL_POLL_MS, DUEL_ROUNDS } from '../../shared/config';
import { duelShareData } from '../../shared/duel';
import { FORMAT_INFO } from '../../shared/formats';
import type {
  DuelAnswerResponse,
  DuelPlayer,
  DuelRoundPayload,
  DuelView,
} from '../../shared/types';
import { api } from '../api';
import { sfx } from '../audio';
import { music } from '../music';
import { BlendCanvas } from '../components/BlendCanvas';
import { ChoiceButtons } from '../components/ChoiceButtons';
import { Confetti } from '../components/Confetti';
import { QuestionStage } from '../components/QuestionStage';
import { TimerBar } from '../components/TimerBar';
import { useDuelChannel } from '../hooks/useDuelChannel';
import { usePolling } from '../hooks/usePolling';
import { track } from '../telemetry';

type Props = {
  /** null opens the hub ("Your duels" + New duel). */
  duelId: string | null;
  loggedIn: boolean;
  onExit: () => void;
};

const Marks = ({
  player,
  rounds,
  label,
}: {
  player: DuelPlayer | null;
  rounds: number;
  label: string;
}) => (
  <span className="duel-marks" aria-label={label}>
    {Array.from({ length: rounds }, (_, i) => {
      const m = player?.marks[i] ?? null;
      return (
        <span
          key={i}
          className={`duel-mark ${m === null ? 'is-open' : m.correct ? 'is-right' : 'is-miss'}`}
          aria-hidden="true"
        >
          {m === null ? '·' : m.correct ? '✓' : '✗'}
        </span>
      );
    })}
  </span>
);

const marksLabel = (p: DuelPlayer | null): string => {
  if (!p) return 'Not joined yet';
  const right = p.marks.filter((m) => m?.correct).length;
  const played = p.marks.filter((m) => m !== null).length;
  return `${right} right out of ${played} played`;
};

const PlayerCard = ({
  player,
  rounds,
  isMe,
  fallback,
}: {
  player: DuelPlayer | null;
  rounds: number;
  isMe: boolean;
  fallback: string;
}) => (
  <div className={`duel-card${isMe ? ' is-me' : ''}`}>
    <span className="duel-name">
      {player ? `u/${player.username}` : fallback}
    </span>
    <span className="duel-score mono">{player ? player.score : '—'}</span>
    <Marks player={player} rounds={rounds} label={marksLabel(player)} />
  </div>
);

const resultLine = (v: DuelView): string => {
  if (v.status !== 'finished' || !v.winner) return '';
  if (v.winner === 'tie') return 'It’s a tie!';
  if (v.me === null)
    return `u/${(v.winner === 'host' ? v.host : v.guest!).username} wins`;
  return v.winner === v.me ? 'You win! 🏆' : 'You lost this one.';
};

const shareInvite = async (id: string) => {
  track.duel('invite_shared');
  try {
    await showShareSheet({
      title: 'Blurprint duel',
      text: 'I challenge you to a Blurprint duel: 5 blurry crowd drawings, each round harder. Who reads the crowd faster?',
      data: duelShareData(id),
    });
  } catch {
    showToast('Couldn’t open the share sheet — try again.');
  }
};

export const DuelScreen = ({ duelId, loggedIn, onExit }: Props) => {
  const [id, setId] = useState<string | null>(duelId);
  const [view, setView] = useState<DuelView | null>(null);
  const [mine, setMine] = useState<{ duels: DuelView[]; wins: number } | null>(
    null
  );
  const [round, setRound] = useState<DuelRoundPayload | null>(null);
  const [outcome, setOutcome] = useState<DuelAnswerResponse | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prev = useRef<DuelView | null>(null);

  const applyView = useCallback((v: DuelView) => {
    const before = prev.current;
    if (before && before.id === v.id) {
      if (!before.guest && v.guest && v.me === 'host') {
        sfx.play('duelJoin');
        showToast({
          text: `u/${v.guest.username} joined your duel!`,
          appearance: 'success',
        });
      }
      if (before.status !== 'finished' && v.status === 'finished') {
        sfx.play(
          v.winner === v.me ? 'win' : v.winner === 'tie' ? 'reveal' : 'lose'
        );
        track.duel(
          'finished',
          `winner:${v.winner === v.me ? 'me' : v.winner === 'tie' ? 'tie' : 'them'}`
        );
      }
    }
    prev.current = v;
    setView(v);
  }, []);

  const refresh = useCallback(() => {
    if (!id) return;
    void api.duel(id).then((r) => {
      if (r.ok) applyView(r.data);
      else setError(r.error.error);
    });
  }, [id, applyView]);

  useEffect(() => {
    if (id) {
      void api.duel(id).then((r) => {
        if (r.ok) applyView(r.data);
        else setError(r.error.error);
      });
    } else if (loggedIn) {
      void api.duelMine().then((r) => {
        if (r.ok) setMine(r.data);
        else setError(r.error.error);
      });
    }
  }, [id, loggedIn, applyView]);

  useEffect(() => {
    music.setMood(round && !outcome ? 'tense' : 'calm');
  }, [round, outcome]);

  useDuelChannel(id, refresh);
  usePolling(refresh, DUEL_POLL_MS, Boolean(id) && view?.status !== 'finished');

  const create = async () => {
    setBusy(true);
    setError(null);
    const r = await api.duelCreate();
    setBusy(false);
    if (!r.ok) {
      if (r.error.code === 'NOT_LOGGED_IN') showLoginPrompt();
      setError(r.error.error);
      return;
    }
    track.duel('created');
    sfx.play('start');
    prev.current = r.data;
    setView(r.data);
    setId(r.data.id);
  };

  const join = async () => {
    if (!id) return;
    if (!loggedIn) return showLoginPrompt();
    setBusy(true);
    const r = await api.duelJoin(id);
    setBusy(false);
    if (!r.ok) return setError(r.error.error);
    track.duel('joined');
    sfx.play('duelJoin');
    applyView(r.data);
  };

  const playRound = async (n: number) => {
    if (!id) return;
    setBusy(true);
    setError(null);
    const r = await api.duelRound(id, n);
    setBusy(false);
    if (!r.ok) {
      setError(r.error.error);
      refresh();
      return;
    }
    sfx.play('start');
    setOutcome(null);
    setRound(r.data);
  };

  const answer = async (choiceId: string | null) => {
    if (!round || pending !== null || outcome) return;
    setPending(choiceId ?? '');
    setPicked(choiceId);
    if (choiceId) sfx.play('tap');
    const r = await api.duelAnswer({
      id: round.duelId,
      round: round.round,
      choiceId,
    });
    setPending(null);
    if (!r.ok) {
      setError(r.error.error);
      setRound(null);
      refresh();
      return;
    }
    sfx.play(
      r.data.correct ? 'correct' : r.data.timedOut ? 'timeout' : 'wrong'
    );
    setOutcome(r.data);
    applyView(r.data.duel);
  };

  const next = () => {
    const v = outcome?.duel ?? view;
    setRound(null);
    setOutcome(null);
    if (v && v.myNextRound < v.rounds) void playRound(v.myNextRound);
  };

  // ---------- hub ----------
  if (!id) {
    return (
      <>
        <div>
          <h1 className="heading">⚔️ Duel a friend</h1>
          <p className="subheading">
            5 blurry crowd drawings. Each round is harder: more choices, less
            time. Fastest right answers win.
          </p>
        </div>
        <div className="panel duel-list" role="list">
          {!loggedIn ? (
            <p className="lb-empty">Log in to duel.</p>
          ) : !mine ? (
            <p className="lb-empty">Loading your duels…</p>
          ) : mine.duels.length === 0 ? (
            <p className="lb-empty">
              No duels yet. Start one and send it to a friend!
            </p>
          ) : (
            <>
              <p className="duel-wins mono">
                🏆 {mine.wins} duel win{mine.wins === 1 ? '' : 's'}
              </p>
              {mine.duels.map((d) => {
                const opp = d.me === 'host' ? d.guest : d.host;
                const meP = d.me === 'host' ? d.host : d.guest;
                const status =
                  d.status === 'finished'
                    ? resultLine(d)
                    : d.status === 'waiting'
                      ? 'Waiting for a friend'
                      : 'In progress';
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="listitem"
                    className="duel-row"
                    onClick={() => setId(d.id)}
                  >
                    <span className="duel-row-name">
                      vs {opp ? `u/${opp.username}` : '…'}
                    </span>
                    <span className="mono">
                      {meP?.score ?? 0}–{opp?.score ?? 0}
                    </span>
                    <span className="duel-row-status">{status}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
        {error ? (
          <p className="notice" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy}
          onClick={loggedIn ? () => void create() : () => showLoginPrompt()}
        >
          {busy ? 'Setting up…' : loggedIn ? '⚔️ New duel' : 'Log in to duel'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={onExit}
        >
          ← Back to today’s Blurprint
        </button>
      </>
    );
  }

  if (!view) {
    return error ? (
      <>
        <p className="notice" role="alert">
          {error}
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={onExit}
        >
          ← Back
        </button>
      </>
    ) : (
      <div className="hero">
        <div className="square skeleton" />
      </div>
    );
  }

  const opponent = view.me === 'guest' ? view.host : view.guest;
  const meP =
    view.me === 'guest' ? view.guest : view.me === 'host' ? view.host : null;

  // ---------- round ----------
  if (round) {
    const answered = outcome !== null;
    const isPick = round.format === 'pick';
    const info = FORMAT_INFO[round.format];
    return (
      <>
        <Confetti burstKey={answered && outcome.correct ? `r${round.round}` : null} pieces={40} />
        <div className="duel-round-head">
          <span className="mono">
            ROUND {round.round + 1}/{view.rounds}{' '}
            <span className="format-chip">
              <span aria-hidden="true">{info.icon}</span> {info.name}
            </span>
          </span>
          {opponent ? (
            <Marks
              player={opponent}
              rounds={view.rounds}
              label={`Opponent: ${marksLabel(opponent)}`}
            />
          ) : null}
        </div>
        <TimerBar
          key={`t${round.round}`}
          seconds={round.seconds}
          remainingMs={round.remainingMs}
          running={!answered && pending === null}
          onEnd={() => void answer(null)}
          warnAt={3}
        />
        {isPick ? (
          <h2 className="heading heading-compact pick-prompt">
            Which blur is the crowd’s <span className="prompt-word">{round.word}</span>?
          </h2>
        ) : null}
        <div className="hero">
          <div className="square">
            {answered && !isPick ? (
              <BlendCanvas
                key={`r${round.round}`}
                values={round.blend.values}
                total={round.blend.total}
                sharp
                label={`The blend was ${outcome.answerWord}.`}
              />
            ) : (
              <QuestionStage
                key={`q${round.round}`}
                format={round.format}
                seed={round.seed}
                blend={round.blend}
                seconds={round.seconds}
                remainingMs={round.remainingMs}
                frozen={pending !== null || answered}
                startBlur={round.startBlur}
                startZoom={round.startZoom}
                options={round.options}
                optionChoices={round.choices}
                onPick={(c) => void answer(c)}
                answerId={answered ? outcome.answerId : null}
                pickedId={answered ? picked : null}
                pendingId={pending}
                label={`A crowd drawing (${info.name.toLowerCase()}). What is it?`}
              />
            )}
          </div>
        </div>
        {answered ? (
          <div
            className={`banner ${outcome.correct ? 'is-correct' : 'is-wrong'} fade-in`}
            role="status"
          >
            <span className="banner-icon" aria-hidden="true">
              {outcome.correct ? '✓' : outcome.timedOut ? '⏱' : '✗'}
            </span>
            <span>
              {outcome.correct
                ? 'Yes! '
                : outcome.timedOut
                  ? 'Time’s up — '
                  : 'No — '}
              it was{' '}
              <strong className="answer-word">{outcome.answerWord}</strong>
            </span>
            {outcome.points > 0 ? (
              <span className="points mono">+{outcome.points}</span>
            ) : null}
          </div>
        ) : null}
        {isPick ? null : (
          <ChoiceButtons
            choices={round.choices}
            onPick={(c) => void answer(c)}
            disabled={pending !== null}
            pendingId={pending}
            answerId={answered ? outcome.answerId : null}
            pickedId={answered ? picked : null}
            compact={round.choices.length > 4 || answered}
          />
        )}
        {answered ? (
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={next}
          >
            {outcome.duel.myNextRound < outcome.duel.rounds
              ? `Next round (${outcome.duel.myNextRound + 1}/${outcome.duel.rounds}) →`
              : 'See the score →'}
          </button>
        ) : null}
      </>
    );
  }

  // ---------- overview ----------
  const finished = view.status === 'finished';
  const heading = finished
    ? resultLine(view)
    : view.me === null
      ? view.guest
        ? 'This duel is already full.'
        : `u/${view.host.username} challenged you to a duel!`
      : !view.guest
        ? 'Waiting for your friend…'
        : meP?.done
          ? `Waiting for u/${opponent?.username ?? 'your friend'} to finish…`
          : `Duel vs u/${opponent?.username ?? '…'}`;

  return (
    <>
      <Confetti burstKey={finished && view.winner === view.me && view.me !== null ? `win${view.id}` : null} pieces={140} />
      <div>
        <h1 className="heading" aria-live="polite">
          {heading}
        </h1>
        <p className="subheading">
          {finished
            ? 'Fastest right answers score the most.'
            : view.me === 'host' && !view.guest
              ? 'Send the invite — you can play your rounds now and they play theirs whenever.'
              : '5 rounds · each one harder · faster right answers score more.'}
        </p>
      </div>
      <div className="duel-board">
        <PlayerCard
          player={view.host}
          rounds={view.rounds}
          isMe={view.me === 'host'}
          fallback="host"
        />
        <span className="duel-vs mono" aria-hidden="true">
          VS
        </span>
        <PlayerCard
          player={view.guest}
          rounds={view.rounds}
          isMe={view.me === 'guest'}
          fallback={view.me === 'host' ? 'Invite a friend' : 'You?'}
        />
      </div>
      {finished ? null : (
        <div className="duel-rules panel">
          {DUEL_ROUNDS.map((r, i) => (
            <span key={i} className="duel-rule mono">
              R{i + 1} · {r.choices} choices · {r.seconds}s
            </span>
          ))}
        </div>
      )}
      {error ? (
        <p className="notice" role="alert">
          {error}
        </p>
      ) : null}
      {view.me === null && !view.guest ? (
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy}
          onClick={() => void join()}
        >
          {loggedIn
            ? busy
              ? 'Joining…'
              : '⚔️ Accept the duel'
            : 'Log in to accept'}
        </button>
      ) : null}
      {view.me && view.myNextRound < view.rounds ? (
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy}
          onClick={() => void playRound(view.myNextRound)}
        >
          {view.openRound
            ? `Resume round ${view.myNextRound + 1}`
            : view.myNextRound === 0
              ? 'Play round 1'
              : `Play round ${view.myNextRound + 1}`}
        </button>
      ) : null}
      {view.me === 'host' && !view.guest ? (
        <button
          type="button"
          className="btn btn-cyan btn-block"
          onClick={() => void shareInvite(view.id)}
        >
          📨 Invite a friend
        </button>
      ) : null}
      {finished && view.me ? (
        <button
          type="button"
          className="btn btn-cyan btn-block"
          disabled={busy}
          onClick={() => {
            setView(null);
            prev.current = null;
            void create();
          }}
        >
          ⚔️ Rematch (new duel)
        </button>
      ) : null}
      <button
        type="button"
        className="btn btn-ghost btn-block"
        onClick={onExit}
      >
        ← Back to today’s Blurprint
      </button>
    </>
  );
};
