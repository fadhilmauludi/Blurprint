# Devpost submission (draft)

- **App listing:** https://developers.reddit.com/apps/blurprint _(confirm after `npm run upload`)_
- **Subreddit:** r/_____ _(demo subreddit, public, < 200 members)_
- **Demo post:** _(pinned, public; its "yesterday" must have ≥ 15 drawings)_

## Description (≈150 words)

Blurprint is a two-minute daily drawing game where the community makes the puzzle. Every day, everyone gets the same secret word and 20 seconds to draw it on a tiny 10×10 grid. Nobody's drawing is ever shown. Instead, every drawing is lined up, scaled and averaged into one soft, blurry "blurprint" of what the crowd drew. The next day, that blur is the puzzle: start the clock, watch the blob slowly pull into focus, and pick from similar-shaped answers before time runs out. The sooner you guess right, the more you score, and the puzzles get harder every week. Then draw today's word, and watch today's blend sharpen live as more people join. Your drawing earns a "crowd sync" score for matching the average, your daily streak grows, and the comment thread fills with people arguing about the blob. It looks like a technical drawing, it plays in two minutes, and every puzzle is made by the subreddit itself.

## How to play

Open today's post and tap **Guess the blur**, then **Start the clock**. Yesterday's crowd blend sharpens while the clock runs: pick what you think everyone drew — early guesses earn more. Then you get today's secret word: draw it in 20 seconds (anywhere, any size — we line everyone up). Your squares flash inside the live blend, and you can compare your score, streak and rank. Come back tomorrow to guess what today's crowd drew — or tap **⚔️ Duel** to challenge a friend to 5 quick rounds.

## How it uses Reddit

- **The community is the content:** every day's puzzle is the average of that subreddit's drawings.
- **Comments:** the result card sends players to argue about the blob in the thread.
- **Streaks** for drawing every day; boards for today's scores, longest streaks, all-time, and yesterday's winners.
- **1v1 duels** shared through Reddit's native share sheet (deep-link data), live via Devvit realtime.
- **Devvit Journeys** telemetry for the guess → draw → result loop.
- Daily posts are created automatically at 00:00 UTC; old posts stay playable as an archive.
- Moderator tools: create today's post, hide a day's blend, load seed data.

## Tech

Devvit Web (interactive post with inline splash + expanded game), React 19 + Vite, Hono server, Devvit Redis (hashes + sorted sets), Devvit scheduler, Devvit realtime, Journeys telemetry. Canvas 2D for drawing and the blend; Web Audio synthesised sound effects. 96 unit/service tests (vitest). No external requests, no AI-generated assets.
