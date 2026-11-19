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

## Local harness

```
npm run harness
```
Open `http://localhost:5199/game.html?user=alice` (also `user=bob|newbie|anon`, `post=1` for archive,
`/splash.html` for the feed view). `POST /__harness/reset` rebuilds the scenario.

## Tuning knobs (src/shared/config.ts)

`GRID_SIZE`, `COVERAGE_THRESHOLD`, `STRAY_MAX_SHARE`, `BLEND_GAMMA`, `BLEND_FLOOR`, `BLEND_BLUR_PX`.

## Session notes

_(Fadhil: one section per playtest day — testers, what confused them, blend recognisability, bugs.)_
