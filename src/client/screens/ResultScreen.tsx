import { navigateTo, showToast } from '@devvit/web/client';
import { useCallback, useEffect, useState } from 'react';
import { BLEND_POLL_MS, CREDIT, FEATURES, MIN_BLEND_DRAWINGS } from '../../shared/config';
import type { BlendPayload, LeaderboardPayload, ResultPayload, RevealPayload } from '../../shared/types';
import { api } from '../api';
import { BlendCanvas } from '../components/BlendCanvas';
import { sfx } from '../audio';
import { Leaderboard, Podium } from '../components/Leaderboard';
import { formatCountdown, useNow } from '../hooks/useNow';
import { usePolling } from '../hooks/usePolling';
import { track } from '../telemetry';
import { AboutSheet } from './AboutSheet';

type Tab = 'blend' | 'today' | 'streaks' | 'all';

type Props = {
  result: ResultPayload;
  reveal: RevealPayload | null;
  day: number;
  isArchive: boolean;
  subredditName: string;
  postId: string | null;
  nextRolloverUtcMs: number;
  timedOutNote: boolean;
  /** Raw cells of the drawing just submitted (dev export only). */
  rawCells: number[] | null;
  onForgotten: () => void;
  onDuel: () => void;
};

const postUrl = (sub: string, postId: string | null) =>
  postId ? `https://www.reddit.com/r/${sub}/comments/${postId.replace(/^t3_/, '')}/` : `https://www.reddit.com/r/${sub}/`;

export const ResultScreen = ({
  result,
  reveal,
  day,
  isArchive,
  subredditName,
  postId,
  nextRolloverUtcMs,
  timedOutNote,
  rawCells,
  onForgotten,
  onDuel,
}: Props) => {
  const [blend, setBlend] = useState<BlendPayload>(result.liveBlend);
  const [board, setBoard] = useState<LeaderboardPayload>(result.leaderboard);
  const [tab, setTab] = useState<Tab>('blend');
  const [joined, setJoined] = useState(false);
  const [about, setAbout] = useState(false);
  const now = useNow(30_000);

  useEffect(() => {
    track.resultViewed(day, result.streak, Boolean(reveal?.correct) || result.drew, result.scoreToday);
    if (result.streakMilestone) {
      track.streakMilestone(result.streakMilestone);
      sfx.play('milestone');
      showToast({ text: `🔥 ${result.streakMilestone}-day streak! Keep it going tomorrow.`, appearance: 'success' });
    }
    // Only once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(() => {
    void api.blend(day).then((r) => {
      if (r.ok) setBlend(r.data);
    });
  }, [day]);
  usePolling(refresh, BLEND_POLL_MS, !isArchive);

  const openTab = (t: Tab) => {
    setTab(t);
    if (t !== 'blend') {
      track.leaderboardViewed(t);
      void api.leaderboard(day).then((r) => {
        if (r.ok) setBoard(r.data);
      });
    }
  };

  const others = Math.max(0, blend.total - (result.drew ? 1 : 0));
  const caption = isArchive
    ? `Final blend · ${blend.total} drawings`
    : blend.values
      ? result.drew
        ? `You + ${others} others so far. It gets clearer all day.`
        : `${blend.total} drawings so far. It gets clearer all day.`
      : `${Math.max(0, MIN_BLEND_DRAWINGS - blend.total)} more drawings until the blend appears.`;

  const onComment = () => {
    track.cta('comment', day);
    navigateTo(postUrl(subredditName, postId));
  };
  const onJoin = async () => {
    track.cta('subscribe', day);
    const r = await api.subscribe();
    if (r.ok) {
      setJoined(true);
      showToast({ text: `Joined r/${subredditName} — see you tomorrow!`, appearance: 'success' });
    } else {
      navigateTo(`https://www.reddit.com/r/${subredditName}/`);
    }
  };
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(rawCells ?? []));
      showToast('Copied raw cells');
    } catch {
      showToast('Clipboard blocked');
    }
  };

  return (
    <>
      {timedOutNote ? (
        <p className="notice" role="status">
          ⏱ Time’s up — draw a bit more next time!
        </p>
      ) : null}
      <div className="tabs" role="tablist" aria-label="Result view">
        {(
          [
            ['blend', isArchive ? `Day ${day}` : 'Blend'],
            ['today', isArchive ? 'Scores' : 'Today'],
            ['streaks', '🔥 Streaks'],
            ['all', 'All-time'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" className="tab" aria-selected={tab === id} onClick={() => openTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="hero">
        <div className="square">
          {tab === 'blend' ? (
            <BlendCanvas
              values={blend.values}
              total={blend.total}
              hidden={blend.hidden}
              highlight={result.myCells.length ? result.myCells : undefined}
              animateIn
              label={`Today’s live blend of ${blend.total} drawings.`}
            />
          ) : (
            <div className="lb-panel panel" role="tabpanel">
              {tab === 'today' ? <Podium entries={board.yesterday} /> : null}
              {tab === 'streaks' ? <p className="lb-note">Longest streaks among today’s artists</p> : null}
              <Leaderboard
                entries={tab === 'today' ? board.today : tab === 'streaks' ? board.streaks : board.allTime}
                emptyText={tab === 'all' ? 'No scores yet.' : tab === 'streaks' ? 'No streaks yet today.' : 'No scores yet today.'}
                scorePrefix={tab === 'streaks' ? '🔥 ' : ''}
              />
            </div>
          )}
        </div>
      </div>
      <p className="caption">{caption}</p>
      <div className="stats" role="list">
        <div className="stat" role="listitem">
          <span className="stat-value mono">{result.scoreToday}</span>
          <span className="stat-label">{isArchive ? `Day ${day} score` : 'Score today'}</span>
        </div>
        <div className="stat" role="listitem">
          <span className="stat-value mono streak-chip">🔥 {result.streak}</span>
          <span className="stat-label">Streak</span>
        </div>
        <div className="stat" role="listitem">
          <span className="stat-value mono">
            {(tab === 'streaks' ? board.rankStreak : board.rankToday) ? `#${tab === 'streaks' ? board.rankStreak : board.rankToday}` : '—'}
          </span>
          <span className="stat-label">Rank</span>
        </div>
      </div>
      <div className="row cta-row">
        <button type="button" className="btn btn-primary" onClick={onComment} aria-label="Argue in the comments">
          💬 Comments
        </button>
        <button type="button" className="btn btn-cyan" onClick={onDuel} aria-label="Duel a friend">
          ⚔️ Duel
        </button>
        <button type="button" className="btn btn-ghost" disabled={joined} onClick={() => void onJoin()} aria-label={`Join r/${subredditName}`}>
          {joined ? 'Joined ✓' : '＋ Join'}
        </button>
      </div>
      <footer className="titleblock mono" aria-label="Sheet info">
        <div className="tb-cell">
          <span className="tb-strong">SHEET #{day}</span>
          <span>BLURPRINT</span>
        </div>
        <div className="tb-cell tb-grow">
          <span className="tb-strong">{isArchive ? 'ARCHIVE' : `NEW BLURPRINT IN ${formatCountdown(nextRolloverUtcMs - now)}`}</span>
          <span>{CREDIT}</span>
        </div>
        {FEATURES.devTools && rawCells ? (
          <button type="button" className="tb-cell tb-btn" onClick={() => void onCopy()}>
            <span className="tb-strong">⧉</span>
            <span>Copy</span>
          </button>
        ) : null}
        <button type="button" className="tb-cell tb-btn" onClick={() => setAbout(true)} aria-haspopup="dialog">
          <span className="tb-strong" aria-hidden="true">ⓘ</span>
          <span>About</span>
        </button>
      </footer>
      {about ? <AboutSheet onClose={() => setAbout(false)} onForgotten={onForgotten} /> : null}
    </>
  );
};
