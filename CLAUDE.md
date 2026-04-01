# CLAUDE.md — Untrace

## Project Overview

Untrace is a dot-grid puzzle game where players trace over pre-drawn layered lines to erase them. Tracing empty connections accidentally draws new lines. Two level types: "clear" levels (erase everything) and "reduce" levels (minimize remaining lines to a target). Intentional drawing as a strategy is exclusive to reduce levels since bridge lines always leave residual layers. Web-first, then wrapped for iOS/Android via Capacitor.

## Stack

- **Build:** Vite
- **Language:** TypeScript (strict mode)
- **Rendering:** Canvas 2D (no WebGL, no DOM-based game rendering)
- **Audio:** Tone.js (synthesized sounds only, no sample files)
- **Styling (UI chrome only):** CSS (no Tailwind, no CSS framework). Game board is pure Canvas.
- **Deploy:** Vercel (static)
- **Testing:** Vitest for unit tests on game logic and solver
- **No frameworks:** No React, no Vue. Vanilla TypeScript. DOM manipulation only for UI chrome (menus, settings, overlays).

## Project Structure

```
untrace/
  src/
    main.ts              # Entry point, initializes canvas and game
    engine/
      state.ts           # GameState interface and state management
      input.ts           # Touch/pointer input handling, dot snapping, path interpolation
      logic.ts           # Erase/draw logic, win detection, undo/redo
      renderer.ts        # Canvas 2D rendering (grid, dots, lines, animations)
      animations.ts      # Animation queue and easing utilities
    audio/
      audio.ts           # Tone.js setup, all sound event triggers
    levels/
      levels.ts          # Level loading and level data types
      test-levels.ts     # Hardcoded Phase 1 test levels
    ui/
      overlay.ts         # In-game UI (undo, move counter, settings icon)
      settings.ts        # Settings panel
      level-select.ts    # Level select screen (Phase 3)
      celebration.ts     # Win celebration screen (Phase 3)
    solver/
      solver.ts          # BFS puzzle solver (Phase 2)
      worker.ts          # Web Worker wrapper for solver (Phase 2)
    types.ts             # Shared type definitions
    constants.ts         # Colors, sizes, timing values, all tunable numbers
  tools/
    designer/            # Puzzle designer web tool (Phase 2, separate entry point)
  public/
    levels/              # Exported level JSON files (Phase 2+)
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
7. **No external assets.** No images, no icon fonts, no audio samples. All visuals are drawn on canvas. All sounds are Tone.js synthesis. Icons are simple SVG inline or canvas-drawn shapes.
8. **Mobile-first.** All touch targets minimum 44x44px. Test on small screens (375px width) first.
9. **Performance budget.** 60fps on iPhone SE (2nd gen). The render loop must complete in <16ms. Profile before optimizing. No premature optimization.
10. **No localStorage in Phase 1** except for audio volume/mute preference. Save state comes in Phase 3.

## Color Palette

| Element            | Color   |
|--------------------|---------|
| Background         | #0A0A0F |
| Dot (inactive)     | #2A2A35 |
| Dot (active)       | #FFFFFF |
| Red layer          | #FF6B6B |
| Amber layer        | #FFB347 |
| Teal layer         | #4ECDC4 |
| Violet layer       | #9B6BFF |
| White layer        | #E8E8F0 |
| Accidental flash   | #FF4444 |
| UI text            | #FFFFFF |
| UI text secondary  | #8888AA |

## Audio Pitch Map (Layer Erase)

| Layer  | Note |
|--------|------|
| Red    | C5   |
| Amber  | A4   |
| Teal   | F4   |
| Violet | D4   |
| White  | B3   |

## Connection Key Format

Connections between dots are keyed as strings with coordinates sorted lexicographically: `"x1,y1-x2,y2"` where `(x1,y1) < (x2,y2)`. This ensures A-to-B and B-to-A reference the same connection.

## Grid Topology

3x3 grid dot coordinates: `[0,0]` through `[2,2]`. Each dot can connect to up to 8 neighbors (orthogonal + diagonal). A connection exists between two dots only if it is defined in the level data. Not all possible connections are present in every level.

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

**Critical design rule:** Draw-to-solve (intentionally drawing bridge lines) is ONLY used in reduce levels (targetLayers > 0). A clear level (targetLayers: 0) must never require drawing because bridge lines always leave residual layers that make clearing to zero impossible. Worlds 1-3 are all clear levels. World 4+ introduces reduce levels and draw-to-solve together.

The checkWin function sums all connection layers and returns true when total <= targetLayers.

## Current Phase

**Phase 1: Core Prototype.** See PRD.md for full scope. Focus: tracing feel, erase/draw logic, layers, undo, audio. 5-10 hardcoded test levels. No solver, no designer, no menus, no save state.

## What NOT to Build Yet

- Puzzle solver (Phase 2)
- Puzzle designer (Phase 2)
- Level select screen (Phase 3)
- Save state / localStorage persistence (Phase 3)
- Hint system (Phase 3)
- Daily puzzle (Phase 3)
- Star ratings and celebration screen (Phase 3)
- Capacitor / native wrap (Phase 4)
- Monetization, ads, IAP (Phase 5)

## Development Notes

- Use `npx vite` for dev server, `npx vite build` for production build
- Vercel auto-deploys from main branch
- Context7 MCP is available for looking up Tone.js and Canvas 2D API docs
- Playwright MCP is available for automated testing
- Run `npx vitest` for unit tests
