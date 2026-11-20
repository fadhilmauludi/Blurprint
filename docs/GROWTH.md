# Getting Redditors to play Blurprint

Blurprint's hook is visual: a glowing blur that **everybody can see but nobody can quite read**. The plan
below turns that curiosity into plays, then turns plays into comments, duels and a daily habit. Every
step respects Reddit's rules for apps and communities. Nothing here posts, comments or messages on anyone's
behalf without them pressing a clearly labelled button.

---

## 1. What is already built into the app

| Lever | How it works | Why it spreads |
|---|---|---|
| **Feed-stopping splash** | The post in the feed shows the animated blur with a big faint "?", a scan line, and the hook *"214 people drew the same thing. Can you tell what?"* plus today's level and format. | Curiosity gap: you can't scroll past a puzzle you almost understand. |
| **Curiosity titles** | `Blurprint #12 · Hard · Zoom out — can you read the crowd's blur?` | Titles show variety (level + format), so returning players see something new each day. |
| **Pinned results thread** | Every daily post gets an app comment, pinned, listing **yesterday's top 3** (names without `u/`, so nobody gets pinged). | Social proof at the top of the comments; winners come back to defend their spot. |
| **"Comment my result"** | In *📣 Share*, the player sees the exact spoiler-free text (`Blurprint #12 ◆◆◆ Hard · Zoom out / 🟦 Read the crowd in 3.2s (+130) / ✏️ Drew today's word · 🔥 5`) and taps **Comment as u/name**. It is posted as a reply in the pinned thread. Once a day. | Comments are what Reddit's ranking rewards; result grids invite "how did you get 3.2s?!" replies. |
| **Share link** | Native share sheet with the same text. | Brings in friends from group chats. |
| **1v1 duels** | Share-sheet invite with a deep link straight into a duel; 5 rounds mixing all 4 formats. | Every duel is a personal invitation, which converts far better than a public post. |
| **Streaks + boards** | 🔥 streak boards, yesterday's winners, all-time. | Habit and status. |
| **Community-made puzzles** | Tomorrow's puzzle is literally today's drawings. | "Come back to see what we drew" is built into the core loop. |

Rules we follow (and must keep following): score comments are **posted as the user, only from an explicit
button, as replies to a pinned comment, never required for anything** (Devvit user-action rules). Subscribe
is a separate button. No automated posting, no DMs, no voting.

> Until Reddit approves the app version, `runAs: 'USER'` comments are posted by the app account (playtest
> behaviour). Approval is needed before the comment button attributes results to players.

---

## 2. Launch plan (two weeks around the hackathon deadline)

### Week 0 — before the first public post
1. **Seed the crowd.** A blend needs ≥ 5 drawings, and it looks best with ≥ 15. Recruit 20 playtesters (team, friends,
   r/playtesters-style communities that allow it) for the first three days so every early visitor meets a
   readable blur.
2. **Home subreddit ready.** Create r/Blurprint (or similar): banner and icon made from real blend screenshots,
   sidebar with "how to play in 3 lines", a rule against posting spoilers in titles, and the app installed so the daily post
   appears at 00:00 UTC. Make the app account a moderator so the daily post and results thread can be pinned.
3. **Capture assets.** Record a 10-second screen capture of a tile reveal or zoom-out ending in "Nailed it! +130". This
   is the single best promo asset; use it in every showcase post.

### Week 1 — get the first 500 players
- **Reddit's own games channels first.** Post the game in **r/GamesOnReddit** (Reddit's home for Devvit games;
  ask about the *Games Launchpad* featured list) and the Devvit showcase threads in **r/Devvit**. These audiences
  want exactly this, and featured placement is the biggest single traffic source for Devvit games.
- **Showcase posts, not spam.** One post per community, following each sub's self-promo rules. Lead with the clip
  and the question ("214 people drew the same thing. What is it?"), and link the live daily post.
- **Show up in the comments.** Reply to every comment in the first days of the results thread, and ask
  for word suggestions. People come back for a dev who listens.
- **Timing.** Post showcases 14:00–17:00 UTC (US morning to Europe evening) so the crowd's drawing day overlaps both.

### Week 2 — make it a habit and spread it to other communities
- **Install it in other communities.** Blurprint is a Devvit app, so any subreddit's mods can install it. Reach out
  to mods of drawing/doodle, puzzle and casual-game communities with a short note (template below). Each install
  is a new daily post in a new feed, with its own crowd and its own puzzles.
- **Duel weekends.** Pin a post on Saturdays: "Duel the mods: send a challenge to u/... and beat their score." Duels need
  no extra code and are the strongest friend-to-friend loop.
- **Weekly recap (manual for now).** A Sunday post with the week's 7 blends side by side. Blends are beautiful
  together and remind people what they missed.

**Mod outreach template**

> Hi! I made Blurprint, a 2-minute daily drawing game that runs inside a Reddit post. Everyone draws the same
> secret word, and tomorrow the community's blurry average becomes the puzzle. It posts once a day, needs no setup,
> keeps drawings private (only the crowd average is shown), and has mod tools to hide a day's blend. Would you like
> to try it in r/____ for a week? Here's a live one: <link>.

---

## 3. What to measure (Devvit Journeys)

| Signal | Event(s) | Healthy target |
|---|---|---|
| Feed → play | `App.Ready` → `guess_started` | ≥ 35 % of opens start the clock |
| Finish rate | `guess_submitted` → `draw_submitted` | ≥ 70 % |
| Spread | `share_comment`, `share_link`, `duel_invite_shared` | ≥ 10 % of finishers share |
| Duels | `duel_created` → `duel_joined` | ≥ 30 % of invites accepted |
| Habit | streaks ≥ 3 on the 🔥 board | grows week on week |

Use the funnel to choose what to fix: weak feed → play means change the splash hook; weak finishing means shorten the clocks; weak spread
means make the Share button more prominent.

---

## 4. Later, once there is traction

- **Push notifications** (gated beta): Reddit selects established, engaged games. Once streaks are common, apply
  for streak reminders ("your 🔥 7 ends at midnight").
- **Custom share images** for each daily post (blend thumbnail in link unfurls) via the media upload API.
- **Seasonal word packs** (holidays, community-themed words for partner subreddits).
- **Streak flair** (`FEATURES.streakFlair`) once the app account has flair permissions in the home subreddit.
