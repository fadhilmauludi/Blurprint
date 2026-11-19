import type { LeaderboardEntry } from '../../shared/types';

type Props = { entries: LeaderboardEntry[]; emptyText: string; /** Prefix for the score column, e.g. '🔥 '. */ scorePrefix?: string };

export const Leaderboard = ({ entries, emptyText, scorePrefix = '' }: Props) => {
  if (entries.length === 0) return <p className="lb-empty">{emptyText}</p>;
  return (
    <ol className="lb">
      {entries.map((e, i) => {
        const gap = i > 0 && e.rank > entries[i - 1]!.rank + 1;
        return (
          <li key={`${e.rank}-${e.username}`} className={`lb-row${e.isMe ? ' is-me' : ''}${gap ? ' has-gap' : ''}`}>
            <span className="lb-rank mono">#{e.rank}</span>
            <span className="lb-name">
              u/{e.username}
              {e.isMe ? <span className="lb-you"> (you)</span> : null}
            </span>
            <span className="lb-score mono">
              {scorePrefix}
              {e.score}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

const MEDALS = ['🥇', '🥈', '🥉'];

/** "Yesterday's winners": the top 3 of the previous day, one line. */
export const Podium = ({ entries }: { entries: LeaderboardEntry[] }) =>
  entries.length === 0 ? null : (
    <div className="podium" aria-label="Yesterday’s winners">
      <span className="podium-title mono">YESTERDAY’S WINNERS</span>
      <ol className="podium-list">
        {entries.map((e, i) => (
          <li key={e.username} className={e.isMe ? 'is-me' : undefined}>
            <span aria-hidden="true">{MEDALS[i] ?? `#${e.rank}`}</span>
            <span className="visually-hidden">Rank {e.rank}:</span> <span className="podium-name">u/{e.username}</span>{' '}
            <span className="mono">{e.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
