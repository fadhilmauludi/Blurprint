# Progress

_Last updated: 19 Nov 2026 (Sprint 0–3 + Sprint 6 code complete; Sprint 4 polish started)._
Sprint plan: [`SPRINTS.md`](SPRINTS.md) · decisions: [`DECISIONS.md`](DECISIONS.md)

## Done

- **Sprint 0** — Official Devvit Web React template (0.15.4); every Devvit API verified from installed types/docs; project skill `.claude/skills/devvit-web`; scripts `typecheck`, `lint`, `test`, `check`, `gate`, `harness`.
- **Sprint 1** — Shared logic with tests: `normalize` (with stray-tap removal), `blend` (intensity, contrast-stretched display, cosine sync), `scoring` (points, streaks, milestones), `schedule` (day index, seeded no-repeat prompt cycle, same-group decoys), 72 prompts in 12 silhouette groups.
- **Sprint 2** — Server: services over a `Store` interface, all endpoints (§8.4 + `/api/splash`, `/api/hint`, `/api/forget`, `/api/subscribe`), typed `ApiError`s, `hSetNX` one-per-user guards, validation.
- **Sprint 3** — Scheduler rollover (+ hourly safety net), install trigger (seeds Days −2…0, creates Day 1), mod menu + forms (create post, hide blend, load seed, reset epoch), archive mode, lazy crowd sync, streaks, leaderboards, Journeys (Hono port), hourly deleted-account sweep, self-service delete.
- **Client** — Splash, Guess, Reveal (sharpen toggle), Intro (no blend yet), Draw (3-2-1, 20 s timer, pen/eraser/undo/clear, keyboard drawing), Result (live blend polling with your-cells flash, tabs for leaderboards, stats, CTAs, title block, About + delete data), archive banner, logged-out flow, skeleton loading, friendly errors.
- **Verification** — 77 unit/service tests; local harness (`npm run harness`) with a seeded multi-day scenario; Playwright run over every screen at 360×640, 390×844, 1280×800 and feed heights 390×480 / 360×400: **no overflow, no console errors**, one clean telemetry journey.

- **Sprint 6** (owner request: harder, audio, winners board, duels) — difficulty tiers by day, server-timed focus-pull guessing with speed scoring and timeouts, coarse teaser before the clock, 🔥 Streaks board + "Yesterday's winners", 1v1 duels (share-sheet invites, 5 escalating rounds, realtime + polling), synthesised SFX with a mute toggle. 96 tests; Playwright run of every new screen (incl. a full two-player duel and a timeout) — no overflow, no console errors; audio smoke test (sounds fire, mute silences them).

## Next (needs a human first)

1. 🧑 `npm run login` → create the app at developers.reddit.com/new named **blurprint** (or update `name` in `devvit.json`) → `npm run dev` in a private test subreddit.
2. 🧑 Check in a real post: splash → expand → guess → draw → result on iOS, Android, desktop.
3. 🧑 Request **Journeys** map approval (events are already wired).
4. 🧑 Duels on real Reddit: tap *Invite a friend* on one account, open the shared link on another (check the invite appears on the splash and in the game), play at the same time to see live marks (realtime), and once with one side offline.
5. 🧑 Collect real seed drawings (set `FEATURES.devTools = true` in a playtest build → "Copy" button on the result card) and replace `src/server/seed/seed-bank.json`; then `npm run gate` + the 2-of-3 recognisability test (26 Nov gate).

## Known issues / risks

- Seed bank is **placeholder** procedural data (see D-15).
- `subscribeToCurrentSubreddit` may need app review before it works; the button falls back to navigating to the subreddit.
- Not yet verified on a real Reddit client: expanded-mode sizing, `navigateTo` to the post's comments, sticky permissions for the app account.
- Not yet verified on a real Reddit client: `getShareData()` in the expanded `game` entrypoint (the splash → server hand-off covers it if not), realtime delivery, Web Audio on iOS with the silent switch on.
- Difficulty numbers are first guesses; tune them in playtests (Sprint 6g).
- `harness/` is not type-checked by `npm run typecheck` (dev-only tool).
