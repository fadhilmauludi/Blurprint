# Blurprint

A two-minute daily drawing game for Reddit where **the community makes the puzzle**.
Everyone draws the same secret word on a 10×10 grid; drawings are never shown — they're
lined up and averaged into one blurry "blurprint". Tomorrow, everyone guesses what the crowd drew.

Built on **Devvit Web** for Reddit's Game of the Day Hackathon · by XenixWave.

## Quick start

```bash
npm install
npm run check        # typecheck + lint + tests + build
npm run harness      # local browser harness → http://localhost:5199/game.html?user=alice
npm run login        # once, needs a Reddit account
npm run dev          # playtest in your private test subreddit
npm run upload       # private build — never `devvit publish` (hackathon rule)
```

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
