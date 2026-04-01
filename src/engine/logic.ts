// Erase/draw logic, win detection, undo/redo

import type { GameState, ConnectionKey, ConnectionState } from '../types.ts';

// ─── Connection key ───────────────────────────────────────────────────────────

/**
 * Build the canonical sorted key for a connection between two dots.
 * Sorts by col first, then row, so A→B and B→A produce the same key.
 */
export function makeConnectionKey(
  a: [number, number],
  b: [number, number],
): ConnectionKey {
  const aFirst = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
  const [first, second] = aFirst ? [a, b] : [b, a];
  return `${first[0]},${first[1]}-${second[0]},${second[1]}`;
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

/**
 * Shallow-clone the mutable parts of state into a self-contained snapshot.
 * Snapshots stored on the undo/redo stacks never carry their own sub-stacks.
 */
function takeSnapshot(state: GameState): GameState {
  const connections = new Map<ConnectionKey, ConnectionState>();
  for (const [key, conn] of state.connections) {
    connections.set(key, { ...conn });
  }
  return {
    grid: { ...state.grid },
    connections,
    playerDot: state.playerDot !== null ? [state.playerDot[0], state.playerDot[1]] : null,
    isTracing: false,
    moveCount: state.moveCount,
    targetLayers: state.targetLayers,
    undoStack: [],
    redoStack: [],
    currentStrokeConnections: new Set(),
  };
}

// ─── Core move ────────────────────────────────────────────────────────────────

/**
 * Process a single dot-to-dot transition.
 *
 * - If a connection exists with layers > 0, erase one layer.
 * - If a connection exists with layers === 0, draw it back as layer 1 (accidental draw).
 * - If no connection exists at all (key absent), create one at layer 1 (accidental draw on empty space).
 */
export function processMove(
  state: GameState,
  from: [number, number],
  to: [number, number],
): void {
  const key = makeConnectionKey(from, to);

  // Snapshot before any mutation so undo can restore this state.
  state.undoStack.push(takeSnapshot(state));
  state.redoStack = [];

  const conn = state.connections.get(key);
  if (conn === undefined) {
    // No level-defined connection here — accidental draw on truly empty space.
    state.connections.set(key, { layers: 1 });
  } else if (conn.layers > 0) {
    conn.layers -= 1;
  } else {
    conn.layers = 1; // redraw a fully-erased connection
  }

  state.moveCount += 1;
}

// ─── Undo / Redo ──────────────────────────────────────────────────────────────

export function undo(state: GameState): void {
  if (state.undoStack.length === 0) return;
  const snapshot = state.undoStack.pop()!;
  state.redoStack.push(takeSnapshot(state));

  state.connections = snapshot.connections;
  state.playerDot   = snapshot.playerDot;
  state.moveCount   = snapshot.moveCount;
  state.isTracing   = false;
  state.currentStrokeConnections = new Set();
}

export function redo(state: GameState): void {
  if (state.redoStack.length === 0) return;
  const snapshot = state.redoStack.pop()!;
  state.undoStack.push(takeSnapshot(state));

  state.connections = snapshot.connections;
  state.playerDot   = snapshot.playerDot;
  state.moveCount   = snapshot.moveCount;
  state.isTracing   = false;
  state.currentStrokeConnections = new Set();
}

// ─── Win detection ────────────────────────────────────────────────────────────

/**
 * Returns true when the total layers remaining across all connections is at or
 * below `targetLayers` (default 0, i.e. fully cleared).
 */
export function checkWin(state: GameState, targetLayers = state.targetLayers): boolean {
  let total = 0;
  for (const conn of state.connections.values()) {
    total += conn.layers;
  }
  return total <= targetLayers;
}
