import type { LeaderboardEntry } from '../../shared/types';

type Props = { entries: LeaderboardEntry[]; emptyText: string };

export const Leaderboard = ({ entries, emptyText }: Props) => {
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
            <span className="lb-score mono">{e.score}</span>
          </li>
        );
      })}
    </ol>
  );
};
