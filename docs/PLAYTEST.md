# Playtest log

## Manual test matrix (spec §9)

| Scenario | iOS app | Android app | Desktop Chrome | Desktop Safari/Firefox | Notes |
|----------|---------|-------------|----------------|------------------------|-------|
| Splash in feed (inline) | ☐ | ☐ | ☐ | ☐ | |
| Small phone (360 wide) | ☐ | ☐ | — | — | harness ✓ 360×640 |
| Logged-out view | ☐ | ☐ | ☐ | ☐ | harness ✓ |
| First-time user (hints) | ☐ | ☐ | ☐ | ☐ | harness ✓ |
| Returning user mid-day (sees result) | ☐ | ☐ | ☐ | ☐ | harness ✓ |
| Returning user next day (sync + streak 2) | ☐ | ☐ | ☐ | ☐ | harness ✓ (alice) |
| Archive post | ☐ | ☐ | ☐ | ☐ | harness ✓ |
| Timer runs out under 3 squares | ☐ | ☐ | ☐ | ☐ | harness ✓ |
| Rollover overnight creates post | ☐ | | | | |
| Reduced motion on | ☐ | ☐ | ☐ | ☐ | |
| Guess clock: early guess scores more; reload mid-clock resumes | ☐ | ☐ | ☐ | ☐ | harness ✓ |
| Guess clock runs out → timeout reveal, can still draw | ☐ | ☐ | ☐ | ☐ | harness ✓ |
| Tier 3 (6 choices) fits on a small phone | ☐ | ☐ | — | — | harness ✓ (`reset?today=9`) |
| Duel: invite via share sheet → friend opens link → accepts | ☐ | ☐ | ☐ | ☐ | harness ✓ (`?duel=<id>`) |
| Duel: both online, opponent marks update live | ☐ | ☐ | ☐ | ☐ | realtime not simulated locally |
| Sound on/off, remembered after reload; iOS silent switch | ☐ | ☐ | ☐ | ☐ | harness ✓ (headless smoke test) |

## Local harness

```
npm run harness
```
Open `http://localhost:5199/game.html?user=alice` (also `user=bob|newbie|anon`, `post=1` for archive,
`/splash.html` for the feed view). `POST /__harness/reset` rebuilds the scenario; `?today=9` jumps to
tier "Hard". Duel invites: open `game.html?user=bob&duel=<id>` (the id is in the toast after *Invite a friend*).

## Tuning knobs (src/shared/config.ts)

`GRID_SIZE`, `COVERAGE_THRESHOLD`, `STRAY_MAX_SHARE`, `BLEND_GAMMA`, `BLEND_FLOOR`, `BLEND_BLUR_PX`,
`DIFFICULTY_TIERS` (choices / clock / start blur / multiplier per tier), `MIN_SPEED_FACTOR`, `TEASER_BLOCK`, `DUEL_ROUNDS`.

## Session notes

_(Fadhil: one section per playtest day — testers, what confused them, blend recognisability, bugs.)_
