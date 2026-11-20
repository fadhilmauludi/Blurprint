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

### Sprint 6 — harder + more social (owner request, 19 Nov)

The owner found the guess too easy and asked for audio, a winners leaderboard (score or streak), progressive difficulty and 1v1 duels. These change the spec on purpose:

**D-19 · Difficulty tiers by day.** `DIFFICULTY_TIERS` in `config.ts`, chosen by the **post's day** so everyone faces the same puzzle on the same day (fair boards): Warm-up (Days ≤3: 4 choices, 20 s, ×1), Tricky (4–7: 5 choices, 16 s, ×1.25), Hard (8–14: 6 choices, 13 s, ×1.5), Expert (15+: 6 choices, 10 s, ×2). Every prompt group has 6 members, so 6 choices = the whole silhouette group. Spec §4.5 said "one guess, no timer" — replaced.

**D-20 · Timed "focus pull" guessing.** The player taps *Start the clock*; the server records the start (`day:N:guessStarts`, `hSetNX`, so a reload resumes the same clock). The blend starts at `startBlur` × the normal blur and sharpens with an **ease-in** curve to normal at the end of the clock, so it stays murky for most of the first half. Points = `100 × multiplier × speed`, where speed falls linearly from 1.0 to 0.5 over the clock, rounded to 5. No answer within the clock + `GUESS_GRACE_MS` (2.5 s network grace) = timeout: wrong, 0 points, counted in "% guessed right", drawing still allowed. Timing is server-side only; the client clock is display only.

**D-21 · Nothing to study before the clock.** Before *Start*, the client gets a **coarse teaser** (2×2 block averages, `TEASER_BLOCK`) and **no choices**. The splash also only receives the teaser. So the first real look at the blend is on the clock.

**D-22 · Duels (1v1).** `src/server/services/duelService.ts`. A player creates a duel (≤ 10/day) and shares the post with Reddit's share sheet (`showShareSheet({ data })`); the friend's client reads `getShareData()` (validated: only `{t:'duel', id:/^[a-z0-9]{10}$/}`). The splash hands the invite to the game view through `duel:invites` (the expanded view may not see the share data). Both players get the same 5 rounds, each harder (`DUEL_ROUNDS`: 4→6 choices, 12→8 s, more starting blur), with the same server-timed speed scoring. Round blends come from past public days and the seed bank, **never today's or yesterday's prompt** (yesterday's blend is today's puzzle). Async by default; when both are online, `realtime.send('duel_{id}', nudge)` makes the opponent's marks update instantly. Nudges carry no data — the client refetches, and polls every 4 s as a fallback. Unanswered rounds past their clock count as misses; a duel settles 24 h after the guest joins. Duels don't touch the daily leaderboards (keeps the daily fair); wins are counted on the user hash (`duelWins`). Duel records expire after 7 days and are deleted by "Delete my data".

**D-23 · Audio is synthesised.** `src/client/audio.ts`: every sound is a few Web Audio oscillator notes (no files, no network, nothing AI-generated). Created lazily inside a user gesture; mute toggle in the top bar, remembered in `localStorage` (falls back to session-only if storage is blocked).

**D-24 · Winners boards.** Result tabs are now Blend / Today / 🔥 Streaks / All-time. *Streaks* ranks today's artists by their streak (`lb:streak:N`, written when they draw, 30-day TTL). *Today* opens with "Yesterday's winners" (top 3 of `lb:day:N−1`).

### Sprint 7 — variety, music, polish, reach (owner request, 20 Nov; built with the everything-claude-code TDD + frontend-patterns skills)

**D-25 · Question formats.** `src/shared/formats.ts`. The daily puzzle rotates how the blend is revealed: *Focus pull* (Days ≤ 3, then every third day), *Zoom out* (starts zoomed into one patch at `startZoom`× and pulls back), *Tile reveal* (a 4×4 cover; 3 tiles open at the start, the rest flip open ease-in until all are open at the end). Never the same format two days running; all three every three days. Format + seed are chosen by the server and shared by everyone that day. Duels mix all of them plus *Pick the blend* (given the word, choose its blur out of four); round 1 is always a focus pull. Pick-round option ids are opaque (`o0…o3`) and the answer's blend is never sent on its own, so the client can't match the word to an option by id or data.

**D-26 · Seed bank: 7 → 35 shapes.** `tools/seedShapes.ts` (shared by `make-seed` and the demo) gets 28 more silhouettes, at least one per prompt group. New shapes are appended so the original 7 prompts' drawings stay byte-identical (verified). Still placeholder data (D-15); it mainly gives duels and "pick the blend" enough distinct blends. Contact sheet via `npm run gate`.

**D-27 · Background music is synthesised.** `src/client/music.ts`: an A-minor loop (Am–F–C–G) with pad, bass and plucked arpeggio, built from Web Audio oscillators with a look-ahead scheduler. *Tense* mood (guess clock, drawing timer, duel round) raises tempo 84 → 108 BPM, doubles the arpeggio and adds a hi-hat. Starts on the first tap (autoplay rules), pauses when the tab is hidden, own 🎵 toggle (remembered), separate from 🔊 sound effects. No files, no network, nothing AI-generated.

**D-28 · Reach on Reddit.** (a) Daily post titles carry level + format: `Blurprint #12 · Hard · Zoom out — can you read the crowd’s blur?`. (b) Each daily post gets an app-account comment, distinguished and stickied, as the *results thread*, listing yesterday's top 3 by name **without `u/`** (no pings). Pinning is best effort and never blocks the post. (c) *📣 Share → Comment as u/name* replies to that thread **as the user** (`submitComment({ runAs: 'USER' })`, permission `asUser: SUBMIT_COMMENT`), following the Devvit user-action rules: explicit labelled button, exact preview shown, text built server-side from stored results (never from the client), no spoilers, once per day, never required for anything, separate from gameplay. Until Reddit approves the app version, these comments come from the app account (playtest behaviour). (d) *Send the link* uses the share sheet with the same text. Launch playbook in `docs/GROWTH.md`. Push notifications are a gated beta for established games, so they are listed for later rather than built.

**D-29 · Visual polish.** `src/client/styles/polish.css`: drifting blueprint grid (one fixed layer, transform-only), soft glows, 3D press buttons with a shine sweep, staggered screen entrances, choice pop-in, glow on correct / shake on wrong, confetti (canvas, no assets) on correct answers, duel wins and streak milestones, and count-up scores. The feed splash leads with a curiosity hook ("214 people drew the same thing. Can you tell what?"), level + format chips, and an animated "breathing" teaser with a scan line and a faint "?". All motion is off under `prefers-reduced-motion`.

**D-30 · Word bank: 72 → 167 words, in seasons.** `src/shared/prompts.ts`. Season 1 (the original 72 words) is frozen; season 2 adds 95 words: more in every group, plus four new silhouette groups (*wheels*, *many-legs*, *clothes*, *boxy*). Every group has at least 7 words, so the hardest levels (6 choices) always have real decoys. Each season is shuffled on its own and played after the one before (`getShuffledBank`), so days 1–72 are exactly as before (a test pins the order). Pre-launch seed days (≤ 0) still count back from the end of season 1 (heart, crown, sun), the words the seed drawings ship for. A daily player now meets about 5½ months of words before a repeat. Decoys for season-1 days can now come from the new words in the same group.

**D-31 · Removing a single crude drawing.** Mod menu *Blurprint: remove a crude drawing* (`/internal/menu/remove-drawing`, form `removeDrawingForm`). The app ranks the day's stored drawings by *agreement* (the mean share of the other players who filled each of its cells, `src/shared/moderation.ts`) and takes the lowest 1–5 out of the blend: their cells and the day total are decremented, and the bits are parked in `day:N:removed` (same 30-day TTL) for undo and so they're never subtracted twice (`hSetNX`; `forgetUser` skips them). A tick box puts them back. Moderators never see individual drawings (drawings stay private), and the player keeps their streak and still sees what they drew. Works while drawings are stored (~30 days); coordinated shapes are still handled by hiding the blend.

---

## Devvit Rules compliance

| Rule | How Blurprint meets it |
|------|------------------------|
| Limited in-app expression for UGC | Only a 10×10 on/off grid; no text input. Individual drawings are never shown to anyone but their author; only aggregates (≥ 5 drawings) are public. Mods can hide any day's blend. |
| Respect user deletions — account deletion | Hourly `purge-sweep` walks the player index (`lb:all`) in batches and removes all data for accounts `getUserById` no longer returns, including subtracting their drawings from blends. |
| Users can remove their own content | "About → Delete my Blurprint data" calls `/api/forget` (same purge, including duels, streak boards and guess clocks). |
| Auto-deletion ≤ 30 days | All per-user per-day hashes and daily boards expire after 30 days; duels after 7. |
| Subscribe actions explicit, never gating | "Join r/…" is a separate, labelled button on the result card, never required. Duel invites only open the share sheet when the player taps *Invite a friend*. |
| Posting/commenting as the user | Only *Comment as u/name* in the Share sheet: explicit, previewed, labelled with the username, a reply to the pinned results thread, once a day, never required (D-28). No posts as the user. |
| Data minimisation / no PII in telemetry | Only userId/username (for one-per-day and leaderboard display). Telemetry fields contain day numbers and enums only. |
| No external requests | None (client or server). Realtime is a Devvit plugin; audio is synthesised locally. |
| No Reddit IP / AI art | All visuals are CSS/canvas; no Snoo, no generated art. |
| Don't publish | `npm run launch` removed; only `npm run dev` / `npm run upload`. |

---

## Gate (26 Nov) — status

- Automated part: `npm run gate` renders every seeded prompt's blend to `docs/gate/*.png`.
  With the **placeholder** data: heart ✓ clearly recognisable, ghost ✓ (eyes visible), raindrop ✓, crown ~ (needs real drawings), sun ✗ (rays are too thin at 10×10). Only Day 0 (heart) is ever guessed at launch (Day 1's post); Days −2/−1 have no posts, so sun/crown only matter as general readability signals.
- Human part (still to do): 10 real drawings × 3 prompts, a teammate picks from the 4 choices, need ≥ 2/3.
- Decision: **Plan A (provisional)** — pending the human recognisability test.
