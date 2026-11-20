import './styles/base.css';
import './splash.css';
import './screens/features.css';
import './styles/polish.css';

import { context, getShareData, requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { CREDIT } from '../shared/config';
import { tierForDay } from '../shared/difficulty';
import { parseDuelShare } from '../shared/duel';
import { FORMAT_INFO, formatForDay } from '../shared/formats';
import type { SplashResponse } from '../shared/types';
import { api } from './api';
import { BlendCanvas } from './components/BlendCanvas';
import { TierBadge } from './components/TopBar';

const dayFromPostData = (): number | null => {
  const pd = context.postData;
  return pd && typeof pd.day === 'number' ? pd.day : null;
};

/** Inline feed view: the blend is the hero; one button opens the game. */
export const Splash = () => {
  const [data, setData] = useState<SplashResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [inviteFrom, setInviteFrom] = useState<string | null>(null);
  const day = data?.postDay ?? dayFromPostData();

  useEffect(() => {
    void api.splash().then((r) => {
      if (r.ok) setData(r.data);
      else setFailed(true);
    });
    // Opened from a duel invite link: remember it server-side for the game view.
    let shared: string | null;
    try {
      shared = parseDuelShare(getShareData());
    } catch {
      shared = null;
    }
    if (shared) {
      const id = shared;
      void api.duel(id).then((r) => {
        if (!r.ok || r.data.me === 'host') return;
        setInviteFrom(r.data.host.username);
        if (context.userId) void api.duelRemember(id);
      });
    }
  }, []);

  const open = (e: MouseEvent<HTMLButtonElement>) => requestExpandedMode(e.nativeEvent, 'game');

  const label = inviteFrom
    ? '⚔️ Accept the duel'
    : !data
    ? 'Play'
    : data.isArchive
      ? 'Guess this old blur'
      : data.doneToday
        ? 'See today’s blend'
        : data.blend
          ? '▶ Guess the blur'
          : 'Draw today’s word';

  const tier = day !== null ? tierForDay(day) : null;
  const format = day !== null ? FORMAT_INFO[formatForDay(day)] : null;
  const hook = !data ? (
    'What did the crowd draw?'
  ) : data.blend ? (
    <>
      <em>{data.players} people</em> drew the same thing.
      <br />
      Can you tell what?
    </>
  ) : (
    <>
      Everyone draws the same secret word.
      <br />
      Tomorrow, <em>the blur</em> is the puzzle.
    </>
  );

  return (
    <main className="splash">
      <header className="splash-head">
        <h1 className="splash-title">
          BLURPRINT{day !== null ? <span className="mono"> #{day}</span> : null}
        </h1>
      </header>
      {tier && format ? (
        <div className="splash-tags">
          <TierBadge tier={tier} />
          <span className="format-chip">
            <span aria-hidden="true">{format.icon}</span> {format.name}
          </span>
        </div>
      ) : null}
      <p className="splash-hook">{hook}</p>
      <div className="hero">
        <div className="square">
          {data ? (
            <>
              <div className="splash-teaser">
                <BlendCanvas
                  values={data.blend?.values ?? null}
                  total={data.players}
                  hidden={false}
                  blurScale={data.blend ? 1.6 : 1}
                  animateIn
                  label={data.blend ? `A very blurry blend of ${data.players} drawings.` : 'No blend yet.'}
                />
              </div>
              {data.blend ? (
                <>
                  <div className="splash-scan" aria-hidden="true" />
                  <span className="splash-q" aria-hidden="true">
                    ?
                  </span>
                </>
              ) : null}
            </>
          ) : (
            <div className="square skeleton" style={{ position: 'absolute', inset: 0 }} />
          )}
        </div>
      </div>
      {inviteFrom ? <p className="splash-invite">u/{inviteFrom} challenged you to a duel!</p> : null}
      <button type="button" className="btn btn-primary splash-cta" onClick={open}>
        {label}
      </button>
      <p className="splash-meta mono">
        {failed ? 'Tap to open' : data ? (data.blend ? `${data.players} players · 2 min` : '2 min · be one of the first artists') : ' '}
        {data && data.streak > 0 ? <span className="streak-chip"> · 🔥 {data.streak}</span> : null}
        {' · '}
        {CREDIT}
      </p>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
