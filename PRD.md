# Untrace — Product Requirements Document

> **Note:** Phases 1-2 are complete and their sections below reflect the original spec. The actual implementation evolved during development (e.g., pastel theme replaced dark theme, xylophone samples replaced synthesized audio, Lexend/Manrope replaced system fonts). See CLAUDE.md for the current implementation state. Phase 3 is mostly complete. Phases 4-5 are forward-looking.

## Overview

Untrace is a dot-grid puzzle game where players trace over pre-drawn layered lines to erase them. Tracing empty connections accidentally draws new lines. Two level types: "clear" levels where the goal is a blank grid, and "reduce" levels where some lines must remain. Reduce levels introduce intentional drawing as a strategy (the "Rubik's Cube principle") since drawing to bridge gaps always leaves residual lines. Built as a web app first, then wrapped for iOS/Android via Capacitor.

**Stack:** Vite + Canvas 2D + TypeScript + Tone.js
**Deploy:** Vercel (static)
**Target platforms:** Mobile-first web, then iOS and Android via Capacitor

---

## Phase 1: Core Prototype

**Goal:** The tracing mechanic feels satisfying. Erasing, drawing, layers, undo, and audio feedback all work on a 3x3 grid. 5-10 hardcoded test levels playable on mobile and desktop.

**Not in scope for Phase 1:** Solver, designer, save state, menus, level select, monetization, daily puzzles, settings screen, hint system, celebrations, star ratings.

### 1.1 Grid Renderer

**Canvas setup:**
- Single full-screen `<canvas>` element, device pixel ratio aware
- Dark background: `#0A0A0F`
- Grid is centered on screen with equal padding on all sides
- Grid size for Phase 1: 3x3 only (9 dots, up to 20 possible connections including diagonals)

**Dots:**
- Rendered as circles, radius ~12px at baseline (tunable)
- Inactive state: `#2A2A35`, subtle border or soft glow
- Active state (currently touched / last-touched after lift): `#FFFFFF` with a soft radial glow
- Dot spacing should fill ~70% of the smaller screen dimension, leaving room for UI elements (undo button, move counter)

**Lines (connections):**
- Drawn between dot centers
- Line width ~6px at baseline (tunable), thicker for multi-layer connections
- Color per layer (top to bottom): Red `#FF6B6B`, Amber `#FFB347`, Teal `#4ECDC4`, Violet `#9B6BFF`, White `#E8E8F0`
- Multi-layer lines show only the top layer color but with increased width or a subtle doubled-line effect to indicate depth
- Empty connections are invisible (no line rendered)

**Accessibility patterns (implement from day one):**
- Red: solid line
- Amber: dashed (dash length ~8px, gap ~4px)
- Teal: dotted (dot spacing ~6px)
- Violet: double line (two parallel lines ~2px apart)
- White: pulsing opacity animation
- A toggle in a minimal settings icon enables/disables pattern mode. Default: off, but patterns are always subtly visible as texture differences.

**Acceptance criteria:**
- A 3x3 grid renders centered on screen with correct colors
- Multi-layer connections visually indicate layer depth
- Pattern mode toggle works
- Grid looks correct on iPhone SE (smallest target), iPhone 15 Pro Max, iPad, and desktop browser
- Canvas is crisp on high-DPI screens

### 1.2 Input System

**Touch/mouse handling:**
- Listen for `pointerdown`, `pointermove`, `pointerup` events on the canvas
- On `pointerdown`: find the nearest dot within a 40px radius of the touch point. If found, begin a trace from that dot. If the player has a locked position from a previous lift, the touch must be on that locked dot to resume (otherwise ignore the touch).
- On `pointermove`: continuously snap to the nearest dot. When the snapped dot changes (player has moved to a new dot), check if a connection exists between the previous dot and the new dot in the grid topology.
- On `pointerup`: lock the player's position to the last dot in the trace. Store this as the resume point.

**No dot skipping:**
- When the player swipes from dot A to dot C and dot B lies on the straight line between them, the game must register A->B->C as two separate moves, not skip B.
- Implementation: when a new snap target is detected, compute the straight-line path from the current dot to the target dot. Find all intermediate dots that lie on or very near that line (within a tolerance). Process each intermediate dot in sequence before processing the target.
- Edge case: diagonal swipes across a 3x3 grid. Swiping from corner (0,0) to corner (2,2) passes through center (1,1). This must register as two moves: (0,0)->(1,1) then (1,1)->(2,2).

**Input buffer:**
- Buffer rapid pointermove events with a ~50ms debounce so that very fast swipes don't produce inconsistent state
- State updates are authoritative and immediate; rendering can lag behind by a frame or two

**Acceptance criteria:**
- Tracing feels responsive with no perceptible input lag on mobile
- No dot skipping occurs regardless of swipe speed
- Lifting and resuming from the locked dot works correctly
- Touching a dot other than the locked dot after a lift does nothing
- Desktop mouse input works identically to touch

### 1.3 Game State and Logic

**State representation:**
```typescript
interface GameState {
  grid: GridConfig;           // dot positions, grid dimensions
  connections: Map<string, ConnectionState>;  // key: "x1,y1-x2,y2" sorted
  playerDot: [number, number] | null;         // current/locked dot
  isTracing: boolean;
  moveCount: number;
  targetLayers: number;       // 0 = clear all, N = reduce to N total remaining layers
  undoStack: GameState[];
  redoStack: GameState[];
}

interface ConnectionState {
  layers: number;    // 0 = empty, 1 = red, 2 = amber, 3 = teal, 4 = violet, 5 = white
  directional?: { from: [number, number]; to: [number, number] };
}
```

**Erasing logic:**
- When the player traces a connection that has layers > 0: decrement layers by 1. If layers reaches 0, the connection is now empty.

**Drawing logic (accidental):**
- When the player traces a connection that has layers === 0 (or the connection key does not exist in the map at all): set layers to 1 (draws a red line). If the key was absent from the connections map, create a new entry.

**No backtrack restriction:**
- Every connection traversal always executes, regardless of whether it was modified earlier in the same stroke. The move counter naturally penalizes unnecessary back-and-forth. Players are free to trace the same connection multiple times within a single stroke.

**Win condition:**
- Each level defines a `targetLayers` value (default 0).
- After each move, sum all remaining layers across all connections. If the total is less than or equal to `targetLayers`, the puzzle is solved.
- `targetLayers: 0` = classic "clear the board" levels (Worlds 1-3).
- `targetLayers: N` (where N > 0) = "reduce" levels where the goal is to get total remaining layers at or below N. Introduced in World 4+.
- The UI shows the target clearly: "Clear all lines" for target 0, or "Reduce to 2 lines" for target 2.

**Undo/Redo:**
- Before each move (connection state change), push a deep copy of the relevant state onto the undo stack.
- Undo pops the last state, pushes current state onto redo stack.
- Any new move clears the redo stack.
- Undo/redo have no limit.

**Acceptance criteria:**
- Erasing reduces layers correctly, top color changes appropriately
- Tracing empty connections draws a new red line
- Connections can be freely re-traced within a single stroke (no backtrack restriction)
- Win detection fires when total remaining layers <= targetLayers
- Undo/redo work correctly through arbitrarily long sequences
- Move counter increments by 1 per connection traversed

### 1.4 Animations

**Line erase animation:**
- When a layer is erased, the line color dissolves outward from the touch point over ~200ms
- The layer beneath is revealed with a brief shimmer/brightening over ~100ms
- Use ease-out curves for all animation timing

**Final layer erase:**
- Line fades to a faint ghost trail (`opacity: 0.15`) that dissipates over ~300ms

**Accidental draw animation:**
- Brief red flash (`#FF4444`) for ~100ms, then settles to the red layer color

**Dot activation:**
- Dot brightens to white with a soft radial glow expanding over ~150ms when touched

**Implementation notes:**
- All animations are cosmetic overlays on top of the authoritative game state
- Animations should never block input processing
- Use requestAnimationFrame for the render loop, separate from state updates

**Acceptance criteria:**
- Erase animation plays smoothly at 60fps on mobile
- Layer reveal beneath is visually clear
- Ghost trail on final erase is subtle and dissolves cleanly
- Animations do not cause input lag

### 1.5 Audio System

**Tone.js setup:**
- Initialize AudioContext on first user interaction (required by browsers)
- All sounds are synthesized, no sample files

**Sound events:**
- **Dot touch:** soft click/tap. Short envelope, high frequency. `Tone.Synth` with very short attack/release.
- **Line erase:** satisfying unzip/thread-pull. Pitch based on layer color being erased: red = C5, amber = A4, teal = F4, violet = D4, white = B3. Short filtered noise burst + sine tone. ~150ms duration.
- **Final layer erase:** distinct chime. Sine wave with longer release (~400ms), slight reverb.
- **Accidental draw:** muted thud/pluck. Low frequency, very short, no sustain. Communicates "oops" without feeling punishing.
- **Puzzle complete:** cascading ascending tones over ~800ms. One chime per formerly-connected dot, played in sequence from the last-erased connection outward.
- **Undo:** soft rewind whoosh. Filtered noise sweep, high to low, ~200ms.

**Volume:**
- Master volume control (stored in localStorage for persistence)
- Default: 70%
- Mute toggle available

**Acceptance criteria:**
- Audio initializes without errors on iOS Safari, Chrome, Firefox
- Each sound event plays without clipping or delay
- Layer-based pitch differences are audible and pleasant
- Puzzle complete cascade sounds satisfying
- Mute toggle works
- No audio plays before first user interaction

### 1.6 UI Elements (Minimal for Phase 1)

**During gameplay (overlay on canvas):**
- **Undo button:** bottom-left corner. Simple curved-arrow icon. Tappable area at least 44x44px.
- **Redo button:** next to undo. Greyed out when redo stack is empty.
- **Move counter:** top-center. Shows current move count. Clean sans-serif, white text.
- **Level indicator:** top-left. "Level X" or puzzle name.
- **Settings icon:** top-right. Opens a minimal panel with: volume slider, mute toggle, pattern mode toggle, "Reset Puzzle" button.
- **Reset Puzzle:** resets the puzzle to its initial state. Confirm dialog: "Reset this puzzle?" with Cancel/Reset buttons.

**Between levels (Phase 1 only, temporary):**
- Simple "Next Level" / "Previous Level" buttons
- No level select screen yet
- No celebration screen yet (just a brief "Solved!" text overlay + the completion sound)

**Acceptance criteria:**
- All tap targets are at least 44x44px
- UI elements do not overlap the grid on any screen size
- Settings panel opens/closes cleanly
- Reset works correctly with confirmation

### 1.7 Test Levels

Hardcode 5-10 levels as JSON objects directly in the source code (not external files yet). These levels serve as playtest material for tuning feel, not as final game content.

**Required test levels:**
1. Single line between two dots (tutorial level 1 equivalent, targetLayers: 0)
2. L-shape, 2 lines (continuous trace learning, targetLayers: 0)
3. Triangle, 3 lines (multiple valid solutions, targetLayers: 0)
4. Line with a gap requiring crossing empty space (accidental draw learning, targetLayers: 0)
5. 2-layer connection (layer system learning, targetLayers: 0)
6. Full 3x3 with all orthogonal connections, single layer (stress test for input, targetLayers: 0)
7. 3x3 with diagonal connections (diagonal tracing test, targetLayers: 0)
8. 3x3 with mixed layers (2 and 3 deep, targetLayers: 0)
9. A complex clearable puzzle with multiple valid paths that requires careful planning (targetLayers: 0)
10. A puzzle that cannot be fully cleared (Euler-invalid, targetLayers: 1 or 2 -- tests "reduce" win condition)

**Acceptance criteria:**
- All 10 levels load and play correctly
- Level 9 is only solvable by intentionally drawing at least one line
- Level 10 triggers win when total remaining layers reach the targetLayers value, not when board is blank

---

## Phase 2: Toolchain

**Goal:** Build the puzzle designer and solver as internal web tools. Design and verify 30+ levels for Worlds 1-2. Establish the difficulty curve.

### 2.1 Puzzle Solver

**Algorithm:** Breadth-first search over game states.

**State definition for solver:**
- A state is: the current layers on every connection + the player's current dot position + whether the player is mid-trace or lifted.
- State hash: serialize the connection layers as a sorted string + player dot coordinates. Use this for O(1) visited-state lookup via a Set.

**Solver outputs:**
```typescript
interface SolverResult {
  solvable: boolean;              // true if targetLayers is achievable
  minMoves: number | null;        // null if not solvable to target
  solutionCount: number | null;   // capped at 100, null if not solvable
  requiresDraw: boolean;          // true if any solution involves drawing
  difficulty: number | null;      // composite score, null if not solvable
  sampleSolution: Move[] | null;  // one optimal solution as a move sequence
  minRemainingLayers: number;     // absolute minimum total layers achievable (may be > targetLayers)
  eulerSolvable: boolean;         // true if the puzzle can be cleared to 0 total layers
}
```

The `minRemainingLayers` field is critical for level design. It tells the designer the theoretical floor for a puzzle. If a puzzle has `minRemainingLayers: 3`, it can never be fully cleared, but it can be used as a "reduce" level with `targetLayers: 3` (or higher for easier variants). The `eulerSolvable` flag is a quick check for whether the graph satisfies the Euler path parity condition (at most 2 nodes with odd total degree).

**Performance targets:**
- 3x3 single-layer: solve in <100ms
- 3x3 multi-layer (up to 3 layers): solve in <1s
- 4x4 single-layer: solve in <5s
- 5x5: may require iterative deepening or pruning heuristics. Target: <30s with web workers.

**Implementation:**
- Run in a Web Worker to avoid blocking the UI
- Progress callback for long solves (show "Solving... X states explored")
- Pruning: abandon any branch where total layers on the board exceed starting total + a configurable threshold (default: starting total * 1.5)

**Acceptance criteria:**
- Solver correctly identifies solvable/unsolvable for all 10 Phase 1 test levels
- Minimum move count matches manual verification on test levels
- `requiresDraw` flag is true for test level 9, false for levels 1-8
- Solver runs in a web worker without blocking the main thread
- 3x3 puzzles solve within performance targets

### 2.2 Puzzle Designer

**A separate web app** (can live in a `/tools/designer` directory, deployed to a separate Vercel URL or behind a route).

**Grid editor:**
- Click a dot pair to toggle a connection (add/remove)
- Shift-click a connection to increment its layer count (cycles through 1->2->3->4->5->1)
- Right-click a connection to decrement layers or remove
- Visual representation matches the game exactly (same colors, same patterns)
- Grid size selector: 3x3 / 4x4 / 5x5

**Special elements panel:**
- Set forced start dot (click a dot while "Start" tool is selected)
- Set forced end dot (click a dot while "End" tool is selected)
- Place button on a dot (click while "Button" tool is selected, assign a door link)
- Place door on a connection (click while "Door" tool is selected, set default open/closed)
- Set directional flag on a connection (arrow indicator shows direction)

**Level metadata:**
- Level ID (auto-generated, editable)
- Level name (text input)
- World number (dropdown)
- Constraints: move limit (number input, optional), time limit (number input, optional), lift penalty (checkbox)

**Verify button:**
- Runs the solver on the current puzzle
- Displays results inline: solvable yes/no, min moves, solution count, requires draw, difficulty score
- If solvable, enables "Play" and "Export" buttons
- If unsolvable, shows a warning and disables Export

**Play button:**
- Opens the current puzzle in a test instance of the game engine (can be an iframe or a new tab)
- Uses the same renderer and input system from Phase 1

**Export button:**
- Downloads the level as a JSON file matching the level data format specified in the concept doc
- The `meta` block is auto-populated from the solver results

**Batch operations:**
- Import a JSON file containing multiple levels
- "Verify All" runs the solver on every level and shows a summary table: level ID, solvable, difficulty, min moves
- Export all levels as a single JSON array

**Acceptance criteria:**
- A level can be designed, verified, played, and exported entirely within the tool
- Exported JSON is valid and loads correctly in the game engine
- Batch verify works on 30+ levels without crashing
- The designer is usable on desktop (not required to work on mobile)

### 2.3 Level Design: Worlds 1-2

Using the designer and solver, create the first 30 levels.

**World 1: "First Light" (Levels 1-15)**
- All 3x3
- Single color (red) only
- Free start and end
- Progressive complexity:
  - Levels 1-5: tutorial sequence (see concept doc Section 4 for exact briefs)
  - Levels 6-10: introduce diagonal connections, more complex topologies
  - Levels 11-15: full 3x3 boards with multiple valid solutions, par scores require finding the optimal path

**World 2: "Layers" (Levels 16-30)**
- All 3x3
- Multi-color layers introduced (2-3 layers max)
- Free start and end
- Progressive complexity:
  - Levels 16-18: simple 2-layer puzzles where the second layer reveal is the "new thing"
  - Levels 19-22: mixed single and double layer connections
  - Levels 23-27: 3-layer connections introduced
  - Levels 28-30: dense multi-layer boards that prepare the player for World 3

**Difficulty targets (solver difficulty score, calibrate through playtesting):**
- World 1 levels 1-5: difficulty < 10
- World 1 levels 6-15: difficulty 10-25
- World 2 levels 16-22: difficulty 15-35
- World 2 levels 23-30: difficulty 30-50

**Acceptance criteria:**
- 30 levels designed and verified solvable
- Difficulty curve is monotonically increasing within each world (with minor local variation allowed)
- No level in Worlds 1-2 requires drawing to solve (intentional drawing is introduced in World 4 alongside reduce levels)
- All levels have at least 2 valid solutions (to avoid frustration in early worlds)
- Tutorial levels 1-5 each introduce exactly one concept

---

## Phase 3: Full Game

**Goal:** Complete, polished web game with 60+ levels across 4 worlds, full UX, save state, and daily puzzle infrastructure.

### 3.1 Level Data Loading

- All levels stored in a single `levels.json` file (or split per world: `world1.json`, etc.)
- Loaded at app startup (small file, no lazy loading needed for <100 levels)
- Level unlock progression: completing level N unlocks level N+1 within a world. Worlds are locked behind cumulative star counts (star-gate system):
  - World 1: no requirement (always open)
  - World 2: requires 30 stars (out of 75 possible from World 1, ~40%)
  - World 3: requires 80 stars (out of 150 possible from Worlds 1-2, ~53%)
  - World 4: requires 140 stars (out of 210 possible from Worlds 1-3, ~67%)
  - World 5+: requires ~60% of all possible stars from previous worlds
  - Star requirements are generous enough that decent players pass naturally, but players who rush with 1-star completions will need to replay and improve.
  - Level select shows "X / Y stars needed" on locked worlds.
- Unlock state stored in localStorage

### 3.2 Level Select Screen

- World view: shows all worlds as distinct sections/cards with a color temperature matching the world theme
- Each world shows: name, number of levels, stars earned / stars possible, lock state, stars needed to unlock (if locked)
- Locked worlds show the star requirement prominently: "30 stars to unlock" with a progress bar showing current total
- Tapping a world shows its levels as a grid of numbered circles
- Each level circle shows: level number, star count (0-3), lock/unlock state
- Tapping an unlocked level starts it
- Smooth transitions between views (no hard page loads)

### 3.3 World 3: "The Knot" (Levels 31-45) and World 4: "Remnants" (Levels 46-60)

**World 3:**
- 3x3 grids
- All levels are targetLayers: 0 (clear the board)
- Introduces complex Euler circuits and paths that require careful planning to solve
- Level 31 is the aha moment: a puzzle that looks simple but has only one valid traversal order. The player must think before tracing.
- Multiple dead-end-prone topologies where careless tracing leads to accidental draws
- Forced start dots introduced in later levels

**Key design insight from playtesting:** Drawing to solve and clearing to zero are mutually exclusive. Any puzzle that requires drawing a bridge line can never be cleared to zero because the bridge itself becomes residual. Therefore draw-to-solve is exclusively a World 4+ mechanic, paired with reduce levels.

**World 4: "Remnants"**
- Mix of 3x3 and 4x4 grids
- Introduces "reduce" levels where targetLayers > 0
- **Also introduces intentional drawing as a strategy.** This is the Rubik's Cube principle: some puzzles require drawing bridge lines to reach isolated sections, accepting that bridges leave residual layers.
- Early World 4 levels: targetLayers matches minRemainingLayers (find the theoretical best)
- Later World 4 levels: targetLayers is slightly above minRemainingLayers (more lenient, but still requires good play)
- Forced start and end dots
- Buttons and doors introduced in levels 55-60
- Move limits on select levels
- UI clearly shows the target: "Reduce to 2 lines" with a counter showing current total vs target

Design and verify using the Phase 2 toolchain.

### 3.4 Star Rating and Celebration

**Star rating per level:**
- 3 stars: completed at or below par (solver's min moves)
- 2 stars: completed within par + 50% (rounded up)
- 1 star: completed at all

**For "reduce" levels (targetLayers > 0):**
- 3 stars: reached minRemainingLayers exactly (theoretical best) within par moves
- 2 stars: reached targetLayers within par + 50%
- 1 star: reached targetLayers at all

**Celebration screen on solve:**
- Star rating animates in (1, then 2, then 3 with slight delays)
- Varied title text based on star count: 3 stars = random("Perfect!", "Flawless!", "Brilliant!"), 2 stars = random("Well done!", "Nice work!", "Solid!"), 1 star = random("Cleared!", "Done!", "Onward!")
- Stats displayed: "Moves: X | Par: Y"
- World unlock notification: if this completion crosses a star-gate threshold for an existing world, show "World N Unlocked! / New puzzles await" with scale-up animation. Triggers once per world (before/after star comparison).
- "Next Level" button (primary gradient style)
- "Replay" button (secondary style)
- "Level Select" button (secondary style, transitions without flashing game board)

### 3.5 Save State

**IMPLEMENTED.** Single active save at a time.

- Auto-saves after every move (connections, playerDot position, moveCount)
- On returning to a level with a save, shows "Resume where you left off?" dialog with saved board visible behind it
- Resume restores full state including playerDot position
- Starting a different level clears any save from other levels (only one save at a time)
- Save cleared on: level win, restart, reset, or switching to a different level
- Pressing back to level select keeps the save (no confirmation dialog, progress is preserved)
- Level completion (stars, unlocks) persisted separately from mid-puzzle save state
- Schema version tracked in localStorage key 'save-version' (currently 1)

### 3.6 Hint System and Sparks Currency

**Sparks** are the in-game currency used exclusively for hints. They are earned through gameplay, rewarded ads, or purchased with real money.

**Earning Sparks:**
- Start with 5 sparks on first launch
- Earn 1 spark for every 3 levels completed (any star rating, cumulative across all worlds)
- Earn 1 spark for 3-starring a level that previously had 1-2 stars (rewards replaying)
- Earn 1 spark by watching a rewarded video ad (capped at 3 ads per day, resets at midnight local time)
- Earn 1 spark per daily puzzle completion (when daily puzzles are implemented)

**Spending Sparks (hints):**
- Hint 1 - "Show starting dot" (1 spark): The optimal starting dot pulses with a bright glow for 3 seconds. No path shown.
- Hint 2 - "Show first moves" (1 spark): The first 3 moves of the optimal solution animate on the board as ghost lines with a hand icon tracing the path. Ghost fades after 3 seconds.
- Hint 3 - "Show full solution" (2 sparks): The entire optimal solution animates start to finish with a ghost hand. After animation, board resets to current state so the player can replicate.

**Hint UI during gameplay:**
- Small lightbulb icon in the game overlay (near undo/redo buttons)
- Badge showing remaining spark count
- Tapping opens the hint popup: same card style as other popups (#feffe5 background, rounded corners)
- Popup title: "Need a hint?" in Lexend
- Three hint options stacked vertically, each showing description and cost
- Grayed out if not enough sparks
- "X sparks remaining" counter at the top of the popup
- "Watch ad for 1 spark" button at the bottom (grayed out if daily cap reached, shows "X remaining today")

**Spark counter on level select:**
- Top bar, right side (opposite the star counter on the left)
- Spark icon (small lightning bolt or diamond shape) + "x 12" in Lexend 18px weight 700 color #b17025
- Same styling as the star counter

**Celebration popup spark reward:**
- When the player earns a spark from completing levels (every 3rd completion), show "+1 Spark!" badge on the celebration popup

**Rewarded ad daily cap:**
- Store ad watch count and date in localStorage key 'untrace_ad_watches': { count: 3, date: "2026-04-07" }
- Reset count to 0 when date changes
- Show "2 remaining today" text on the watch ad button
- After 3 watches, button grays out with "Come back tomorrow"

**Sparks are NOT used for:**
- Cosmetic themes (those are direct IAP $0.99 each)
- Ad removal (that's the $3.99 premium unlock)
- Level skipping or progression (sparks only buy hints)

**Sparks do NOT:**
- Expire or decay over time
- Regenerate on a timer
- Have a maximum cap

**Persistence:** Sparks stored in localStorage key 'untrace_sparks' (integer). Migrate to Capacitor Preferences in Phase 4.

### 3.6.1 Shop / Store

The shop is accessible from multiple contextual entry points but is never forced or blocking.

**Primary store (in settings screen):**
Add a "Shop" section in the settings modal with three categories:
- "Remove Ads" - $3.99 one-time purchase. Shows "Purchased" checkmark if already bought.
- "Themes" - available cosmetic themes, $0.99 each. Shows preview swatch and "Purchased" if owned.
  - Hacker theme (dark/green)
  - Neon theme (dark/bright)
  - Paper theme (sketch/pencil)
  - Ocean theme (blue/teal)
- "Sparks" - spark packs:
  - 5 sparks: $0.99
  - 15 sparks: $1.99
  - 40 sparks: $3.99

**Contextual entry points:**
- Hint popup when out of sparks: "No sparks left" with "Get more" button opening spark purchase options. Also shows "Watch ad for 1 free spark" below.
- After interstitial ad plays: small banner "Remove ads forever - $3.99" with one-tap purchase button. Shown briefly, dismissible.
- Celebration popup (every ~10th level with 3 stars): subtle "Customize your look" prompt linking to themes. Only on high-euphoria moments.
- Level select screen: subtle "Remove Ads" text link near the bottom of the scrollable area.

**Store principles:**
- No popup on app launch asking to buy anything
- No blocking purchase screens that interrupt gameplay
- No "sale" countdown timers or fake urgency
- No full-screen store takeover
- Store is always optional, always one tap away in settings, never forced
- The player finds the store when they want it, not when it's pushed

### 3.7 Dead End Detection (Real-Time)

**Do NOT run the full BFS solver after every move.** On 4x4+ grids this would drain batteries and cause micro-stutters.

Instead, use the lightweight Euler parity heuristic (O(n), runs in microseconds):
- After each move, recount odd-degree dots in the current graph state
- For clear levels (targetLayers: 0): if odd-degree count increased from the previous move, the player likely made things worse
- For reduce levels: if total remaining layers increased beyond a threshold above the target, signal trouble
- Additionally check: are all remaining connections reachable from the player's current dot? (simple BFS on the graph structure, not on game states -- fast even on 5x5)

If dead end detected:
- Undo button pulses with a warm amber glow for ~2 seconds
- No text, no popup, no interruption

For 3x3 grids, the full solver can optionally run as well (<100ms) for a precise answer. But the parity heuristic is the primary mechanism on all grid sizes.

### 3.8 Daily Puzzle Infrastructure

- One puzzle per day, same for all players
- Puzzle selection: a pre-generated pool of 365 puzzles, indexed by day-of-year. Refreshed annually or as the pool grows.
- Daily puzzle accessible from main menu without unlocking any worlds
- On completion: show move count, star rating, and a share button
- Share button generates a text-based result card (no image generation needed):
  ```
  Untrace Daily #42
  Moves: 18 (Par: 14)
  Rating: ⭐⭐
  Streak: 7 days
  untrace.app
  ```
- Streak tracking: consecutive days with a completed daily puzzle, stored in localStorage
- No global leaderboard in Phase 3 (requires backend, deferred to Phase 5)

### 3.9 Tutorial System

**IMPLEMENTED.** A separate 5-step guided tutorial that plays on first launch, before the level select. Not part of the numbered levels. Stored in src/ui/tutorial.ts.

- Welcome popup: "Welcome to Untrace" with "Let's go" button
- 5 hardcoded tutorial levels with forced start dots, hand animation, instructional text
- Step 1: Single line, hand shows swipe to erase
- Step 2: L-shape, teaches continuous tracing
- Step 3: Accidental draw discovery (no hand)
- Step 4: 2-layer connection, hand shows double pass
- Step 5: Real mini puzzle, no hints
- Tutorial UI matches game layout: undo/redo buttons, reset (no confirmation), moves counter
- "TUTORIAL / Step N of 5" header replaces level indicator
- Completion messages in cards: "Nice!", "Watch your path!", "You got it!", "You're ready!"
- Tutorial skip: if player has ANY completed levels in localStorage, skip tutorial entirely
- localStorage 'tutorial-complete' flag set on completion

### 3.10 Splash Screen

**IMPLEMENTED.** Animated SVG logo splash on every app launch.

- Full screen, background #ffedcd
- Inline SVG of the UNTRACE dot-and-line logo with stroke-dashoffset animation (lines draw in, dots fade in)
- Animation CSS loaded from public/splash-animation.css
- Subtitle "a line puzzle" in Manrope 14px color #7f7c6c below the logo
- Stays visible until BOTH: minimum 2 seconds elapsed AND all assets loaded (levels JSON, fonts via document.fonts.ready, audio samples)
- If assets take longer than 2 seconds, subtle pulsing dot loading indicator appears
- No tap to skip
- Fade out 300ms transition to tutorial (first launch) or level select (returning player)

### 3.11 Settings Screen

**IMPLEMENTED.** Accessible via gear icon on level select screen (top-right). Modal card style matching other dialogs (background #feffe5).

- **Sound:** Volume slider (styled with #fb5607 accent) + mute toggle. Persisted in localStorage.
- **Accessibility:** Colorblind patterns toggle (solid/dashed/dotted/double/pulsing per layer). Persisted in localStorage.
- **Progress:** "Reset all progress" with two-step confirmation ("Are you sure?" then "This cannot be undone").
- **About:** Version number, studio name, privacy policy link.
- Close button (X) in top-right corner.
- Only visible on level select, not during gameplay or tutorial.

### 3.12 Performance Targets

- 60fps rendering on iPhone SE (2nd gen) and above
- Touch-to-visual-response latency < 16ms (one frame)
- Level load time < 200ms
- Total app bundle size < 2MB (excluding level data)
- Level data (all worlds): < 500KB

**Acceptance criteria for Phase 3:**
- 60+ levels across 4 worlds, all verified solvable
- Level select, save state, stars, hints, daily puzzle all functional
- Dead end detection works on 3x3 levels
- Share card generates correctly
- Performance targets met on iPhone SE

---

## Phase 4: Native Wrap

**Goal:** Ship to iOS App Store and Google Play using Capacitor.

### 4.1 Capacitor Setup

- Capacitor v5+ (latest stable)
- Platforms: iOS, Android
- Web app serves as the Capacitor web asset (copy `dist/` into the native project)

### 4.2 Native Enhancements

- **Haptic feedback:** Capacitor Haptics plugin. Short impact on dot touch, medium impact on layer erase, heavy impact on puzzle complete.
- **Splash screen:** Capacitor Splash Screen plugin. Warm background #ffedcd matching game theme, app icon centered. Auto-hide after web app splash takes over.
- **Status bar:** transparent, blending with #ffedcd page background. Use Capacitor StatusBar plugin to set style and color.
- **App icon:** design in Figma, export at all required sizes (1024x1024 master)
- **No native navigation:** the web app handles all navigation internally
- **Lock orientation to portrait:** Set `orientation: 'portrait'` in capacitor.config.ts. This replaces the CSS landscape overlay used on web.
- **Safe areas:** Verify all UI elements respect env(safe-area-inset-top) and env(safe-area-inset-bottom) on notched phones (iPhone X+). Check: top bar, bottom bar, celebration card, settings modal, tutorial text, level transition splash.
- **WKWebView content process crash recovery (iOS):** If iOS kills the WebView content process due to memory pressure, the screen goes white. Add a handler via Capacitor's webViewDidTerminate event to reload the app. For this simple 2D canvas game this is extremely unlikely, but the handler costs nothing.
- **Android WebView version:** Minimum target Android 12+. Canvas 2D API is well-supported. Test on at least one older Android 12 device and one current Android 15+ device to verify rendering consistency.
- **Battery optimization:** When the game is idle (level select, celebration, settings, dialogs), reduce requestAnimationFrame to 30fps or pause the render loop. Only run at 60fps during active gameplay and intro animations. This prevents unnecessary battery drain while browsing levels.
- **Migrate localStorage to Capacitor Preferences plugin:** Some Android OEM WebViews can clear localStorage unexpectedly. `@capacitor/preferences` uses native storage (SharedPreferences on Android, UserDefaults on iOS) which is more reliable. Migrate all game data (level completions, stars, tutorial-complete, save state, settings, save-version) from localStorage to Preferences on first Capacitor launch. Keep localStorage as a fallback for the web version.
- **Plugin initialization order:** Never call Capacitor plugins inside DOMContentLoaded. Plugins initialize after the WebView loads and the Capacitor bridge is ready. Wait for the Capacitor `ready` event or use `Capacitor.isNativePlatform()` checks before calling any plugin APIs. This is a classic cause of silent crashes.
- **Disable text selection and tap highlight:** Add `-webkit-tap-highlight-color: transparent` and `user-select: none` to all game elements. Verify these are set in index.html CSS. Without this, long-press on game elements shows a text selection UI that breaks immersion.

### 4.3 App Store Preparation

- App name: Untrace
- Developer/studio name: TBD (e.g., "Mikan Games", "Dotline Games", "Soft Grid Studio"). Needed for App Store and Play Store accounts. Does not require formal company registration for individual developer accounts.
- Subtitle: "Erase the Lines"
- Screenshots: 6.7" (iPhone 15 Pro Max), 6.1" (iPhone 15), 5.5" (iPhone 8 Plus), 12.9" iPad Pro
- Description: focus on the unique mechanic, mention the Rubik's Cube principle
- Keywords: puzzle, lines, trace, minimal, logic, brain, grid
- Age rating: 4+ (no objectionable content)
- Privacy policy: gameplay progress stored in player's Google Drive (Android) or iCloud (iOS) via cloud save. No personal data collected by the developer. No analytics, no tracking, no third-party data sharing.
- IP lawyer review before submission

### 4.4 Android-Specific

- Target API level: latest stable (currently API 34+)
- Signing key: generate and store securely
- Google Play listing mirrors App Store

### 4.5 Cloud Save (Cross-Device Progress Sync)

Sync player progress across devices so switching phones doesn't lose progress. The save data is tiny: `{ completedLevels: { "w1-01": 3, "w1-02": 2, ... }, tutorialComplete: true }`. A few kilobytes at most.

**Android:** Google Play Games Services Saved Games API via `@capacitor-community/google-play-games-services` plugin.
- Player signs in with Google account (automatic or prompted)
- Save progress to cloud on every level completion
- Load progress from cloud on app launch
- Requires Google Play Console setup and Play Games Services configuration

**iOS:** Apple Game Center via Capacitor Game Center plugin.
- Player signs in with Apple ID (automatic)
- Save progress to iCloud
- Load progress from cloud on app launch
- Requires Game Center capability enabled in Xcode and App Store Connect

**Conflict resolution:** If cloud save and local save disagree, always keep whichever has more total stars. Simple max-merge: for each level, keep the higher star count from either source. This means progress is never lost, only gained.

**Privacy policy update:** With cloud save enabled, the app stores gameplay progress data in the player's Google Drive (Android) or iCloud (iOS). No personal data is collected by the developer.

**Acceptance criteria for Phase 4:**
- App installs and runs on iOS 16+ and Android 12+
- Orientation locked to portrait on both platforms
- Haptics fire correctly on both platforms
- Splash screen displays, no white flash on load
- Status bar blends with #ffedcd background, safe areas respected on notched phones
- Cloud save syncs progress across two devices on the same account
- App recovers gracefully from background/foreground transitions (audio resumes, touch state resets, animations recover)
- WKWebView crash recovery handler is in place (iOS)
- Battery drain is minimal when idle on level select screen
- App Store / Play Store submissions accepted

---

## Phase 5: Post-Launch (Scope Notes Only)

Not fully specced. Key items for future PRDs:

- **World 5 "Signals":** Buttons, doors, walls (blocked connections), irregular grids (missing dots), disabled dots
- **World 6 "Tools":** Power-ups (Shatter and Phase, 1-2 per level), 5x5 grids, directional lines
- **World 7+ "Hard Mode":** Time limits, move limits, lift penalties, all mechanics combined
- **Power-up details:** Shatter removes a connection without traversing (changes dot degree, can fix parity). Phase teleports to any dot without traversing (skip bridge cost on reduce levels). Freeze protects a connection from accidental draw for 5 moves. All earned through gameplay, never purchased, never trivialize a level.
- **Grid modifiers:** Walls (connection can't exist or be drawn), missing dots (irregular topology), disabled dots (visible but unvisitable)
- Cosmetic themes (Hacker, Neon, Paper, Ocean) as in-app purchases
- **Monetization implementation:**
  - **IAP:** RevenueCat SDK via `@capgo/capacitor-purchases` Capacitor plugin. Handles both App Store and Google Play billing with one codebase. Products: premium unlock ($3.99), cosmetic themes ($0.99 each). Configure in App Store Connect + Google Play Console. RevenueCat handles receipt validation and cross-platform sync. **WARNING:** Use ONLY `purchases-capacitor`, NOT `purchases-js` (the web SDK). Mixing them causes purchase sheet failures and silent conflicts.
  - **Ads:** Google AdMob via `@capacitor-community/admob` Capacitor plugin. Two formats: (1) Interstitial ads between levels for free tier only, shown every 3-4 levels (not every level, not during gameplay). Premium users never see interstitials. (2) Rewarded video ads for sparks (1 spark per ad, max 3 per day), available in both free and premium tiers. Player chooses to watch, never forced. No banner ads. **WARNING:** Do NOT load ads on app launch. Load ads only after first user interaction (after audio unlock). Otherwise ads block audio initialization and cause startup jank.
  - **Ad quality:** Set AdMob content rating to "G". Block categories: Dating, Gambling, Political, Sexual. Monitor Ad Review Center. Use only AdMob, no cheaper networks.
  - **Revenue split:** Apple/Google take 30% (15% if under $1M/year per platform). $3.99 premium = ~$3.39 net.
  - **Why this balance:** Interstitials between levels motivate the premium purchase ("remove ads forever"), while rewarded video is the player-friendly standard that even premium users appreciate for earning sparks. The 3 ads/day cap ensures spark packs still have purchase value.
- **Analytics (Firebase):**
  - Firebase Analytics via `@capacitor-firebase/analytics` Capacitor plugin. Free, no data limits, works on Web/iOS/Android.
  - Key events to log: `level_start` (world, level), `level_complete` (world, level, moves, stars), `level_quit` (world, level, moves at quit), `tutorial_complete` (step), `purchase` (item, value), `hint_used` (world, level, hint_type, sparks_remaining), `ad_watched` (placement, sparks_earned), `spark_spent` (amount, reason, sparks_remaining), `spark_earned` (amount, source).
  - Dashboard provides: completion rates per level, where players quit/uninstall, retention curves, session lengths, funnel analysis (tutorial > world 1 > world 2 > purchase).
  - Use data to identify difficulty spikes (levels with high fail/quit rates) and rebalance.
  - Add Crashlytics alongside analytics for crash reporting.
- **"Rate Us" prompt:**
  - Trigger ONLY after high-euphoria moments: beating a level they failed 3+ times, completing a world, or hitting a 10-level win streak. Never after failure or mid-level.
  - Use soft prompt first: "Enjoying Untrace?" with thumbs up/down. Thumbs down opens private feedback email. Thumbs up routes to App Store/Play Store review page.
- **Returning player level select:**
  - When a returning player opens the app, the level select grid auto-scrolls to center their current/next uncompleted level on screen. The player immediately sees where they left off without hunting through the grid. No separate "Continue" button needed.
- **Account creation (optional, incentivized):**
  - Do NOT prompt at first launch. Prompt after completing World 1 or around level 15-20.
  - Incentivize: "Sign in to save progress across devices" (ties into cloud save).
  - Use Google/Apple sign-in only (no custom email/password). Platform accounts handle identity.
  - For email marketing, add an optional newsletter signup on a future website, not in the app.
- Community level editor (derived from internal designer tool)
- **Procedural level generation:** Random walk algorithm for clear levels (walk = guaranteed solution), random graph + solver for reduce levels. Use for daily puzzles, endless mode, and bulk level screening. Worlds 1-4 remain hand-designed.
- Global daily leaderboard (requires a lightweight backend, possibly Supabase)
- Teleporters, mirrors, ice (new interactive element types)
- Analytics (level completion rates, hint usage, drop-off points)
