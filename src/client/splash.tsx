import './styles/base.css';
import './splash.css';
import './screens/features.css';

import { context, getShareData, requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { CREDIT } from '../shared/config';
import { parseDuelShare } from '../shared/duel';
import type { SplashResponse } from '../shared/types';
import { api } from './api';
import { BlendCanvas } from './components/BlendCanvas';

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
          ? 'Guess the blur'
          : 'Draw today’s word';

  return (
    <main className="splash">
      <header className="splash-head">
        <h1 className="splash-title">
          BLURPRINT{day !== null ? <span className="mono"> #{day}</span> : null}
        </h1>
        <p className="splash-sub">What did the crowd draw?</p>
      </header>
      <div className="hero">
        <div className="square">
          {data ? (
            <BlendCanvas
              values={data.blend?.values ?? null}
              total={data.players}
              hidden={false}
              animateIn
              label={data.blend ? `A blurry blend of ${data.players} drawings.` : 'No blend yet.'}
            />
          ) : (
            <div className="square skeleton" style={{ position: 'absolute', inset: 0 }} />
          )}
        </div>
      </div>
      <p className="splash-meta mono">
        {failed
          ? 'Tap to open'
          : data
            ? data.blend
              ? `${data.players} players · 2 min`
              : 'Be one of the first artists · 2 min'
            : ' '}
        {data && data.streak > 0 ? <span className="streak-chip"> · 🔥 {data.streak}</span> : null}
      </p>
      {inviteFrom ? <p className="splash-invite">u/{inviteFrom} challenged you to a duel!</p> : null}
      <button type="button" className="btn btn-primary splash-cta" onClick={open}>
        {label}
      </button>
      <p className="splash-credit mono">{CREDIT}</p>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
