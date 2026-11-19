# Decisions log

Every place the build differs from `BLURPRINT_BUILD_SPEC.md`, or where the spec said "check this",
is recorded here with the source. Devvit version verified: **0.15.4** (template `reddit/devvit-template-react`, commit of 17 Nov 2026).

---

## §14 Verify-before-use — answers

| # | Question | Answer (source) |
|---|----------|-----------------|
| 1 | `devvit.json` schema | Verified against `node_modules/@devvit/shared-types/schemas/config-file.v1.json`; our `devvit.json` validates against it (ajv). Keys used: `post.dir`, `post.entrypoints.{default,game}.{entry,height,styles}`, `server.{dir,entry}`, `permissions.{redis,journeys,reddit.asUser}`, `scheduler.tasks.*.{endpoint,cron}`, `menu.items[]`, `forms`, `triggers.onAppInstall`. `inline` on entrypoints is deprecated (every entrypoint renders inline; any can be expanded). |
| 2 | Current user / post / subreddit on the server | `context` from `@devvit/web/server`: `userId?: T2`, `username?`, `postId?: T3`, `postData?`, `subredditName`. We never read identity from the body. (`shared-types/shared/baseContext.d.ts`) |
| 3 | Custom post creation, splash, sticky | `reddit.submitCustomPost({ title, entry, postData (≤2 KB), textFallback, styles })` → `Post` with `sticky(1..4)` / `unsticky()`. The "splash" is simply the `default` entrypoint (`splash.html`). (`reddit/models/Post.d.ts`) |
| 4 | Inline → expanded | `requestExpandedMode(trustedMouseEvent, 'game')` from `@devvit/web/client`; `getWebViewMode()` returns `'inline'|'expanded'`. (`client/effects/web-view-mode.d.ts`) |
| 5 | Redis support | Strings, numbers, hashes, sorted sets, bitfield, expire, watch/multi/exec. **No** sets, lists, scans or pipelining. `set(..., { nx })` exists but its return value on an NX miss is undocumented → we use `hSetNX` (returns 1/0). Limits: 100 MB storage for unpublished apps, 5 MB request. (`docs/capabilities/server/redis.mdx`, `redis/types/redis.d.ts`) |
| 6 | Journeys | Permission `"journeys": true`. Client `telemetry` from `@devvit/analytics/client/reddit` (`appReady`, `startJourney`, `progress`, `interaction`, `endJourney`). Fixed core events; custom data only via `action` / `actionDetails` strings and `game { win, score }`. Events are dropped until Reddit approves the journey map. (`docs/capabilities/analytics/devvit-journeys.md`) |
| 7 | Comments / subscribe / flair | Comments: no API to focus the comment box → `navigateTo(postPermalink)`. Subscribe: `reddit.subscribeToCurrentSubreddit()` runs as the user and needs `permissions.reddit.asUser: ["SUBSCRIBE_TO_SUBREDDIT"]`; Devvit Rules require an explicit button, never a condition for progress. Flair: `reddit.setUserFlair({ subredditName, username, text })`, needs the app account to have mod flair permissions → behind `FEATURES.streakFlair` (off). |
| 8 | Fonts / assets | The client may not request any host other than the webview domain (CSP). No font CDNs → system font stacks only (`--font-body`, `--font-mono`). All visuals are CSS/canvas. |
| 9 | Devvit Rules that matter | See "Devvit Rules compliance" below. |

---

## Numbered decisions

**D-01 · Node version.** Spec says Node 22. The current template pins Node 24 (`.nvmrc 24.18.0`, CI on 24). We kept `.nvmrc` at 24 and set `engines.node` to `>=22.2.0` so both work; development and CI use 24.

**D-02 · Code style.** Template rules (AGENTS.md): type aliases over interfaces, named exports, no type casts. The data contract in `src/shared/types.ts` follows the spec's shapes but as `type` aliases.

**D-03 · Plain CSS, no Tailwind.** Spec asks for plain CSS with tokens; the template's Tailwind was removed.

**D-04 · Services take a `Store` interface.** `Store = Pick<RedisClient, …>`. Production passes Devvit `redis`; tests and the local harness pass `MemoryStore` (same semantics for the commands used). This is what lets us test idempotency, archive mode, streaks and privacy without Reddit.

**D-05 · Normalization rules.** As spec §4.3 plus two defined behaviours: (a) a single cell scales to fill the grid (it never reaches the server because `MIN_CELLS = 3`); (b) **stray-tap removal**: isolated cells (no filled 8-neighbour) are dropped before cropping when they are ≤ `STRAY_MAX_SHARE` (15 %) of the drawing and ≥ 2 cells remain. Without (b) a single accidental tap in a corner shrinks the whole drawing and muddies the blend. Dotted drawings are preserved. Unit-tested.

**D-06 · Display contrast stretch.** Spec: `d = v ^ 0.8`. With realistic data that left everything a washed-out cyan. The display now divides by the day's peak agreement, fades anything under `BLEND_FLOOR` (20 % of peak) to the background, then applies gamma. Stored data is unchanged (raw counts); only rendering changed. Gate renders in `docs/gate/`.

**D-07 · Redis key schema.** Per-user per-day data lives in **per-day hashes** (`day:{N}:drawings|guesses|syncs`, field = userId) instead of per-user string keys: `hSetNX` gives a verified atomic one-per-user guard, and one `expire` per day deletes everything after 30 days. Added `config:rolloverLocks` (hash, per-day creation lock), `config:seedLoaded`, `config:purgeCursor`. All builders in `src/server/redisKeys.ts`.

**D-08 · TTL 30 days, not 60.** Devvit Rules recommend deleting stored user data within 30 days. `day:{N}:cells/total` (aggregates) are kept for archive mode.

**D-09 · Lazy crowd sync window.** Sync for day N−1 is awarded the first time the player opens **day N's** post (as specced). A player who skips a day doesn't get the bonus later. Sync requires the final blend to have ≥ `MIN_BLEND_DRAWINGS` (otherwise a lone drawer would score 100 % against themself).

**D-10 · Journeys router.** The SDK only ships an Express router (`createTelemetryRouter`). The template uses Hono, so `src/server/routes/telemetry.ts` is a line-by-line Hono port that calls the public server `telemetry` client. Mounted at `/api/telemetry` (the client's default base path). Mapping: `session_start`, `result_viewed`, `cta_*`, `leaderboard_viewed`, `draw_timeout`, `streak_milestone` → `Journey.Interaction`; `guess_submitted` (0.3), `draw_started` (0.5), `draw_submitted` (0.8) → `Journey.Progress`; result → `Journey.End { complete, game { win, score } }`. `Journey.Start` fires on the first committed action (a guess or "Draw today's"), never on load, per the Journeys guidelines.

**D-11 · Logged-out viewers** see the guess screen (blend + choices). Tapping a choice opens the login prompt. They never receive today's prompt.

**D-12 · Result screen layout.** To keep the hero blend large on a 360×640 phone with no scrolling, the leaderboard lives behind tabs above the hero (Live blend / Today / All-time) instead of under it. Rank is always visible in the stats row.

**D-13 · `--bp-red` lightened** from `#FF6B6B` (3.6:1 on `#0B3D91`, fails AA) to `#FFA3A3` (5.3:1). All token pairs are listed with ratios in `src/client/styles/tokens.css`.

**D-14 · Shuffle seed.** `PROMPT_SHUFFLE_SEED = 0xB119AC`, chosen by search so the launch days are iconic shapes: Day −2 sun, −1 crown, **0 heart** (the first "yesterday" players see), 1 ghost, 2 raindrop.

**D-15 · Seeding on install.** The install trigger loads seed drawings for Days −2…0 automatically (idempotent) so Day 1 always has a "yesterday" to guess; the mod menu can load any other range. **The current seed bank is procedural placeholder data** (`tools/make-seed.ts`) — it must be replaced with real team/playtester drawings before submission (enable `FEATURES.devTools` for the "Copy drawing" button).

**D-16 · Rollover safety net.** Besides `0 0 * * *`, an hourly `15 * * * *` task calls the same idempotent rollover, so a missed midnight job self-heals within the hour.

**D-17 · Timed out with too few cells.** Recorded as `"timeout"` in the day's drawings hash: the day is finished, the guess points stand, no drawing / streak / points for drawing (spec §6.3 D).

**D-18 · Archive guesses** don't touch `guessStats`, leaderboards or totals ("counts for nothing else").

---

## Devvit Rules compliance

| Rule | How Blurprint meets it |
|------|------------------------|
| Limited in-app expression for UGC | Only a 10×10 on/off grid; no text input. Individual drawings are never shown to anyone but their author; only aggregates (≥ 5 drawings) are public. Mods can hide any day's blend. |
| Respect user deletions — account deletion | Hourly `purge-sweep` walks the player index (`lb:all`) in batches and removes all data for accounts `getUserById` no longer returns, including subtracting their drawings from blends. |
| Users can remove their own content | "About → Delete my Blurprint data" calls `/api/forget` (same purge). |
| Auto-deletion ≤ 30 days | All per-user per-day hashes and daily boards expire after 30 days. |
| Subscribe actions explicit, never gating | "Join r/…" is a separate, labelled button on the result card, never required. |
| No posting/commenting as the user | We don't. "Argue in the comments" only navigates to the post. |
| Data minimisation / no PII in telemetry | Only userId/username (for one-per-day and leaderboard display). Telemetry fields contain day numbers and enums only. |
| No external requests | None (client or server). |
| No Reddit IP / AI art | All visuals are CSS/canvas; no Snoo, no generated art. |
| Don't publish | `npm run launch` removed; only `npm run dev` / `npm run upload`. |

---

## Gate (26 Nov) — status

- Automated part: `npm run gate` renders every seeded prompt's blend to `docs/gate/*.png`.
  With the **placeholder** data: heart ✓ clearly recognisable, ghost ✓ (eyes visible), raindrop ✓, crown ~ (needs real drawings), sun ✗ (rays are too thin at 10×10). Only Day 0 (heart) is ever guessed at launch (Day 1's post); Days −2/−1 have no posts, so sun/crown only matter as general readability signals.
- Human part (still to do): 10 real drawings × 3 prompts, a teammate picks from the 4 choices, need ≥ 2/3.
- Decision: **Plan A (provisional)** — pending the human recognisability test.
