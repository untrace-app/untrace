// Hardcoded Phase 1 test levels

import type { LevelData } from '../types.ts';

const NO_SPECIAL: LevelData['special'] = {
  forcedStart: null, forcedEnd: null, buttons: [], doors: [],
};
const OPEN: LevelData['constraints'] = {
  moveLimit: null, timeLimit: null, liftPenalty: false,
};

export const TEST_LEVELS: readonly LevelData[] = [

  // 1 — Single line. Trivial intro.
  {
    id: '1-1', name: 'First Line', world: 1,
    grid: { cols: 3, rows: 3 },
    connections: [
      { from: [0, 0], to: [1, 0], layers: 1 },
    ],
    special: NO_SPECIAL, constraints: OPEN, targetLayers: 0,
    meta: { difficulty: 1, minMoves: 1, solutionCount: 2, requiresDraw: false },
  },

  // 2 — L-shape. Two connections, single stroke.
  {
    id: '1-2', name: 'Corner', world: 1,
    grid: { cols: 3, rows: 3 },
    connections: [
      { from: [0, 0], to: [1, 0], layers: 1 },
      { from: [1, 0], to: [1, 1], layers: 1 },
    ],
    special: NO_SPECIAL, constraints: OPEN, targetLayers: 0,
    meta: { difficulty: 1, minMoves: 2, solutionCount: 2, requiresDraw: false },
  },

  // 3 — Path. Three connections, single stroke.
  {
    id: '1-3', name: 'Path', world: 1,
    grid: { cols: 3, rows: 3 },
    connections: [
      { from: [0, 0], to: [1, 0], layers: 1 },
      { from: [1, 0], to: [2, 0], layers: 1 },
      { from: [2, 0], to: [2, 1], layers: 1 },
    ],
    special: NO_SPECIAL, constraints: OPEN, targetLayers: 0,
    meta: { difficulty: 1, minMoves: 3, solutionCount: 2, requiresDraw: false },
  },

  // 4 — The Zigzag. Z-shape path: trace (0,0)→(1,0)→(1,1)→(2,1) or reversed.
  //     Teaches accidental drawing awareness: lifting mid-trace and touching
  //     an off-path dot would draw unwanted lines.
  {
    id: '1-4', name: 'The Zigzag', world: 1,
    grid: { cols: 3, rows: 3 },
    connections: [
      { from: [0, 0], to: [1, 0], layers: 1 },
      { from: [1, 0], to: [1, 1], layers: 1 },
      { from: [1, 1], to: [2, 1], layers: 1 },
    ],
    special: NO_SPECIAL, constraints: OPEN, targetLayers: 0,
    meta: { difficulty: 2, minMoves: 3, solutionCount: 2, requiresDraw: false },
  },

  // 5 — Double layer. Single connection, 2 layers. Teaches multi-pass.
  {
    id: '1-5', name: 'Thick', world: 1,
    grid: { cols: 3, rows: 3 },
    connections: [
      { from: [0, 0], to: [1, 0], layers: 2 },
    ],
    special: NO_SPECIAL, constraints: OPEN, targetLayers: 0,
    meta: { difficulty: 2, minMoves: 2, solutionCount: 2, requiresDraw: false },
  },

  // 6 — Square. All 4 nodes degree-2 → Euler circuit. Single stroke.
  {
    id: '1-6', name: 'Square', world: 1,
    grid: { cols: 3, rows: 3 },
    connections: [
      { from: [0, 0], to: [1, 0], layers: 1 },
      { from: [1, 0], to: [1, 1], layers: 1 },
      { from: [1, 1], to: [0, 1], layers: 1 },
      { from: [0, 1], to: [0, 0], layers: 1 },
    ],
    special: NO_SPECIAL, constraints: OPEN, targetLayers: 0,
    meta: { difficulty: 2, minMoves: 4, solutionCount: 8, requiresDraw: false },
  },

  // 7 — Diagonal. Bottom-left (0,2) → center (1,1) → top-right (2,0).
  //     Both nodes are degree-1 (endpoints), center is degree-2.
  //     Euler path: trace (0,2)→(1,1)→(2,0) or reversed. 2 moves.
  {
    id: '1-7', name: 'Diagonal', world: 1,
    grid: { cols: 3, rows: 3 },
    connections: [
      { from: [0, 2], to: [1, 1], layers: 1 },
      { from: [1, 1], to: [2, 0], layers: 1 },
    ],
    special: NO_SPECIAL, constraints: OPEN, targetLayers: 0,
    meta: { difficulty: 2, minMoves: 2, solutionCount: 2, requiresDraw: false },
  },

  // 8 — Mixed layers path. (0,0)-(1,0) has 2 layers; (1,0)-(2,0) and
  //     (2,0)-(2,1) have 1 layer. All clearable: trace right to erase the
  //     1-layer edges, then shuttle back on (0,0)-(1,0) for its 2nd layer.
  //     Or: (2,1)→(2,0)→(1,0)→(0,0) [erase 3 edges, (0,0)-(1,0) now 1]
  //     → back (0,0)→(1,0) [erase last layer]. 4 moves.
  {
    id: '1-8', name: 'Mixed', world: 1,
    grid: { cols: 3, rows: 3 },
    connections: [
      { from: [0, 0], to: [1, 0], layers: 2 },
      { from: [1, 0], to: [2, 0], layers: 1 },
      { from: [2, 0], to: [2, 1], layers: 1 },
    ],
    special: NO_SPECIAL, constraints: OPEN, targetLayers: 0,
    meta: { difficulty: 3, minMoves: 4, solutionCount: null, requiresDraw: false },
  },

  // 9 — The Knot. Figure-8: two 2×2 squares sharing the edge (0,1)-(1,1).
  //     Dot numbering: 1=(0,0) 2=(1,0) 3=(2,0) / 4=(0,1) 5=(1,1) 6=(2,1).
  //     Left loop:  1-2, 2-5, 5-4, 4-1.
  //     Right loop: 4-5, 5-6, 6-3, 3-2.
  //     The shared edge 4-5 is listed twice (layers:1 each); loadLevel stores
  //     it once as layers:1. Every node has even degree → Euler circuit.
  //     Player must find the correct traversal order to clear in one stroke.
  {
    id: '1-9', name: 'The Knot', world: 1,
    grid: { cols: 3, rows: 3 },
    connections: [
      { from: [0, 0], to: [1, 0], layers: 1 }, // 1-2
      { from: [1, 0], to: [1, 1], layers: 1 }, // 2-5
      { from: [1, 1], to: [0, 1], layers: 1 }, // 5-4
      { from: [0, 1], to: [0, 0], layers: 1 }, // 4-1
      { from: [0, 1], to: [1, 1], layers: 1 }, // 4-5 (same key as 5-4; loadLevel stores once)
      { from: [1, 1], to: [2, 1], layers: 1 }, // 5-6
      { from: [2, 1], to: [2, 0], layers: 1 }, // 6-3
      { from: [2, 0], to: [1, 0], layers: 1 }, // 3-2
    ],
    special: NO_SPECIAL, constraints: OPEN, targetLayers: 0,
    meta: { difficulty: 4, minMoves: 7, solutionCount: null, requiresDraw: false },
  },

  // 10 — Remnant. T-shape: 1-2, 2-3, 2-5.
  //      1=(0,0) 2=(1,0) 3=(2,0) 5=(1,1).
  //      Degrees: 2=(1,0) has degree 3 (odd); 1, 3, 5 each have degree 1 (odd).
  //      Four odd nodes → minimum reachable total = 1. targetLayers: 1.
  //      Optimal 4-move solution: (0,0)→(1,0)→(2,0)→(1,0)→(1,1)
  //        erases 1-2, erases 2-3, redraws 2-3 (1 layer), erases 2-5.
  //        Remaining: 1 layer on (1,0)-(2,0). Total = 1. WIN.
  {
    id: '1-10', name: 'Remnant', world: 1,
    grid: { cols: 3, rows: 3 },
    connections: [
      { from: [0, 0], to: [1, 0], layers: 1 }, // 1-2
      { from: [1, 0], to: [2, 0], layers: 1 }, // 2-3
      { from: [1, 0], to: [1, 1], layers: 1 }, // 2-5
    ],
    special: NO_SPECIAL, constraints: OPEN, targetLayers: 1,
    meta: { difficulty: 3, minMoves: 4, solutionCount: null, requiresDraw: false },
  },

];
