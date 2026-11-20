# Blurprint — Sprint Plan

Source of truth for scope: `BLURPRINT_BUILD_SPEC.md` (19 Nov 2026).
Hard deadline: **9 Dec 2026, 09:00 WIB** (8 Dec 18:00 PST). Target submit: **7 Dec**.
Feature freeze: **6 Dec**. Plan A/B gate: **26 Nov**.

Each sprint ends with: `npm run typecheck && npm run lint && npm test && npm run build` green,
a commit, and an updated `docs/PROGRESS.md`. Sprints that touch the UI also end with
something playable in a real Reddit post (`npm run dev`), which needs a human logged in to Devvit.

Legend: 🤖 = Claude Code can do it in the repo · 🧑 = needs a human (Reddit account / browser / people)

---

## Sprint 0 — Foundations (19–20 Nov) · spec M0

Goal: a clean repo on the official Devvit Web React template, every Devvit API we rely on verified.

| # | Task | Owner | Done when |
|---|------|-------|-----------|
| 0.1 | Clone the official template (`reddit/devvit-template-react`, Devvit 0.15.4) into `blurprint/` | 🤖 | builds with `npm run build` |
| 0.2 | Answer the §14 verify-before-use list from installed type defs + docs → `docs/DECISIONS.md` | 🤖 | all 9 questions answered with source |
| 0.3 | Project skill `.claude/skills/devvit-web/SKILL.md` capturing verified API facts | 🤖 | future sessions stop guessing APIs |
| 0.4 | vitest, `npm run typecheck`, `npm test`, folder layout (§8.1), tokens.css | 🤖 | scripts run |
| 0.5 | `src/shared/types.ts` (data contract), `config.ts`, `redisKeys.ts`, `schedule.ts` + tests | 🤖 | tests pass |
| 0.6 | `devvit login`, create app `blurprint` at developers.reddit.com/new, create private test subreddit | 🧑 Rafly | `npm run dev` opens a playtest post |

## Sprint 1 — Core logic (21–23 Nov) · spec M1 part 1

Goal: all game rules as pure, tested functions.

| # | Task | Owner |
|---|------|-------|
| 1.1 | `normalize.ts` (bbox → aspect-preserving scale → area sampling, threshold 0.5) + tests | 🤖 |
| 1.2 | `blend.ts` (intensity, gamma, cosine crowd-sync) + tests | 🤖 |
| 1.3 | `scoring.ts` (points table, streak update, daily score) + tests | 🤖 |
| 1.4 | `prompts.ts` — 72 prompts in 12 silhouette groups; seeded schedule + decoys + tests | 🤖 / 🧑 Fadhil reviews words |
| 1.5 | In-memory Redis fake implementing the exact subset of the Devvit `RedisClient` we use | 🤖 |

## Sprint 2 — Server + first playable (24–25 Nov) · spec M1 part 2

Goal: the full guess → reveal → draw → result loop works end to end against Redis.

| # | Task | Owner |
|---|------|-------|
| 2.1 | Services: day, drawing, guess, user, leaderboard, post — all over a `Store` interface | 🤖 |
| 2.2 | `/api/init`, `/api/guess`, `/api/skip-guess`, `/api/draw`, `/api/blend`, `/api/leaderboard`, `/api/splash` | 🤖 |
| 2.3 | Validation + one-per-user guards (`hSetNX`), typed `ApiError` | 🤖 |
| 2.4 | Service-level tests using the Redis fake (double submit, wrong phase, archive) | 🤖 |
| 2.5 | Two test accounts draw today's prompt in a real post | 🧑 |

### 🚦 Gate — 26 Nov
Run `npm run gate` (renders seeded blends to PNGs in `docs/gate/`) and do the human recognisability
test (≥ 2 of 3 blends recognised). Record Plan A / B1 / B2 in `docs/DECISIONS.md`.

## Sprint 3 — Daily features (26 Nov – 1 Dec) · spec M2

| # | Task | Owner |
|---|------|-------|
| 3.1 | Scheduler `daily-rollover` (cron `0 0 * * *`), on-install trigger, mod menu (create post, hide blend, load seed, reset epoch) | 🤖 |
| 3.2 | Archive mode (guess-only, banner + link to today) | 🤖 |
| 3.3 | Lazy crowd-sync bonus, streaks, daily + all-time leaderboards | 🤖 |
| 3.4 | Result card with live blend polling (10 s, paused when hidden) + next-step CTAs | 🤖 |
| 3.5 | Inline splash entrypoint (light bundle) | 🤖 |
| 3.6 | Journeys wrapper (Hono port of the telemetry router) + events | 🤖 |
| 3.7 | Seed loader + `seed/seed-days.json` | 🤖 placeholder data / 🧑 Fadhil real drawings |
| 3.8 | Request Journeys map approval | 🧑 |
| 3.9 | Leave app overnight → new post appears; returning user sees sync + streak 2 | 🧑 verify |

## Sprint 4 — Polish + playtest (2–5 Dec) · spec M3

| # | Task | Owner |
|---|------|-------|
| 4.1 | Blueprint visual pass, motion, reduced motion, first-time hints | 🤖 |
| 4.2 | Viewport fit at 360×640, 390×844, desktop; AA contrast audit | 🤖 (local harness + Playwright) |
| 4.3 | Tune GRID_SIZE / coverage / gamma / blur with playtest data | 🤖 + 🧑 |
| 4.4 | 15–20 playtesters, 2+ days, notes in `docs/PLAYTEST.md` | 🧑 Fadhil |
| 4.5 | Fix top bugs; flair streak (stretch, flag off by default) | 🤖 |

## Sprint 6 — Harder + social (added 19 Nov, owner request) · before the freeze

| # | Task | Owner | Status |
|---|------|-------|--------|
| 6a | Difficulty tiers by day (4→6 choices, 20→10 s, ×1→×2), server-timed focus-pull guess, speed scoring, coarse teaser before the clock | 🤖 | ✅ D-19…D-21 |
| 6b | Winners boards: 🔥 Streaks tab + "Yesterday's winners" podium | 🤖 | ✅ D-24 |
| 6c | 1v1 duels: share-sheet invite, 5 escalating rounds, realtime nudges + polling, duel history + wins | 🤖 | ✅ D-22 |
| 6d | Synthesised audio + mute toggle | 🤖 | ✅ D-23 |
| 6e | Harness + Playwright: every new screen at 360×640 / 390×844 / feed 360×400, 96 tests | 🤖 | ✅ |
| 6f | On real Reddit: share sheet + `getShareData` round trip, realtime between two devices, audio on iOS (silent switch) | 🧑 | ☐ |
| 6g | Tune tier timings / start blur / duel clocks with playtesters (`DIFFICULTY_TIERS`, `DUEL_ROUNDS`) | 🤖 + 🧑 | ☐ |

## Sprint 7 — Variety, music, polish, reach (added 20 Nov, owner request) · before the freeze

Built with the everything-claude-code skills (TDD workflow: tests first; frontend patterns).

| # | Task | Owner | Status |
|---|------|-------|--------|
| 7a | Question formats: Focus pull / Zoom out / Tile reveal rotate daily; duels add Pick the blend. Seed bank 7 → 35 shapes | 🤖 | ✅ D-25, D-26 |
| 7b | Synthesised background music (calm / tense) + 🎵 toggle | 🤖 | ✅ D-27 |
| 7c | Visual polish: living background, 3D buttons, entrances, confetti, count-ups, feed splash hook | 🤖 | ✅ D-29 |
| 7d | Reach: curiosity titles, pinned results thread with yesterday's winners, *Comment as u/name*, share link, `docs/GROWTH.md` | 🤖 | ✅ D-28 |
| 7e | Make the app account a mod in the home sub (pin needs it); check *Comment as u/name* after app approval | 🧑 | ☐ |
| 7f | Launch playbook: seed 20 playtesters, r/GamesOnReddit + r/Devvit showcase, mod outreach (`docs/GROWTH.md`) | 🧑 | ☐ |

### ❄️ Freeze — 6 Dec. Bug fixes only.

## Sprint 5 — Submission (6–7 Dec) · spec M4

| # | Task | Owner |
|---|------|-------|
| 5.1 | `npx devvit upload` (private). **Never `devvit publish`.** | 🧑 / 🤖 |
| 5.2 | Demo subreddit: description, rules, banner from CSS/canvas screenshots; pinned public demo post with a ≥15-drawing "yesterday" | 🧑 |
| 5.3 | `docs/SUBMISSION.md` finalised (URLs, 150-word description, how to play, Reddit-native features, stack) | 🤖 draft / 🧑 URLs |
| 5.4 | Devpost submission + optional survey | 🧑 |
