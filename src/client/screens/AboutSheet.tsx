import { showToast } from '@devvit/web/client';
import { useEffect, useRef, useState } from 'react';
import { CREDIT, DRAW_SECONDS, USER_DAY_TTL_DAYS } from '../../shared/config';
import { api } from '../api';

type Props = { onClose: () => void; onForgotten: () => void };

/** How it works + privacy + self-service data deletion (Devvit Rules). */
export const AboutSheet = ({ onClose, onForgotten }: Props) => {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const forget = async () => {
    setBusy(true);
    const r = await api.forget();
    setBusy(false);
    if (r.ok) {
      showToast('Your Blurprint data was deleted.');
      onForgotten();
    } else showToast(r.error.error);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet panel" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 id="about-title" className="heading">
            How Blurprint works
          </h2>
          <button ref={closeRef} type="button" className="btn btn-small btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <ol className="how">
          <li>
            <strong>Guess</strong> what yesterday’s crowd drew from their blended, blurry average.
          </li>
          <li>
            <strong>Draw</strong> today’s secret word in {DRAW_SECONDS} seconds on a tiny grid.
          </li>
          <li>
            <strong>Watch</strong> today’s blend sharpen as everyone draws. Come back tomorrow to keep your streak.
          </li>
        </ol>
        <div className="dim" />
        <p className="small">
          Your drawing is never shown to anyone else — only the crowd average is public. Drawings, guesses and daily scores
          are deleted after {USER_DAY_TTL_DAYS} days.
        </p>
        {confirm ? (
          <div className="row">
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirm(false)}>
              Keep it
            </button>
            <button type="button" className="btn btn-small danger" disabled={busy} onClick={() => void forget()}>
              {busy ? 'Deleting…' : 'Yes, delete everything'}
            </button>
          </div>
        ) : (
          <button type="button" className="link-btn" onClick={() => setConfirm(true)}>
            Delete my Blurprint data (streak, scores, drawings)
          </button>
        )}
        <p className="small mono">SHEET · BLURPRINT · {CREDIT}</p>
      </div>
    </div>
  );
};
