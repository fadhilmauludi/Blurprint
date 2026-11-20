# Blurprint

A two-minute daily drawing game for Reddit where **the community makes the puzzle**.
Everyone draws the same secret word on a 10×10 grid; drawings are never shown — they're
lined up and averaged into one blurry "blurprint". Tomorrow, everyone guesses what the crowd drew.

Built on **Devvit Web** for Reddit's Game of the Day Hackathon · by XenixWave.

- **On the clock:** the blend starts very blurry and pulls into focus; guess early for more points.
- **Gets harder:** Warm-up → Tricky → Hard → Expert as the days go by (more choices, less time, bigger multiplier).
- **Winners boards:** today's scores, 🔥 longest streaks, all-time, and yesterday's podium.
- **1v1 duels:** challenge a friend through Reddit's share sheet; 5 rounds, each harder, live when you're both online.
- **Four ways to read the blur:** focus pull, zoom out, tile reveal (rotating daily) and, in duels, pick the blend. 35 shapes.
- **Sound + music:** synthesised effects and a background loop that speeds up when the clock runs (separate toggles).
- **Made to spread on Reddit:** curiosity titles, a pinned results thread with yesterday's winners, *Comment as u/name*, share link. Launch playbook: `docs/GROWTH.md`.

## Quick start

```bash
npm install
npm run check        # typecheck + lint + tests + build
npm run harness      # local browser harness → http://localhost:5199/game.html?user=alice
npm run login        # once, needs a Reddit account
npm run dev          # playtest in your private test subreddit
npm run upload       # private build — never `devvit publish` (hackathon rule)
```

## Playable demo (no Reddit needed)

`npm run demo:build` builds `dist-standalone/blurprint-demo.html`: one self-contained page with the
real client and the real API routes running in the browser over an in-memory store (`standalone/`).
A demo bar switches level (Warm-up → Expert) and player; duels are played against a computer rival.

## Layout

```
src/shared/   game rules (pure, tested): normalize, blend, scoring, schedule, prompts, config, types
src/server/   Hono server: routes/ (api, internal, telemetry), services/, redisKeys.ts, store.ts
src/client/   React webview: splash.tsx (inline), game.tsx (expanded), components/, screens/
harness/      local dev harness (mocks @devvit/web/client, in-memory Redis, seeded scenario)
tools/        make-seed.ts (placeholder seed drawings), gate.ts (renders blends to PNG)
docs/         SPRINTS, PROGRESS, DECISIONS, PLAYTEST, SUBMISSION
```

## Docs

- [Sprint plan](docs/SPRINTS.md) · [Progress](docs/PROGRESS.md) · [Decisions](docs/DECISIONS.md)
- [Playtest log](docs/PLAYTEST.md) · [Submission draft](docs/SUBMISSION.md)

## Privacy

Individual drawings are only ever shown to their author. Per-user data expires after 30 days,
deleted accounts are purged hourly, and players can delete their data from the About sheet.
