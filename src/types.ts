// Shared type definitions for Untrace

// ─── Grid ─────────────────────────────────────────────────────────────────────

export interface GridConfig {
  cols: number;
  rows: number;
}

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * State for a single connection between two dots.
 * layers: 0 = empty, 1 = red, 2 = amber, 3 = teal, 4 = violet, 5 = white.
 * directional: present only when the connection has a forced direction.
 */
export interface ConnectionState {
  layers: number;
  directional?: { from: [number, number]; to: [number, number] };
}

// ─── Game State ───────────────────────────────────────────────────────────────

/**
 * Connection map key format: "x1,y1-x2,y2" with coordinates sorted
 * lexicographically so A→B and B→A always resolve to the same key.
 */
export type ConnectionKey = string;

export interface GameState {
  grid: GridConfig;
  /** All connections present in the current puzzle, keyed by sorted coord string. */
  connections: Map<ConnectionKey, ConnectionState>;
  /** Current dot the player is on, or null if not yet started. */
  playerDot: [number, number] | null;
  isTracing: boolean;
  moveCount: number;
  targetLayers: number;
  undoStack: GameState[];
  redoStack: GameState[];
  /** Connections modified during the current continuous stroke (finger down → up).
   *  Reset to empty on pointerup. Prevents trivial within-stroke backtracking. */
  currentStrokeConnections: Set<ConnectionKey>;
}

// ─── Level Data ───────────────────────────────────────────────────────────────

export interface LevelData {
  id: string;
  name: string;
  world: number;
  grid: GridConfig;
  targetLayers: number;
  connections: Array<{
    from: [number, number];
    to: [number, number];
    layers: number;
    directional?: boolean;
  }>;
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
  };
}

// ─── Solver ───────────────────────────────────────────────────────────────────

export interface Move {
  from: [number, number];
  to: [number, number];
  action: 'erase' | 'draw';
  layerBefore: number;
  layerAfter: number;
}

export interface SolverResult {
  solvable: boolean;
  minMoves: number | null;
  /** Capped at 100. null if unsolvable. */
  solutionCount: number | null;
  requiresDraw: boolean;
  /** Composite difficulty score. null if unsolvable. */
  difficulty: number | null;
  sampleSolution: Move[] | null;
  /** Absolute minimum total layers achievable across all explored states. */
  minRemainingLayers: number;
  /** True if the puzzle graph has 0 or 2 nodes with odd total degree (Euler path exists). */
  eulerSolvable: boolean;
}
