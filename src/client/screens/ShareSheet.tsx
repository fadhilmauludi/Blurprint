import { context, navigateTo, showShareSheet, showToast } from '@devvit/web/client';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { sfx } from '../audio';
import { track } from '../telemetry';

type Props = {
  text: string;
  commented: boolean;
  /** Today's post (comments only work there). */
  canComment: boolean;
  postUrl: string;
  onCommented: () => void;
  onClose: () => void;
};

/**
 * Three separate, clearly labelled ways to share (Devvit user-action rules:
 * explicit, never merged with gameplay, never required). The comment preview
 * shows exactly what will be posted and under which name.
 */
export const ShareSheet = ({ text, commented, canComment, postUrl, onCommented, onClose }: Props) => {
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const name = context.username ? `u/${context.username}` : 'you';

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const comment = async () => {
    setBusy(true);
    const r = await api.commentResult();
    setBusy(false);
    if (!r.ok) return showToast(r.error.error);
    sfx.play('submit');
    track.share('comment');
    showToast({ text: 'Posted in today’s results thread 🎉', appearance: 'success' });
    onCommented();
    onClose();
  };

  const shareLink = async () => {
    track.share('link');
    try {
      await showShareSheet({ title: 'Blurprint', text: `${text}\nCan you read the crowd’s blur?` });
    } catch {
      showToast('Couldn’t open the share sheet.');
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet panel" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 id="share-title" className="heading">
            Share your result
          </h2>
          <button ref={closeRef} type="button" className="btn btn-small btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <pre className="share-preview mono" aria-label="Your result, as it will appear">
          {text}
        </pre>
        <p className="small">No spoilers: the answer is never included.</p>
        {canComment ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={busy || commented}
              onClick={() => void comment()}
            >
              {commented ? 'Commented ✓' : busy ? 'Posting…' : `💬 Comment as ${name}`}
            </button>
            <p className="small share-note">
              Posts the text above as a reply in today’s pinned results thread, under your username {name}. You can delete it on
              Reddit any time.
            </p>
          </>
        ) : null}
        <div className="row">
          <button type="button" className="btn btn-cyan" onClick={() => void shareLink()}>
            📤 Send the link
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              track.share('open_comments');
              navigateTo(postUrl);
            }}
          >
            Open comments
          </button>
        </div>
      </div>
    </div>
  );
};
