# Untrace - Player Progression Guide

## First Launch Flow

```
App Opens
    │
    ▼
Splash Screen (2 sec, logo animation)
    │
    ▼
Main Menu (logo + "Tap to Begin" button)
    │
    ▼ player taps
    │
Audio unlocks, bg music starts
    │
    ▼
Tutorial (5 steps, separate from levels)
    │
    Step 1: Single line - hand shows swipe to erase
    Step 2: L-shape - teaches continuous tracing
    Step 3: Accidental draw - player discovers on their own
    Step 4: 2-layer connection - hand shows double pass
    Step 5: Mini puzzle - no hints, player solves alone
    │
    ▼ tutorial complete
    │
Level Select Screen
    Player starts with: 5 sparks, 0 stars
    Level 1 is unlocked, levels 2-30 are locked
```

## Returning Player Flow

```
App Opens
    │
    ▼
Splash Screen (2 sec)
    │
    ▼
Main Menu ("Tap to Begin")
    │
    ▼ player taps
    │
Level Select Screen (tutorial skipped)
    │
    ├─ If mid-level save exists:
    │     Player taps that level
    │     "Resume where you left off?" dialog
    │     Resume or Restart
    │
    └─ Otherwise:
          Player taps any unlocked level
          Level intro animation plays
          Gameplay begins
```

---

## Stars

### What are stars?
Stars measure how well you solved a level. Better performance = more stars.

### How many per level?
Every level awards 1, 2, or 3 stars on completion:

| Stars | Condition |
|-------|-----------|
| 3     | Completed at or below par (solver's minimum moves) |
| 2     | Completed within par + max(2, par * 0.5) moves |
| 1     | Completed at all (any move count) |

**Example:** Level has par of 8 moves.
- 8 or fewer moves = 3 stars
- 9-12 moves = 2 stars  
- 13+ moves = 1 star

### What do stars unlock?
Stars are the keys to new worlds (star-gate system):

| World | Stars Required | Max Possible Stars Before |
|-------|---------------|--------------------------|
| 1     | 0 (free)      | -                        |
| 2     | 30            | 90 (from World 1: 30 levels x 3 stars) |
| 3     | 80            | 180 (from Worlds 1-2) |
| 4     | 140           | 270 (from Worlds 1-3) |

### Where stars appear
- Level select: under each completed level (only earned stars shown)
- Level select top bar: total star count
- Celebration popup: animated star reveal after winning

### Can you improve stars?
Yes. Replay any completed level. If you get more stars, the higher count replaces the old one. Stars never decrease.

---

## Sparks

### What are sparks?
Sparks are the in-game currency. Used ONLY for hints. Nothing else.

### Starting amount
**5 sparks** on first launch.

### How to earn sparks

| Method | Amount | Limit |
|--------|--------|-------|
| Complete 3 levels (any stars) | +1 spark | Unlimited (cumulative) |
| 3-star a level you previously had 1-2 stars | +1 spark | Once per level |
| Watch a rewarded video ad | +1 spark | 3 per day (resets midnight) |
| Daily puzzle completion | +1 spark | 1 per day (future feature) |
| Buy spark pack | 5/15/40 | Unlimited |

### How to spend sparks

| Hint | Cost | What it does |
|------|------|-------------|
| Hint 1: Starting dot | 1 spark | Shows which dot to start on. Stays visible until level solved/reset. |
| Hint 2: First 3 moves | 1 spark | Animates the first 3 moves. Replayable for free after purchase. |
| Hint 3: Full solution | 2 sparks | Animates the entire solution. Replayable for free after purchase. |

**Total to fully hint a level: 4 sparks**

### Hint rules
- Hints are per-level (buying on level 5 doesn't affect level 6)
- Must buy in order (1 before 2, 2 before 3)
- Hint 1 persists until level solved or reset
- Hints 2 and 3 can be replayed unlimited times after purchase
- All hints reset when level is solved or manually reset

### Where sparks appear
- Level select top bar: spark counter (lightning bolt icon)
- Level select: "+" button on spark chip (opens shop, future)
- Hint popup during gameplay: shows remaining sparks
- Celebration popup: "+1 Spark!" badge when earned

### Sparks do NOT
- Expire or decay
- Regenerate on a timer
- Buy cosmetic themes
- Buy ad removal
- Skip levels or unlock worlds

---

## Ads

### Types of ads

| Ad Type | When | Who Sees It | Frequency |
|---------|------|-------------|-----------|
| Interstitial (full screen) | Between levels | Free tier only | Every 3-4 levels |
| Rewarded video (opt-in) | Hint popup | Everyone (free + premium) | Player chooses, max 3/day |

### Ad rules
- Never during gameplay
- Never on app launch
- Load ads only after first user interaction (after "Tap to Begin")
- Premium users never see interstitials
- Rewarded videos are always optional, never forced

---

## Purchases (IAP)

### What can you buy?

| Item | Price | Type | What it does |
|------|-------|------|-------------|
| Remove Ads | $3.99 | One-time | Removes all interstitial ads forever. Rewarded video ads still available (player choice). Unlocks access to Worlds 3+ (star-gate still applies). |
| 5 Sparks | $0.99 | Consumable | Adds 5 sparks |
| 15 Sparks | $1.99 | Consumable | Adds 15 sparks |
| 40 Sparks | $3.99 | Consumable | Adds 40 sparks |
| Hacker Theme | $0.99 | One-time | Dark/green visual theme |
| Neon Theme | $0.99 | One-time | Dark/bright visual theme |
| Paper Theme | $0.99 | One-time | Sketch/pencil visual theme |
| Ocean Theme | $0.99 | One-time | Blue/teal visual theme |

### Where to buy
- **Settings screen:** "Shop" section with all three categories
- **Hint popup:** "Get more" button when out of sparks
- **After interstitial ad:** brief "Remove ads forever - $3.99" banner
- **Celebration popup:** occasional "Customize your look" theme prompt (every ~10th 3-star level)

### Purchase rules
- No popup on app launch
- No blocking purchase screens
- No fake urgency or countdown timers
- Store is always optional
- Cosmetic themes are separate from sparks (cannot buy themes with sparks)

---

## Level Progression

### Within a world

```
Level 1 (unlocked)
    │ complete it
    ▼
Level 2 (unlocked)
    │ complete it
    ▼
Level 3 (unlocked)
    │ ...
    ▼
Level 30 (last in World 1)
    │ complete it
    ▼
World 2 divider chip (on the same scrollable path)
    │ need 30+ total stars to unlock
    ▼
World 2 Level 1 (unlocked if stars met)
    │ ...continues down
```

- Completing level N unlocks level N+1
- You can replay any completed level anytime
- You can skip ahead only by completing levels in order

### Between worlds (single continuous path)

All worlds are on ONE scrollable path. No world switcher, no tabs.

```
[World 1 chip]
    Level 1
    Level 2
    ...
    Level 30
[World 2 chip - "30 stars to unlock" or unlocked]
    Level 31
    Level 32
    ...
    Level 55
[World 3 chip - "80 stars to unlock" or unlocked]
    Level 56
    ...
```

- Scroll up = revisit earlier worlds
- Scroll down = see later worlds
- World divider chips show lock status and star requirements
- When a world unlocks, celebration popup announces it, level select auto-scrolls to reveal the new section

```
World 1 (free, 30 levels, always open)
    │
    │ 30 stars needed
    ▼
World 2 (free tier, 25 levels)
    │
    │ 80 stars needed + premium purchase
    ▼
World 3 (premium only, 25 levels)
    │
    │ 140 stars needed + premium purchase
    ▼
World 4 (premium only, 25 levels)
```

### Free vs Premium content

| | Free Tier | Premium ($3.99) |
|---|-----------|----------------|
| World 1 | Yes | Yes |
| World 2 | Yes | Yes |
| Worlds 3+ | No | Yes (still need stars) |
| Interstitial ads | Every 3-4 levels | None |
| Rewarded video ads | Yes (for sparks) | Yes (for sparks) |
| Spark packs | Can buy | Can buy |
| Themes | Can buy | Can buy |

---

## Economy Math

### How fast do players earn sparks organically?

A player completing World 1 (30 levels) earns:
- Starting sparks: 5
- From level completions: 30 / 3 = 10 sparks
- From improving stars: varies, assume 5 levels replayed = 5 sparks
- **Total: ~20 sparks without ads or purchases**

20 sparks = enough hints for 5 fully-hinted levels (4 sparks each)

### How many hints does a player need?

Casual players: hints on ~20% of levels = 6 levels in World 1
- If only Hint 1 each: 6 sparks
- If Hint 1+2 each: 12 sparks
- If full hints: 24 sparks

So 20 organic sparks covers most casual players. Heavy hint users will watch ads or buy the $0.99 pack.

### Rewarded ad value

3 ads/day x 1 spark each = 3 sparks/day
A play session is typically 15-30 minutes.
3 free sparks per session is generous enough to not feel stingy, scarce enough that packs have value.

---

## Complete Session Example

```
Player opens app (Day 3, returning player)
    │
    ▼
Splash (2 sec) → Main Menu → Tap to Begin
    │
    ▼
Level Select (has 18 stars, on Level 7)
    │
    ▼
Taps Level 7 → intro animation → gameplay
    │
    ├─ Solves in 10 moves (par: 8) → 2 stars
    │  Celebration: "Well done!" ★★☆
    │  "+1 Spark!" (just completed 3rd level this session)
    │  Taps "Next Level"
    │
    ▼
Level 8 → gets stuck after 15 moves
    │
    ├─ Taps hint button (lightbulb)
    │  Popup: "Need a hint?" (4 sparks remaining)
    │  Buys Hint 1 (1 spark) → starting dot pulses
    │  Continues playing → solves in 12 moves → 1 star
    │
    ▼
Level 9 → interstitial ad plays (every 3-4 levels)
    │  Small banner: "Remove ads forever - $3.99"
    │  Player dismisses, continues to level 9
    │
    ▼
Level 9 → totally stuck
    │
    ├─ Taps hint button
    │  Buys Hint 1 (1 spark) → still stuck
    │  Buys Hint 2 (1 spark) → watches first 3 moves, replays twice
    │  Continues → solves → 1 star
    │  (1 spark remaining)
    │
    ▼
Taps "Back to Levels" → level select
    │  Goes back to replay Level 7 for 3 stars
    │  Gets 3 stars → "+1 Spark!" (star improvement bonus)
    │
    ▼
Exits app. Progress saved.
```
