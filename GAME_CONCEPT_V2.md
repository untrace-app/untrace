# UNTRACE — Game Concept Document v2.0

> A dot-grid puzzle game where you erase layered lines by tracing over them. Some puzzles can't be fully cleared -- the challenge is finding the optimal path. The Rubik's Cube of line puzzles.

**Working title: Untrace**
Other candidates considered: Undraw, Unthread, Delace, Unweave. "Untrace" wins because it's a single word, immediately communicates the core verb, has no existing App Store conflicts (as of research date), and works as both a name and an action ("Untrace this puzzle").

---

## 1. CORE MECHANIC

A grid of dots with pre-drawn colored lines between them. The player traces continuously over lines to erase ("untrace") them. The goal varies by level type: **"Clear" levels** require a completely blank grid. **"Reduce" levels** require reducing total remaining lines to a target number or fewer.

### Grid Topology
- Connections are **orthogonal AND diagonal**. An inner dot on a 3x3 grid can connect to up to 8 neighbors. This is essential for puzzle depth -- orthogonal-only grids are too constrained to support the Rubik's Cube principle on small boards.
- Grid sizes: **3x3 → 4x4 → 5x5**. A 3x3 grid has 9 dots and up to 20 possible connections. A 5x5 grid has 25 dots and up to 72 possible connections. This provides enormous design space without needing grids larger than 5x5.

### Tracing Rules
- **No dot skipping.** Swiping from dot A to dot C always registers A→B→C, interpolating through every intermediate dot along the straight-line path. The game snaps the touch point to the nearest valid dot and resolves the full chain.
- **Continuous trace.** The player draws without lifting their finger. Each connection traversed in sequence counts as one move.
- **Lift and resume.** Lifting your finger locks your position to the last dot touched. You must resume from that exact dot. No penalty on standard levels.
- **Bidirectional erasing.** Tracing A→B or B→A both erase the same connection. Directional lines (one-way only) are introduced as a late-game modifier.

### Erasing and Drawing
- Tracing over an existing line **removes one layer** from that connection.
- Tracing over an empty connection (no line) **draws a new single-layer line**, which you must then erase. This is the core tension: every wrong move costs you.
- **No backtrack restriction.** Players can freely re-trace any connection within a single stroke. Going A to B then B to A is two moves and the move counter penalizes it naturally. This keeps the input system simple and predictable.

### The Rubik's Cube Principle
A key design pillar for advanced levels. Some puzzles are **unsolvable by pure erasure**. The player must intentionally draw new lines to create paths that allow them to reach and erase isolated segments. However, drawing a bridge always leaves residual lines (the bridge itself), so **draw-to-solve is exclusively paired with "reduce" levels** (targetLayers > 0). Clear-to-zero levels never require drawing. The moment a player first realizes "I need to make it worse to make it better" is the game's signature aha moment, introduced in World 4 alongside reduce levels.

### Euler Parity and "Reduce" Levels
Some puzzle graphs are **mathematically impossible to fully clear** due to Euler path constraints. A puzzle can only be cleared to zero if at most 2 dots have an odd total degree (sum of layers on all connections touching that dot). When more than 2 dots have odd degree, the puzzle has a non-zero minimum remaining layers.

Rather than avoiding these graphs, the game embraces them as a distinct level type: **"Reduce" levels**, where the goal is to reach a target number of remaining layers rather than zero. This opens the design space dramatically and becomes a core part of the difficulty progression in World 4 onward. The puzzle solver computes the theoretical minimum for every level, ensuring targets are always achievable.

### Starting Dot Rules (Critical for Difficulty)
The number and position of odd-degree dots determines whether starting dot matters:

- **0 odd-degree dots (Euler circuit):** Any starting dot works. The player can always find a continuous loop. Inherently easier puzzles. Used in early World 1 and World 2.
- **2 odd-degree dots (Euler path):** The player MUST start at one of the two odd-degree dots. Starting anywhere else makes clearing impossible without drawing. The player doesn't know which dots are odd -- figuring that out IS the puzzle. This is where real difficulty lives. World 2-3.
- **4+ odd-degree dots (no Euler path):** Cannot be cleared to zero. Must be a reduce level. World 4+.

Forced start dots serve as a hint mechanism: placing the forced start on an odd-degree dot tells the player "start here" without explaining why. Removing the forced start makes the same puzzle significantly harder.

### Multi-Layer Depth
A 2-layer connection needs 2 traversals. This means the same connection contributes 2 to each endpoint's degree. A simple 2-node puzzle with a 3-layer connection has degree 3 on both dots (both odd), so it's an Euler path: start at either end, traverse 3 times. But add a branching connection and the degree math changes entirely.

Multi-layer connections make traversal ORDER consequential. You might need to erase a branch BETWEEN two passes of a multi-layer connection on the trunk. Planning this sequence is where expert-level depth comes from.

### Why Unlimited Undo Is Fine
Undo doesn't reduce difficulty because:
- Every undo wastes the moves already spent. The star system (par-based) punishes inefficiency.
- Undo doesn't help you PLAN. It helps you recover from mistakes, which is a different skill.
- Move limits on select levels constrain total actions, making undo strategically costly.
- Nearly all successful puzzle games (Sudoku, The Witness, Monument Valley) offer unlimited undo. The challenge is in understanding, not in execution.

### Walls, Missing Dots, and Irregular Grids
- **Missing dots** (fewer than 9 on a 3x3): creates irregular graph topologies. The solver handles any graph shape.
- **Walls** (blocked connections that can't be traversed or drawn): creates forced paths and bottlenecks. Mechanically, the connection doesn't exist and can't be created. Simple to implement, powerful for design.
- **Disabled dots** (visible but unvisitable): equivalent to walls on all connections to that dot. Visually interesting as a greyed-out landmark.

All of these work within the existing Euler math. The solver operates on whatever graph it receives.

### Difficulty Spectrum

**Easy (anyone can solve):**
All-even-degree graphs with few connections. Any starting dot works, any path works. Worlds 1-2.

**Medium (requires some thought):**
2-odd-degree graphs where finding the right starting dot matters. Even-degree graphs with multi-layer connections where traversal order matters. World 2-3.

**Hard (requires planning):**
2-odd-degree graphs with multi-layer connections and move limits. Must find the right start AND the right order AND be efficient. World 3-4.

**Expert (requires insight):**
Reduce levels where the player must decide which lines to leave behind and potentially draw intentional bridges. Optimizing "what's the minimum I can achieve" is genuinely hard. World 4+.

**Master (requires strategic tools):**
Levels with power-ups where placement decisions interact with traversal order. Multiple valid strategies with different outcomes. World 5+.

### Reduce Level Variants (World 4+)
- **Standard reduce:** total remaining layers <= N. The base type.
- **Exact reduce:** total remaining layers must equal exactly N. Much harder because overshooting is as bad as undershooting. World 5+.
- **Hidden floor:** Player sees a generous target (e.g. <= 5) but the actual optimal is 2. Discovering the true minimum is the hidden challenge. 3 stars require reaching the real floor, not just the displayed target.

### Parity Visualization (World 4+ Unlock)
After completing World 3, an optional overlay becomes available in settings:
- Dots with odd total degree show a subtle sharp ring
- Dots with even total degree show a faint soft ring
- This converts frustration into discovery: players start to "see" the graph theory without being taught it
- Default: off. The visualization is a reward for progression, not a crutch.

### Future Mechanics (Noted for Architecture)
- **Temporary bridges (World 6+):** Drawn connections that disappear after N moves. Forces short-term reachability planning. Requires solver modifications to track move-limited connections.
- **Echo power-up (World 7+):** Repeats the player's last 3 moves automatically. Creates planning loops and symmetry puzzles. High solver complexity.

### False Confidence Arc (Level Design Principle)
World 2 should build false confidence before World 3 breaks it:
- Early World 2: almost everything solvable from any starting dot
- Late World 2: one puzzle quietly breaks that rule. The player fails and doesn't understand why.
- World 3 confirms: starting position matters. The surprise from late World 2 becomes understanding.

---

## 2. LAYER SYSTEM

Lines are stacked in colored layers. Each trace removes the top layer, revealing the one beneath.

### Color Stack (top to bottom)
1. **Red** (1 layer remaining before blank)
2. **Amber** (2 layers)
3. **Teal** (3 layers)
4. **Violet** (4 layers)
5. **White/Silver** (5 layers, maximum depth, rare)

Why these specific colors: red/amber/teal/violet are distinguishable across the three most common forms of color vision deficiency (protanopia, deuteranopia, tritanopia). This palette was chosen for accessibility, not aesthetics alone.

### Accessibility: Beyond Color
Even with an accessible palette, color alone is not sufficient. Each layer also has a **distinct visual pattern**:
- Red: solid line
- Amber: dashed line
- Teal: dotted line
- Violet: double line
- White: glowing/pulsing line

A toggle in settings enables "pattern mode" where these patterns are always visible. In default mode, they appear as subtle texture differences that become obvious on close inspection.

### Visual Feedback on Erase
When a layer is erased, the line doesn't just disappear. It **unravels** -- the color dissolves outward from the touch point like a thread being pulled, revealing the layer beneath with a brief shimmer. On the final layer, the line fades into a faint ghost trail that dissipates over ~300ms. This micro-animation is critical for game feel.

---

## 3. SOUND DESIGN

Sound is a first-class design pillar, not a polish pass.

### Core Audio Feedback
- **Tracing over a line:** a soft, satisfying "unzipping" or thread-pulling sound. Pitch shifts subtly based on the color layer being erased (red = highest, violet = lowest). Creates an unintentional melody as you solve.
- **Final layer erase:** a distinct chime or release tone. Slightly different per color so players subconsciously learn the layer sounds.
- **Accidental draw (tracing empty):** a gentle "wrong" tone -- not punishing, more like a soft thud or muted pluck. The player should feel "oops" not "failure."
- **Completing a puzzle:** a cascading resolution sound. All remaining ghost trails dissolve in sequence with ascending tones.
- **Undo:** a soft rewind whoosh.

### Ambient
- Minimal ambient pad that shifts warmth as you progress through a world. Not melodic, just atmosphere.
- No music during gameplay. The player's tracing IS the music.
- **Dynamic consonance (reduce levels):** On reduce levels, the ambient pad subtly shifts from a dissonant chord voicing to a perfectly resolved chord as the player approaches the target. The closer to the minimum remaining layers, the more "settled" the sound becomes. Creates an instinctive sense of progress without any UI indicator.

### Audio Themes (Cosmetic, Post-Launch)
Since all sounds are Tone.js synthesis, audio themes are trivial to implement: swap the pitch arrays and synth parameters.
- **Default:** clean sine/triangle tones, neutral scale
- **Cinematic:** deep, sweeping synth pads, minor key
- **Lofi:** slightly detuned electric piano tones, jazzy intervals
- **Chiptune:** square wave, pentatonic scale
Audio themes can be bundled with visual cosmetic themes or sold separately.

### Implementation
Tone.js for synthesis. No sample libraries needed for the core sounds -- synthesized tones are lighter, more consistent, and easier to pitch-shift dynamically. This also aligns with Leo's existing Tone.js expertise from Synchoral and Lumyn.

---

## 4. LEVEL PROGRESSION AND THE AHA MOMENT

### World Structure
- **World 1: "First Light"** (Levels 1-15) -- Single color (red only), 3x3 grid, free start/end. All "clear" levels (targetLayers: 0). Teaches tracing, erasing, and the cost of accidental drawing. Pure mechanical onboarding.
- **World 2: "Layers"** (Levels 16-30) -- Multi-color layers introduced. Still 3x3. All "clear" levels. Players learn that some connections need multiple passes.
- **World 3: "The Knot"** (Levels 31-45) -- Complex Euler circuits and paths. All "clear" levels. The aha moment here is realizing you need to plan your traversal order carefully -- not every starting point and direction works, even if the puzzle is mathematically clearable. Forced start dots introduced.
- **World 4: "Remnants"** (Levels 46-60) -- **Introduces "reduce" levels** (targetLayers > 0). Forced start dots, forced end dots. 4x4 grids begin. The player learns that some patterns cannot be fully cleared and the challenge shifts to optimization.
- **World 5: "Signals"** (Levels 61-75) -- Buttons and doors. Interactive elements. Mix of "clear" and "reduce" levels. Walls (blocked connections) and irregular grids (missing dots) introduced for visual variety and forced-path design.
- **World 6: "Tools"** (Levels 76-90) -- Shatter and Phase power-ups introduced (1-2 per level). 5x5 grids begin. Directional lines on select levels. The strategic choice of when/where to use a power-up becomes part of the puzzle.
- **World 7+: "Hard Mode" variants** -- Time limits, move limits, lift penalties. Community/daily puzzles. Disabled dots (visible but unvisitable). Combines all previous mechanics.

### Level 31: The Aha Moment (Design Brief)
This level must satisfy three constraints simultaneously:
1. It looks trivially solvable on first glance -- just trace everything
2. After 2-3 failed attempts, the player realizes that starting from the wrong dot or going the wrong direction leads to dead ends
3. The solution requires finding the one correct starting dot and traversal order, and the moment you see it, it's obvious in retrospect

This is the level that defines whether the game is "a nice little puzzle" or "something I tell people about." It deserves its own design session and playtesting.

### World 4 Level 46: The Draw Aha Moment (Design Brief)
This is the second major aha moment AND the highest churn risk in the game. Up to this point, drawing is strictly penalized. Now the player must intentionally draw. This reversal of a trained behavior must be handled aggressively:

1. Level 46 must be a tiny puzzle (2x2 or minimal 3x3) so simple the player literally cannot fail
2. The disconnected section should be exactly 1 connection, reachable by drawing exactly 1 bridge
3. The gap to bridge should visually pulse or glow subtly, hinting "trace here"
4. targetLayers is generous (bridge cost + a buffer) so the player can't get stuck
5. The win celebration should explicitly say "You drew to solve!" or similar, reinforcing that drawing was correct
6. Levels 47-48 should repeat the concept with slight variations before increasing complexity

If playtesting shows players churning here, add an optional text hint: "Sometimes you need to draw new paths to reach everything." This is the ONE place in the game where showing text is justified.

### Tutorial (Levels 1-5)
No text instructions. No popups. No "tap here" arrows.
- Level 1: one line between two dots. You trace it. It disappears. Done.
- Level 2: two lines in an L shape. You learn continuous tracing.
- Level 3: three lines forming a path. You learn that longer paths work the same way.
- Level 4: a zigzag path. You learn to change direction while tracing.
- Level 5: a 2-layer connection. You learn that some lines need multiple passes.

Each level has exactly one new concept. Zero cognitive overload.

---

## 5. INTERACTIVE ELEMENTS

### Buttons
A dot with a distinct visual marker (concentric rings, pulsing glow). Passing through it toggles its state. The button activates or deactivates linked doors.
- Buttons can be **toggle** (on/off each pass) or **hold** (active only while your current continuous trace includes it, resets on lift). Hold buttons are harder.

### Doors
A connection with a visual gate/barrier. Cannot be traced while closed. Opens when its linked button is active. Door connections can have layers behind them -- the door blocks access, not existence.

### Future Interactive Elements (post-launch, noted for architecture)
- **Teleporters:** two dots linked. Entering one exits the other. Your trace continues from the exit dot.
- **Mirrors:** tracing a mirrored connection simultaneously erases its linked mirror connection elsewhere on the grid.
- **Ice:** a connection that can only be traced once per lift. If you need to pass through it twice, you must lift between.

These are NOT for v1. But the level data format must be extensible enough to support them without breaking changes.

### Power-Ups (World 5+, Limited Use)
Power-ups are earned through gameplay (e.g. 1 per world completed), never purchased. Each level that includes them gives 1-2 uses max. They create a puzzle-within-a-puzzle: choosing WHEN and WHERE to use them is itself strategic.

**Shatter:** Removes one connection entirely without traversing it. Changes the degree of both endpoint dots by the connection's layer count. Strategically the most interesting power-up because choosing the right connection to shatter can convert an impossible puzzle into a solvable one (by fixing odd-degree parity).

**Phase (Teleport):** Jump from your current dot to any other dot without traversing connections. Lets you reach isolated sections without drawing bridges. On reduce levels, a single Phase could eliminate the bridge cost entirely, lowering the achievable minimum.

**Freeze:** A specific connection can't be accidentally drawn on for 5 moves. Doesn't change the graph, just protects against mistakes. Safest power-up, good for introducing the concept.

**NOT included (too powerful):**
- Area clear / explosion: clears all connections around a dot. Trivializes puzzles.
- One-stroke multi-layer clear: removes the multi-pass challenge entirely.

Power-ups must never trivialize a level. They should turn a 3-star run from "very hard" to "hard" -- not from "hard" to "automatic."

---

## 6. TOOLCHAIN: DESIGNER → SOLVER → ENGINE

### Level Data Format (JSON)
```json
{
  "id": "w3-31",
  "name": "The Knot",
  "world": 3,
  "grid": { "cols": 3, "rows": 3 },
  "connections": [
    { "from": [0,0], "to": [1,0], "layers": 1 },
    { "from": [1,0], "to": [1,1], "layers": 2 },
    { "from": [0,1], "to": [1,1], "layers": 1, "directional": true }
  ],
  "target_layers": 0,
  "special": {
    "forced_start": [0, 0],
    "forced_end": null,
    "buttons": [
      { "dot": [2,2], "type": "toggle", "links": ["door-1"] }
    ],
    "doors": [
      { "id": "door-1", "from": [1,2], "to": [2,2], "default": "closed" }
    ]
  },
  "constraints": {
    "move_limit": null,
    "time_limit": null,
    "lift_penalty": false
  },
  "meta": {
    "difficulty": null,
    "min_moves": null,
    "solution_count": null,
    "requires_draw": false,
    "min_remaining_layers": 0,
    "euler_solvable": true
  }
}
```
The `meta` block is populated by the solver, not by hand. The designer outputs everything above `meta`, the solver fills in `meta`.

### Puzzle Designer (Internal Web Tool)
- Visual grid editor: click to place/remove connections, shift-click to add layers
- Color-coded layer visualization matching the in-game palette
- Dropdown for special elements (buttons, doors, forced start/end)
- "Verify" button runs the solver and fills in the meta block
- "Play" button launches the puzzle in a test instance of the game engine
- "Export" saves the JSON
- Batch verification: verify all levels in a world at once, flag any that are unsolvable or have unexpected difficulty

### Puzzle Solver
**Algorithm approach:** Breadth-first search over game states. A "state" is the full grid (which connections have which layers) plus the player's current dot. The solver explores all possible next moves from each state, pruning previously visited states.

For 3x3 grids with up to 20 connections and max 4 layers, the state space is manageable with BFS. For 5x5 grids, the state space explodes, so the solver needs:
- **State hashing** for O(1) visited-state lookup
- **Pruning heuristics**: if current state has more total layers than the starting state plus some threshold, abandon that branch
- **Iterative deepening** as a fallback: try solving in N moves, then N+1, etc.
- **Parallel web workers** for non-blocking verification in the designer tool

The solver outputs:
- Solvable to target: yes/no (can the puzzle reach its targetLayers?)
- Minimum moves to reach target (par score)
- Number of distinct solutions (up to a cap, e.g., stop counting at 100)
- Whether any solution requires drawing (the "requires_draw" flag)
- **Minimum remaining layers:** the theoretical floor -- the lowest total layers achievable regardless of target. Critical for level design.
- **Euler solvable:** quick parity check -- can this puzzle be cleared to 0? (at most 2 nodes with odd total degree)
- Difficulty rating: composite of min moves, solution count, requires_draw, grid size, layer depth, and whether it's a reduce level

**Difficulty formula (draft):**
```
difficulty = (min_moves * 2) + (1 / solution_count * 10) + (requires_draw ? 15 : 0) + (grid_size_factor) + (max_layer_depth * 3)
```
This is a starting point to be calibrated through playtesting. The numbers are tunable coefficients, not gospel.

---

## 7. INPUT HANDLING

### Touch Resolution
- Touch events snapped to nearest dot within a 40px radius (tunable)
- If touch is equidistant between two dots, prefer the dot that continues the current trace direction
- Path interpolation: compute the straight line between current dot and snapped target, register every dot the line passes through

### Rapid Input
- Input buffer of ~50ms to batch rapid swipes into a coherent path
- If the player swipes faster than the game can render, the game catches up visually but never drops input events
- State is always authoritative; animations are cosmetic and can lag behind state

### Dead End Detection
After each move, the solver runs a quick "is this state still solvable?" check. On 3x3 grids this is near-instant. On larger grids, a heuristic approximation is acceptable (e.g., are all remaining lines still reachable from the current dot without drawing more than N new lines?).

If a dead end is detected:
- The undo button pulses gently with a warm glow
- No popup, no text, no interruption
- The player can ignore it entirely

### Undo
- Full undo stack: every individual connection change is recorded
- Undo is per-move (one connection traversal), not per-stroke
- Redo is available if the player undoes then wants to go back
- Undo has no limit and no penalty on standard levels

---

## 8. UX AND GAME FEEL

### Essential Features
- **Undo/Redo** (see above)
- **Hint system:** first hint highlights the starting dot (if not forced). Second hint shows the first 3 moves. Third hint shows the full solution animated. Hints are limited per level (3 max) or purchasable.
- **Save state:** puzzle progress persists across app close/reopen. Uses localStorage on web, native storage on wrapped app.
- **Haptic feedback:** short tap on each dot traversed, medium pulse on layer erase, strong pulse on puzzle complete. Web Vibration API for prototype, Capacitor haptics plugin for native.
- **Smooth camera:** on 4x4 and 5x5 grids, the grid may need to be slightly zoomed. Pinch-to-zoom and pan with inertia.

### Celebration on Solve
- All ghost trails dissolve in a cascade from the last-erased connection outward
- Star rating based on move count vs par: 3 stars = at or below par, 2 stars = par + 30%, 1 star = completed at all
- Quick stats: moves used, time, comparison to par
- "Next Level" button prominent, "Replay" available

### Level Select
- World map or chapter view (not a scrolling list of 90 numbered buttons)
- Each world has a distinct color temperature matching its theme
- Locked worlds show a preview of the new mechanic they introduce
- Stars earned visible per level

---

## 9. DAILY CHALLENGE AND SOCIAL

### Daily Puzzle
- One new puzzle every day, same for all players
- Global leaderboard by move count
- Streak tracking (consecutive days completed)
- Share button generates a spoiler-free result card: grid silhouette, move count, star rating, streak count. Shareable to Twitter/Instagram/Messages.
- **Solution heatmaps (post-launch):** After completing the daily puzzle, show aggregate player behavior: "82% of players started at dot 5." Creates community engagement without requiring social features.

### "Almost Solved" Feedback
On reduce levels (and any level where the player resets or gives up), show a brief insight overlay:
- "Best possible: 2 remaining / Your result: 3 remaining"
- The solver already computes minRemainingLayers, so this is nearly free.
- Dramatically increases replay motivation on reduce levels.

### Community Levels (Post-Launch)
- In-app level editor (derived from the internal designer tool)
- Players publish puzzles, other players rate them
- Curated "Community Picks" section
- Solver verification required before publishing (no unsolvable puzzles)

### Procedural Level Generation (Post-Launch)
Puzzles can be generated algorithmically, not just hand-designed.

**Clear levels (targetLayers: 0):** Random walk generation. Start at a random dot, walk to random adjacent dots creating connections. The walk itself is a guaranteed valid solution because any path walked forward can be walked backward to erase. Multi-layer puzzles: walk the same path multiple times with variations, each pass adds a layer.

**Reduce levels (targetLayers > 0):** Generate any random graph, run the solver to compute minRemainingLayers, set targetLayers at or above that value.

**Pipeline:** Generate random puzzle, run solver, keep if difficulty score falls in target range, discard and regenerate if not. This is standard practice for published puzzle games.

**Best uses:**
- Daily puzzles (infinite content, no manual design needed)
- "Endless mode" after the player finishes all hand-designed worlds
- Filling out worlds faster (generate 50, hand-pick the best 15)

**Not suitable for:**
- Tutorial levels (need precise difficulty control)
- Aha moment levels (need intentional design)
- Difficulty curve within a world (random difficulty, not a smooth ramp)

**Recommendation:** Worlds 1-4 hand-designed using the designer tool. Daily puzzles and endless mode use procedural generation. This gives infinite content without sacrificing the curated experience.

---

## 10. AESTHETIC DIRECTION

**Visual identity: "Luminous Minimalism"**

Dark background (near-black, not pure black). Lines are the light source. The game feels like tracing glowing threads on a dark surface. Dots are subtle circles that brighten on touch. The grid itself is invisible -- only dots and lines exist.

Color palette:
- Background: #0A0A0F
- Dots (inactive): #2A2A35
- Dots (active/touched): #FFFFFF
- Red layer: #FF6B6B
- Amber layer: #FFB347
- Teal layer: #4ECDC4
- Violet layer: #9B6BFF
- White/Silver layer: #E8E8F0
- Accidental draw line: #FF4444 (brief flash) → settles to red layer color

Typography: clean geometric sans-serif. No decorative fonts anywhere. The game's personality comes from light and motion, not type.

Animations: all easing uses ease-out curves. Nothing should feel snappy or mechanical. Everything breathes.

### Brand Language
The game has a verb: "untrace." Use it everywhere to build identity:
- Undo button label: "Retrace"
- Reset button label: "Reweave"
- Puzzle complete message: "Unraveled"
- Reduce level complete: "Reduced"
- Daily puzzle: "Daily Unravel"
- Share card: "I unraveled today's Untrace in 14 moves"

This creates brand cohesion and makes the game feel like its own world, not a generic puzzle app.

---

## 11. MONETIZATION

### Model: Free + Premium Unlock
- **Free tier:** World 1 + World 2 (30 levels) with interstitial ads between levels (not during gameplay, never)
- **Premium unlock ($3.99):** removes all ads permanently, unlocks Worlds 3-7+, unlocks daily challenge, unlocks all future content updates
- **Cosmetic themes ($0.99 each):** Hacker (green-on-black terminal), Neon (80s synthwave), Paper (light mode, sketch aesthetic), Ocean (blues and cyans)
- **No consumable purchases.** No pay-to-skip. No energy system. Hints are earned through gameplay (e.g., 1 hint per 3 levels completed), not purchased.

### Why This Model
The $3.99 premium unlock is the primary revenue target. Ads exist to fund the free tier and motivate conversion, not as a revenue center. Cosmetic themes are bonus revenue and player expression. This model gets the best App Store reviews and the highest long-term retention for puzzle games in this category.

---

## 12. TECH PLAN

### Phase 1: Web Prototype (Weeks 1-3)
**Stack:** Vite + Canvas 2D + TypeScript + Tone.js
**Goal:** Core mechanic feels good. Tracing, erasing, drawing, layers, undo all work. Sound feedback in place. 5-10 hardcoded test levels.
**Deploy:** Vercel (static)
**NOT in scope:** Solver, designer, save state, menus, level select, monetization

### Phase 2: Toolchain (Weeks 4-5)
**Build:** Puzzle designer (web tool) + puzzle solver (TypeScript, runs in browser via web workers)
**Goal:** Design 30 levels for Worlds 1-2, verify all solvable, establish difficulty curve
**Output:** levels.json consumed by the game engine

### Phase 3: Full Game (Weeks 6-8)
**Build:** Level select, world map, save state, star ratings, celebration screens, settings, hint system, daily puzzle infrastructure
**Goal:** Complete, polished web game with 60+ levels across 4 worlds
**Deploy:** Vercel (static)

### Phase 4: Native Wrap (Weeks 9-10)
**Tool:** Capacitor
**Additions:** Native haptics, splash screen, app icon, App Store metadata
**Targets:** iOS App Store + Google Play
**Legal:** IP lawyer review before submission

### Phase 5: Post-Launch
- Worlds 5-7
- Community level editor
- Cosmetic themes
- Daily challenge leaderboard
- Analytics-driven difficulty rebalancing
