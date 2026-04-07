# CLAUDE.md — Untrace

## Project Overview

Untrace is a dot-grid puzzle game where players trace over pre-drawn layered lines to erase them. Tracing empty connections accidentally draws new lines. Two level types: "clear" levels (erase everything) and "reduce" levels (minimize remaining lines to a target). Intentional drawing as a strategy is exclusive to reduce levels since bridge lines always leave residual layers. Web-first, then wrapped for iOS/Android via Capacitor.

**Progression:** Levels are sequential within worlds. Worlds are locked behind cumulative star counts (star-gate system). Players earn 1-3 stars per level based on move efficiency. Rushing with 1-star completions won't unlock later worlds, encouraging replaying levels for better scores.

## Stack

- **Build:** Vite
- **Language:** TypeScript (strict mode)
- **Rendering:** Canvas 2D (no WebGL, no DOM-based game rendering)
- **Audio:** Tone.js (xylophone samples from nbrosowsky CDN for marimba, plus mp3 sound effects: pop.mp3, board.mp3)
- **Styling (UI chrome only):** CSS (no Tailwind, no CSS framework). Game board is pure Canvas.
- **Deploy:** Vercel (static)
- **Testing:** Vitest for unit tests on game logic and solver
- **No frameworks:** No React, no Vue. Vanilla TypeScript. DOM manipulation only for UI chrome (menus, settings, overlays).

## Project Structure

```
untrace/
  src/
    main.ts              # Entry point, splash screen, game loop, level loading
    types.ts             # Shared type definitions
    constants.ts         # Colors, sizes, timing values, all tunable numbers
    engine/
      state.ts           # GameState interface and state management
      input.ts           # Touch/pointer input handling, dot snapping, path interpolation
      logic.ts           # Erase/draw logic, win detection, undo/redo
      renderer.ts        # Canvas 2D rendering (grid, dots, lines, animations)
      animations.ts      # Animation queue and easing utilities
      intro-animation.ts # Level intro: board fade, dot pop, line draw
    audio/
      audio.ts           # Tone.js setup, marimba sampler, progress notes, sound effects
    levels/
      levels.ts          # Level loading and level data types
      test-levels.ts     # Hardcoded Phase 1 test levels
    ui/
      overlay.ts         # In-game UI (undo/redo, move counter, reset, back button)
      settings.ts        # Settings panel (volume, colorblind, reset progress)
      level-select.ts    # Level select screen with star display and unlock progression
      celebration.ts     # Win celebration with stars, varied messages, world unlock
      level-transition.ts # Splash between levels ("Level 7 / Corner")
      tutorial.ts        # 5-step guided tutorial with hand animation and forced starts
    solver/
      solver.ts          # BFS puzzle solver with Euler parity analysis
      worker.ts          # Web Worker wrapper for solver
  tools/
    designer/            # Puzzle designer web tool
    color-tuner/         # Real-time color palette editor
    font-tuner/          # Real-time typography editor
  public/
    levels/world1.json   # World 1 level data
    untrace-logo.svg     # Animated dot-and-line logo
    splash-animation.css # SVG stroke-dashoffset animation for logo
    pop.mp3              # Dot appear sound
    board.mp3            # Board fade-in sound
    hand.svg             # Tutorial hand pointer
  index.html
  vite.config.ts
  tsconfig.json
  package.json
```

## Key Rules

1. **One file per prompt.** Every prompt targets exactly one file. Name the file explicitly. End every prompt with "Change nothing else."
2. **Never rename, delete, or move files** unless the prompt explicitly says to.
3. **All tunable numbers live in `constants.ts`.** Colors, sizes, timing values, radius thresholds, animation durations, audio pitches. Never hardcode magic numbers in other files.
4. **State is authoritative, rendering is cosmetic.** The game state in `state.ts` is the single source of truth. The renderer reads state and draws it. Animations are overlays that never block input or mutate state.
5. **Input handling never mutates state directly.** Input events produce "intents" (e.g., "player moved to dot [1,2]"). The logic module in `logic.ts` processes intents and returns a new state.
6. **Canvas only for the game board.** Menus, settings, overlays, and level select are DOM elements positioned over the canvas. Do not render UI text or buttons on the canvas itself.
7. **Minimal external assets.** Game visuals are drawn on canvas. Audio uses Tone.js xylophone samples from nbrosowsky CDN plus local mp3 files (pop.mp3, board.mp3). SVG icons are inline. Fonts from Google Fonts (Lexend, Manrope).
8. **Mobile-first.** All touch targets minimum 44x44px. Test on small screens (375px width) first.
9. **Performance budget.** 60fps on iPhone SE (2nd gen). The render loop must complete in <16ms. Profile before optimizing. No premature optimization.
10. **localStorage for persistence.** Level completions, star ratings, save state, tutorial-complete flag, audio volume/mute, settings, and save-version are all stored in localStorage. See "Data Persistence Rules" section below.

## Color Palette

| Element            | Color   |
|--------------------|---------|
| Page background    | #ffedcd |
| Board background   | #f7e6ca |
| Recessed bg        | #f0d2a8 |
| Dot (inactive)     | #a68168 |
| Dot (active)       | #ffffff |
| Layer 1 (red)      | #ffbe0b |
| Layer 2 (amber)    | #fb5607 |
| Layer 3 (teal)     | #ff006e |
| Layer 4 (violet)   | #8338ec |
| Layer 5 (white)    | #3a86ff |
| Accidental flash   | #d4726a |
| UI text primary    | #b17025 |
| UI text secondary  | #7f7c6c |
| Primary accent     | #fb5607 |
| Card background    | #feffe5 |
| Star (earned)      | #ffbe0b |
| Star (empty)       | #d3d1c7 |
| Locked level opacity | 0.35  |

## Design Tokens

### Typography
- Headings: Lexend (Google Fonts), weight 600-700
- Body/labels: Manrope (Google Fonts), weight 400-500
- Level title: Lexend 16px weight 600 color #b17025
- Level name: Manrope 12px weight 400 color #7f7c6c
- Move counter: Manrope 16px weight 600 color #b17025
- Celebration title: Lexend 22px weight 700 color #fb5607
- Celebration stats: Manrope 16px weight 500 color #b17025
- Button text (primary): Manrope 16px weight 600 white
- Button text (secondary): Manrope 14px weight 500 color #7f7c6c
- Tutorial tip text: Manrope 14px weight 400 color #7f7c6c
- Tutorial header: Lexend 16px weight 600 color #b17025

### Spacing
- Top bar height: 48px
- Top bar horizontal padding: 12px (plus env(safe-area-inset-top))
- Bottom bar height: 56px
- Bottom bar horizontal padding: 16px (plus env(safe-area-inset-bottom))
- Card padding: 24px
- Button internal padding: 12px 24px

### Corners
- Buttons: 12px border-radius
- Cards and modals: 16px border-radius
- Icon buttons (grid, reset): 40x40px with centered icon

### Visual Identity
- Warm pastel aesthetic with cream/amber/orange palette
- Page background #ffedcd, board background #f7e6ca
- Cards use #feffe5 background with box-shadow 0 4px 16px rgba(0,0,0,0.08)
- Modal backdrop: rgba(255,237,205,0.85)
- Primary gradient button: solid #fb5607 with white text
- Button press feedback: scale 0.92 on pointerdown, ease-out back to 1.0
- All transitions use ease-out curves

## Audio System

**Marimba progress notes:** Uses Tone.Sampler with xylophone samples from `https://nbrosowsky.github.io/tonejs-instruments/samples/xylophone/` (only G4, C5, G5, C6, G6, C7 exist on CDN). Musical cursor walks up/down white keys only (C3 to B5, 21 notes). Cursor starts at index 7 (C4). Each erase increments cursor by 1, each accidental draw decrements by 1. Clamped 0-20. Connects directly to Destination, no effects chain.

**Sound effects:**
- pop.mp3: plays on each dot appearing during level intro animation
- board.mp3: plays when recessed board fades in during level intro
- Button tap: short synth click on all UI button presses
- Puzzle complete: rapid ascending arpeggio of top notes using marimba sampler

**iOS Safari fix:** AudioContext must be created synchronously inside a touch handler. No async/await. Tone.setContext(rawCtx) with a raw AudioContext created in the touchstart handler. This is critical and must not be changed.

## Connection Key Format

Connections between dots are keyed as strings with coordinates sorted lexicographically: `"x1,y1-x2,y2"` where `(x1,y1) < (x2,y2)`. This ensures A-to-B and B-to-A reference the same connection.

## Grid Topology

3x3 grid dot coordinates: `[0,0]` through `[2,2]`. Each dot can connect to up to 8 neighbors (orthogonal + diagonal). A connection exists between two dots only if it is defined in the level data. Not all possible connections are present in every level.

**Dynamic snap radius:** SNAP_RADIUS (40px) is the maximum. On larger grids where dots are closer together, snap radius must scale down to avoid overlapping: `effectiveSnapRadius = min(SNAP_RADIUS, gridSpacing * 0.45)`. This prevents fat-finger errors on 4x4 and 5x5 grids.

## Level Data Format

```typescript
interface LevelData {
  id: string;
  name: string;
  world: number;
  grid: { cols: number; rows: number };
  connections: Array<{
    from: [number, number];
    to: [number, number];
    layers: number;
    directional?: boolean;
  }>;
  targetLayers: number;  // 0 = clear all, N = reduce to N total remaining layers
  special: {
    forcedStart: [number, number] | null;
    forcedEnd: [number, number] | null;
    buttons: Array<{
      dot: [number, number];
      type: 'toggle' | 'hold';
      links: string[];
    }>;
    doors: Array<{
      id: string;
      from: [number, number];
      to: [number, number];
      default: 'open' | 'closed';
    }>;
  };
  constraints: {
    moveLimit: number | null;
    timeLimit: number | null;
    liftPenalty: boolean;
  };
  meta: {
    difficulty: number | null;
    minMoves: number | null;
    solutionCount: number | null;
    requiresDraw: boolean;
    minRemainingLayers: number;  // theoretical minimum, computed by solver
    eulerSolvable: boolean;      // true if puzzle can be cleared to 0
  };
}
```

## No Backtrack Restriction

There is NO anti-trivial-backtrack rule. Every connection traversal always executes, even if the same connection was just modified in the current stroke. The move counter naturally penalizes unnecessary back-and-forth. Players are free to trace the same connection as many times as they want.

## Win Condition: Two Level Types

**"Clear" levels (targetLayers: 0):** The classic mode. Sum of all remaining layers must reach 0. Used in Worlds 1-3.

**"Reduce" levels (targetLayers: N where N > 0):** Some puzzle graphs are mathematically impossible to fully clear (Euler path parity). These levels have a target: reduce total remaining layers to N or fewer. Introduced in World 4+. The solver computes the theoretical minimum remaining layers for each puzzle, and targetLayers is set at or above that minimum.

**Critical design rule:** Draw-to-solve (intentionally drawing bridge lines) is ONLY used in reduce levels (targetLayers > 0). A clear level (targetLayers: 0) must never require drawing because bridge lines always leave residual layers that making clearing to zero impossible. Worlds 1-3 are all clear levels. World 4+ introduces reduce levels and draw-to-solve together.

The checkWin function sums all connection layers and returns true when total <= targetLayers.

## Euler Path Design Rules (For Solver and Level Design)

**Degree of a dot** = sum of all layers on connections touching that dot.

- **0 odd-degree dots:** Euler circuit. Any starting dot works. Easiest levels.
- **2 odd-degree dots:** Euler path. Must start at one of the two odd dots. Starting elsewhere makes clearing impossible. Medium-hard.
- **4+ odd-degree dots:** No Euler path. Cannot clear to zero. Must be a reduce level.

**Forced start dots** are a hint mechanism: placing forced start on an odd-degree dot tells the player where to begin without explaining the math.

**Multi-layer connections** contribute their layer count to each endpoint's degree. A 3-layer connection gives degree 3 to both endpoints. This makes traversal ORDER consequential, not just path choice.

**Clear levels (targetLayers: 0)** must have 0 or 2 odd-degree dots. The solver MUST verify this.

**Reduce levels (targetLayers: N)** can have any number of odd-degree dots. The solver computes minRemainingLayers as the theoretical floor.

## Current Phase

**Phase 3: Full Game (in progress).** Phases 1 (core prototype) and 2 (solver/designer) are complete. Phase 3 is mostly complete: splash screen with animated SVG logo, tutorial system (5 guided levels with hand animation and forced starts), level select with star display and save state, celebration screen with varied messages and world unlock notification, level intro animation (board fade, dot pop, line draw), level transition splash between levels, settings screen (volume, colorblind toggle, reset progress), marimba progress audio, iOS Safari audio fix. Remaining: design 20+ real levels, hint system, daily puzzle, colorblind patterns in renderer, dead-end detection.

## What NOT to Build Yet

- Hint system with Sparks currency (Phase 3, remaining). Sparks are the in-game currency for hints ONLY. Start with 5 sparks, earn 1 per 3 levels completed, earn 1 per rewarded ad (max 3 ads/day). Hints: show starting dot (1 spark), show first 3 moves (1 spark), show full solution (2 sparks). Spark counter on level select top bar (right side). Lightbulb icon in game overlay opens hint popup. Spark packs purchasable: 5/$0.99, 15/$1.99, 40/$3.99. Sparks do NOT buy cosmetics or ad removal. Sparks never expire. Store in localStorage key 'untrace_sparks'.
- Daily puzzle (Phase 3, remaining)
- Colorblind patterns in renderer (Phase 3, remaining)
- Dead-end detection (Phase 3, remaining)
- Capacitor / native wrap (Phase 4). Includes:
  - Lock orientation to portrait in capacitor.config.ts
  - Verify safe areas on all notched phones (env safe-area-inset-top/bottom)
  - WKWebView crash recovery handler (iOS)
  - Battery optimization: pause/reduce rAF when idle
  - Status bar blending with #ffedcd
  - Haptics plugin (dot touch, layer erase, puzzle complete)
  - Migrate localStorage to @capacitor/preferences (Android OEMs can clear localStorage)
  - Plugin initialization order: never call plugins in DOMContentLoaded, wait for Capacitor ready
  - Disable text selection: -webkit-tap-highlight-color transparent, user-select none
- Cloud save via Google Play Games + Apple Game Center (Phase 4, alongside Capacitor wrap)
- Monetization, ads, IAP (Phase 5) -- interstitial ads every 3-4 levels (free tier, removed with premium) + rewarded video for sparks (all tiers, max 3/day). No banners. Shop accessible from settings screen: Remove Ads $3.99, Cosmetic Themes $0.99 each (Hacker, Neon, Paper, Ocean), Spark Packs (5/$0.99, 15/$1.99, 40/$3.99). Contextual purchase prompts: hint popup when out of sparks, post-interstitial "Remove ads" banner, occasional celebration popup theme prompt. Never popup on launch, never blocking, never forced. WARNING: use purchases-capacitor ONLY (not purchases-js). Load ads after first user interaction, not on launch.
- Analytics via Firebase Analytics + `@capacitor-firebase/analytics` (Phase 5). WARNING: use ONLY the Capacitor plugin, NOT the Firebase web SDK. Web SDK fails silently inside iOS WebView.
- "Rate Us" prompt after high moments (Phase 5)
- Level select auto-scroll to current level for returning players (Phase 5)
- Optional account creation after World 1 (Phase 5)
- Power-ups: Shatter, Phase, Freeze (Phase 5, World 6+)
- Walls, missing dots, disabled dots (Phase 5, World 5+)

## Mobile Robustness (Web)

These are implemented in the web version to handle common mobile issues:

- **Browser suspension recovery:** visibilitychange listener recovers from screen lock/unlock. Restarts rAF loop, re-binds celebration buttons, skips stuck animations, resumes audio context.
- **Phone call / notification interruption:** blur event ends any active trace (isTracing = false, clears stroke). focus event resumes audio.
- **Landscape overlay:** When width > height, shows "Please rotate your device" overlay hiding the game.
- **Pull-to-refresh prevention:** overscroll-behavior: none, touchmove preventDefault on canvas.
- **Double-tap zoom prevention:** touch-action: manipulation on html/body.
- **Canvas context reuse:** getContext('2d') called exactly once. Resize handler debounced to 200ms.
- **iOS Safari audio:** AudioContext created synchronously in touchstart handler. No async/await. See audio.ts.

## Data Persistence Rules (NEVER BREAK)

Player progress is stored in localStorage. App updates (web deploys, App Store/Play Store updates) do NOT clear localStorage. But code changes can orphan or break saved data. Follow these rules strictly after launch:

1. **Never rename localStorage keys.** If stars are stored under `level-stars`, that key name is permanent. Renaming it makes existing player data invisible.
2. **Never change level IDs.** If a level has id `"w1-01"`, that ID is permanent. Star data and completion state are keyed to it. Changing the ID orphans the player's progress on that level.
3. **Never reorder or remove published levels.** Only append new levels to the end of a world. Removing level 5 and shifting levels 6-25 down would break every player's save data.
4. **Never change star-gate thresholds downward.** Increasing the star requirement for a world is safe (players already past it stay unlocked). Decreasing could cause confusion but won't break data.
5. **Never change the star calculation formula retroactively.** Players keep their earned stars even if par values change. Their star count stays but might not match new criteria. This is acceptable.
6. **Store a schema version.** localStorage key `save-version` tracks the data format version (start at 1). If the format ever needs to change, increment the version and write migration code that converts old format to new format on app load. Never delete old data without migrating it first.
7. **Adding new worlds, levels, features is always safe.** New data keys, new level IDs, new worlds appended to the end -- none of these affect existing player data.

## Development Notes

- Dev server: `npm run dev -- --host` (--host for mobile testing on same WiFi)
- Production build: `npx vite build`
- Deploy: `npx vercel --prod` from ~/untrace
- Test solver: `npm run test-solver`
- Puzzle designer: open tools/designer/index.html directly in browser
- Color tuner: open tools/color-tuner/index.html directly in browser
- Font tuner: open tools/font-tuner/index.html directly in browser
- Context7 MCP is available for looking up Tone.js and Canvas 2D API docs
- Xylophone samples: only G4, C5, G5, C6, G6, C7 exist on nbrosowsky CDN, Tone.Sampler pitch-shifts the rest
- Safari audio: must be 100% synchronous in touch handler, no await/promises
- Dynamic snap radius needed for 4x4/5x5 grids: `min(SNAP_RADIUS, gridSpacing * 0.45)`
