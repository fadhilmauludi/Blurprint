import { connectRealtime, disconnectRealtime } from '@devvit/web/client';
import { useEffect, useRef } from 'react';
import type { DuelNudge } from '../../shared/types';

/**
 * Subscribe to a duel's realtime channel. Messages are only nudges: the caller
 * refetches the duel. If realtime is unavailable the screen still updates
 * through polling, so failures are swallowed.
 */
export const useDuelChannel = (duelId: string | null, onNudge: (n: DuelNudge) => void): void => {
  const cb = useRef(onNudge);
  useEffect(() => {
    cb.current = onNudge;
  }, [onNudge]);

  useEffect(() => {
    if (!duelId) return;
    const channel = `duel_${duelId}`;
    try {
      connectRealtime<DuelNudge>({
        channel,
        onMessage: (msg) => {
          if (msg && typeof msg === 'object' && msg.duelId === duelId) cb.current(msg);
        },
      });
    } catch {
      return;
    }
    return () => {
      try {
        disconnectRealtime(channel);
      } catch {
        /* already gone */
      }
    };
  }, [duelId]);
};
