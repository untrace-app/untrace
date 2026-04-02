// BFS puzzle solver (Phase 2)

import type { LevelData, SolverResult, Move } from '../types.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Compact in-solver connection key: "c1,r1-c2,r2" (same format as game). */
type CKey = string;

/**
 * Solver state: immutable snapshot used for BFS.
 * layers is a Map<CKey, number> of current layer counts.
 * player is [col, row] or null (not yet placed / lifted).
 */
interface State {
  layers: Map<CKey, number>;
  player: [number, number] | null;
  moves: Move[];
  hasDraw: boolean;
}

// ─── Key helpers ──────────────────────────────────────────────────────────────

function makeKey(a: [number, number], b: [number, number]): CKey {
  const aFirst = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
  const [f, s] = aFirst ? [a, b] : [b, a];
  return `${f[0]},${f[1]}-${s[0]},${s[1]}`;
}

/**
 * Build a deterministic hash string for a state.
 * Sorts connection keys so hash is order-independent.
 * Format: "<key>:<layers>|..." + "@col,row"
 */
function hashState(layers: Map<CKey, number>, player: [number, number] | null): string {
  const parts: string[] = [];
  for (const [k, v] of layers) {
    if (v !== 0) parts.push(`${k}:${v}`);
  }
  parts.sort();
  const playerStr = player === null ? 'null' : `${player[0]},${player[1]}`;
  return parts.join('|') + '@' + playerStr;
}

/** Sum of all layer counts across connections. */
function totalLayers(layers: Map<CKey, number>): number {
  let sum = 0;
  for (const v of layers.values()) sum += v;
  return sum;
}

/** Returns true when every connection has exactly layers === 1. */
function allSingleLayer(layers: Map<CKey, number>): boolean {
  for (const v of layers.values()) {
    if (v !== 1) return false;
  }
  return true;
}

// ─── Erase / draw logic (mirrors processMove in logic.ts) ────────────────────

/**
 * Apply a single move (from → to) to a layers map.
 * Returns { newLayers, action, layerBefore, layerAfter }.
 * Does NOT mutate the input map.
 */
function applyMove(
  layers: Map<CKey, number>,
  from: [number, number],
  to: [number, number],
): { newLayers: Map<CKey, number>; action: 'erase' | 'draw'; layerBefore: number; layerAfter: number } {
  const key = makeKey(from, to);
  const layerBefore = layers.get(key) ?? 0;
  let layerAfter: number;
  let action: 'erase' | 'draw';

  if (layerBefore > 0) {
    layerAfter = layerBefore - 1;
    action = 'erase';
  } else {
    layerAfter = 1;
    action = 'draw';
  }

  const newLayers = new Map(layers);
  newLayers.set(key, layerAfter);
  return { newLayers, action, layerBefore, layerAfter };
}

// ─── Neighbour generation ─────────────────────────────────────────────────────

/**
 * All dots reachable from (col, row) in one step (orthogonal + diagonal),
 * within the grid bounds. Includes intermediate dots for skipped moves:
 * the solver always moves one dot at a time, so we enumerate immediate
 * neighbours only (no skipping). The game's "no skip" rule is enforced by
 * input; the solver just explores one-step transitions.
 */
function neighbours(col: number, row: number, cols: number, rows: number): [number, number][] {
  const result: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nc = col + dc;
      const nr = row + dr;
      if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
        result.push([nc, nr]);
      }
    }
  }
  return result;
}

// ─── Euler solvability check ──────────────────────────────────────────────────

/**
 * Returns the node keys whose total degree (sum of incident layer counts) is odd.
 * Used both for eulerSolvable determination and for validating forcedStart.
 */
function oddDegreeKeys(layers: Map<CKey, number>): string[] {
  const degree = new Map<string, number>();
  for (const [key, count] of layers) {
    if (count === 0) continue;
    const dash = key.indexOf('-');
    const a = key.slice(0, dash);
    const b = key.slice(dash + 1);
    degree.set(a, (degree.get(a) ?? 0) + count);
    degree.set(b, (degree.get(b) ?? 0) + count);
  }
  const result: string[] = [];
  for (const [node, deg] of degree) {
    if (deg % 2 !== 0) result.push(node);
  }
  return result;
}

/**
 * A puzzle graph has an Euler path (clearable to 0 in theory) iff at most
 * 2 nodes have odd total degree. Degree of a node is the sum of layers on
 * all connections incident to that node.
 */
function computeEulerSolvable(layers: Map<CKey, number>): boolean {
  const n = oddDegreeKeys(layers).length;
  return n === 0 || n === 2;
}

// ─── Hierholzer's algorithm ───────────────────────────────────────────────────

/** Parse a "col,row" node key back to grid coordinates. */
function parseNode(key: string): [number, number] {
  const comma = key.indexOf(',');
  return [parseInt(key.slice(0, comma)), parseInt(key.slice(comma + 1))];
}

/**
 * Build an undirected adjacency list from the layers map.
 * Each edge with count n contributes n copies of each direction.
 */
function buildAdjList(layers: Map<CKey, number>): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const [key, count] of layers) {
    if (count === 0) continue;
    const dash = key.indexOf('-');
    const a = key.slice(0, dash);
    const b = key.slice(dash + 1);
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    for (let i = 0; i < count; i++) {
      adj.get(a)!.push(b);
      adj.get(b)!.push(a);
    }
  }
  return adj;
}

/**
 * Returns true when all nodes with edges form one connected component.
 * Required beyond degree-parity to guarantee an Euler path exists.
 */
function isEdgeConnected(layers: Map<CKey, number>): boolean {
  const adj = new Map<string, Set<string>>();
  for (const [key, count] of layers) {
    if (count === 0) continue;
    const dash = key.indexOf('-');
    const a = key.slice(0, dash);
    const b = key.slice(dash + 1);
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }
  if (adj.size === 0) return true;
  const start = adj.keys().next().value!;
  const seen = new Set<string>([start]);
  const queue: string[] = [start];
  while (queue.length > 0) {
    for (const u of adj.get(queue.pop()!)!) {
      if (!seen.has(u)) { seen.add(u); queue.push(u); }
    }
  }
  return seen.size === adj.size;
}

/** Returns all node keys whose degree (neighbor count) is odd. */
function oddDegreeNodes(adj: Map<string, string[]>): string[] {
  const odd: string[] = [];
  for (const [node, nbrs] of adj) {
    if (nbrs.length % 2 !== 0) odd.push(node);
  }
  return odd;
}

/**
 * Hierholzer's algorithm: finds one Euler path/circuit starting at `start`.
 * Works on a deep copy of adjInput so the caller's list is not mutated.
 * Returns the node-key sequence; length is edgeCount + 1.
 */
function hierholzer(adjInput: Map<string, string[]>, start: string): string[] {
  const adj = new Map<string, string[]>();
  for (const [k, v] of adjInput) adj.set(k, [...v]);

  const stack: string[] = [start];
  const path: string[] = [];

  while (stack.length > 0) {
    const v = stack[stack.length - 1]!;
    const vNbrs = adj.get(v) ?? [];
    if (vNbrs.length > 0) {
      const u = vNbrs.pop()!;
      // Remove the reverse edge (one occurrence of v from u's list).
      const uNbrs = adj.get(u)!;
      const idx = uNbrs.lastIndexOf(v);
      if (idx !== -1) uNbrs.splice(idx, 1);
      stack.push(u);
    } else {
      path.push(stack.pop()!);
    }
  }

  path.reverse();
  return path;
}

/** Convert a node-key path into a Move array (all single-layer erases). */
function pathToMoves(path: string[]): Move[] {
  const moves: Move[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    moves.push({
      from:        parseNode(path[i]!),
      to:          parseNode(path[i + 1]!),
      action:      'erase',
      layerBefore: 1,
      layerAfter:  0,
    });
  }
  return moves;
}

/**
 * Count Euler paths starting at `start` via backtracking DFS.
 * Mutates `adj` in place but fully restores it — safe to call multiple times
 * on the same adjacency list.  Returns count, capped at `cap`.
 */
function countEulerPaths(
  adj: Map<string, string[]>,
  start: string,
  totalEdges: number,
  cap: number,
): number {
  function dfs(cur: string, used: number): number {
    if (used === totalEdges) return 1;
    const nbrs = adj.get(cur)!;
    let count = 0;
    // Iterate in reverse so splice-at-index restores correctly.
    for (let i = nbrs.length - 1; i >= 0; i--) {
      const u = nbrs[i]!;
      nbrs.splice(i, 1);
      const uNbrs = adj.get(u)!;
      const j = uNbrs.lastIndexOf(cur);
      uNbrs.splice(j, 1);

      count += dfs(u, used + 1);

      // Restore both directions.
      nbrs.splice(i, 0, u);
      uNbrs.splice(j, 0, cur);

      if (count >= cap) return count;
    }
    return count;
  }
  return dfs(start, 0);
}

// ─── Greedy multi-layer Euler solver ─────────────────────────────────────────

/**
 * Greedy Euler path finder for multi-layer Euler-solvable puzzles.
 * Builds an expanded adjacency list (each layer = a separate edge entry) so
 * Hierholzer's algorithm can traverse multi-layer connections correctly.
 * Converts the resulting node-sequence into Move objects by tracking per-edge
 * layer counts and decrementing by 1 on each traversal.
 * Guaranteed to succeed for any Euler-solvable connected graph.
 */
function greedyEulerSolve(initLayers: Map<CKey, number>, forcedStartKey: string | null = null): Move[] {
  // Expand multi-layer edges: each layer becomes a separate adjacency-list entry.
  const adj  = buildAdjList(initLayers);
  const odds = oddDegreeNodes(adj);

  let startNode = '';
  if (forcedStartKey !== null && adj.has(forcedStartKey)) {
    startNode = forcedStartKey;
  } else if (odds.length === 2) {
    startNode = odds[0]!;
  } else {
    for (const [n, nbrs] of adj) {
      if (nbrs.length > 0) { startNode = n; break; }
    }
  }
  if (startNode === '') return [];

  const path = hierholzer(adj, startNode);

  // Convert node-sequence to Move objects, decrementing layer per traversal.
  const layers = new Map(initLayers);
  const moves: Move[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from: [number, number] = parseNode(path[i]!);
    const to:   [number, number] = parseNode(path[i + 1]!);
    const key = makeKey(from, to);
    const layerBefore = layers.get(key) ?? 0;
    const layerAfter  = layerBefore - 1;
    layers.set(key, layerAfter);
    moves.push({ from, to, action: 'erase', layerBefore, layerAfter });
  }
  return moves;
}

// ─── Difficulty score ─────────────────────────────────────────────────────────

/**
 * Composite difficulty heuristic (tunable):
 * - Base: minMoves (raw move count)
 * - +5 per solution that requires a draw
 * - +log2(1/solutionCount) penalty for uniqueness (fewer solutions = harder)
 * - Clamped to [1, 100]
 */
function computeDifficulty(minMoves: number, solutionCount: number, requiresDraw: boolean): number {
  let score = minMoves;
  if (requiresDraw) score += 5;
  // Uniqueness bonus: 100 solutions → +0, 1 solution → +~6.6
  score += Math.log2(100 / Math.max(1, solutionCount));
  return Math.max(1, Math.min(100, Math.round(score)));
}

// ─── Pruning threshold ────────────────────────────────────────────────────────

const DRAW_OVERHEAD_RATIO = 3.0; // abandon if total layers exceed start * this

// ─── Main solver ──────────────────────────────────────────────────────────────

export function solve(level: LevelData): SolverResult {
  const { cols, rows } = level.grid;
  const target = level.targetLayers;

  // Build initial layers map from level data.
  const initLayers = new Map<CKey, number>();
  for (const c of level.connections) {
    const key = makeKey(c.from, c.to);
    // Accumulate in case the same edge appears twice (e.g. figure-8 levels).
    initLayers.set(key, (initLayers.get(key) ?? 0) + c.layers);
  }

  const startTotal = totalLayers(initLayers);
  const drawBudget = Math.ceil(startTotal * DRAW_OVERHEAD_RATIO);

  // Euler solvability is a static property of the initial graph.
  const eulerSolvable = computeEulerSolvable(initLayers);

  // Forced start / end dot keys (node-key format "col,row").
  const forcedStart = level.special.forcedStart;
  const forcedEnd   = level.special.forcedEnd;
  const fsKey = forcedStart ? `${forcedStart[0]},${forcedStart[1]}` : null;
  const feKey = forcedEnd   ? `${forcedEnd[0]},${forcedEnd[1]}`   : null;

  // Odd-degree nodes of the initial graph, needed to validate forcedStart.
  // A forcedStart is a valid Euler starting node when:
  //   • it is not set (no constraint), OR
  //   • the graph is an Euler circuit (0 odd-degree nodes) — any start is valid, OR
  //   • the graph is an Euler path (2 odd-degree nodes) — start must be one of them.
  const initOddKeys = oddDegreeKeys(initLayers);
  const fsIsValidEulerStart =
    fsKey === null ||
    initOddKeys.length === 0 ||
    initOddKeys.includes(fsKey);

  // Track the global minimum remaining layers seen across ALL states.
  let minRemainingLayers = startTotal;

  // BFS queue. Each state includes the full move history for sampleSolution.
  // To keep memory manageable we store the move list only up to the first
  // solution; thereafter we just count additional solutions.

  const visited = new Set<string>();

  // Initial states: if forcedStart is set use only that dot, otherwise try all.
  const queue: State[] = [];
  if (forcedStart !== null) {
    const player = forcedStart as [number, number];
    const h = hashState(initLayers, player);
    visited.add(h);
    queue.push({ layers: initLayers, player, moves: [], hasDraw: false });
  } else {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const player: [number, number] = [c, r];
        const h = hashState(initLayers, player);
        if (!visited.has(h)) {
          visited.add(h);
          queue.push({ layers: initLayers, player, moves: [], hasDraw: false });
        }
      }
    }
  }

  // ── Hierholzer fast path ────────────────────────────────────────────────────
  // Applies when: all connections are single-layer, eulerSolvable is true,
  // targetLayers is 0, and the edge-containing subgraph is connected.
  // Hierholzer's finds one solution in O(E); backtracking DFS counts up to 100.
  if (
    eulerSolvable &&
    target === 0 &&
    startTotal > 0 &&
    allSingleLayer(initLayers) &&
    isEdgeConnected(initLayers)
  ) {
    // If forcedStart is set to an even-degree node on a path graph, it is not a
    // valid Euler start — skip this fast path; BFS will correctly return unsolvable.
    if (fsKey !== null && !fsIsValidEulerStart) {
      // fall through to BFS
    } else {
    const adj  = buildAdjList(initLayers);
    const odds = oddDegreeNodes(adj);

    // Choose start node: forcedStart overrides degree-based heuristic.
    // When forcedEnd is set (no forcedStart), pick the start that causes the
    // path to end at feKey: for Euler paths, start from the other odd node;
    // for Euler circuits, start from feKey itself (a circuit ends at its start).
    let startNode = '';
    if (fsKey !== null && adj.has(fsKey)) {
      startNode = fsKey;
    } else if (feKey !== null) {
      if (odds.length === 2) {
        startNode = odds.find(n => n !== feKey) ?? odds[0]!;
      } else {
        startNode = adj.has(feKey) ? feKey : '';
        if (startNode === '') {
          for (const [n, nbrs] of adj) { if (nbrs.length > 0) { startNode = n; break; } }
        }
      }
    } else if (odds.length === 2) {
      startNode = odds[0]!;
    } else {
      for (const [n, nbrs] of adj) {
        if (nbrs.length > 0) { startNode = n; break; }
      }
    }

    const pathNodes = hierholzer(adj, startNode);
    const sample    = pathToMoves(pathNodes);

    // Validate forcedEnd: if set, the path must end at feKey.
    const pathEnd = pathNodes.length > 0 ? pathNodes[pathNodes.length - 1]! : '';
    if (feKey !== null && pathEnd !== feKey) {
      // End constraint not satisfied; fall through to BFS.
    } else {
      // Determine valid start nodes for solution counting, respecting constraints.
      let countStartNodes: string[];
      if (fsKey !== null && adj.has(fsKey)) {
        if (feKey !== null) {
          // Both constrained: valid only when the path from fsKey ends at feKey.
          const compatible = odds.length === 2
            ? feKey === odds.find(n => n !== fsKey)
            : feKey === fsKey; // circuit ends at start
          countStartNodes = compatible ? [fsKey] : [];
        } else {
          countStartNodes = [fsKey];
        }
      } else if (feKey !== null) {
        // Only feKey constrained: start from node(s) whose path ends at feKey.
        if (odds.length === 2) {
          countStartNodes = odds.filter(n => n !== feKey);
        } else {
          countStartNodes = adj.has(feKey) ? [feKey] : [];
        }
      } else {
        countStartNodes = odds.length === 2
          ? odds
          : Array.from(adj.keys()).filter(n => (adj.get(n)?.length ?? 0) > 0);
      }

      let eulerCount = 0;
      for (const sn of countStartNodes) {
        eulerCount += countEulerPaths(adj, sn, startTotal, 100 - eulerCount);
        if (eulerCount >= 100) { eulerCount = 100; break; }
      }

      return {
        solvable:           true,
        minMoves:           sample.length,
        solutionCount:      eulerCount,
        requiresDraw:       false,
        difficulty:         computeDifficulty(sample.length, eulerCount, false),
        sampleSolution:     sample,
        minRemainingLayers: 0,
        eulerSolvable:      true,
      };
    }
    } // end else (fsIsValidEulerStart)
  }

  // ── Greedy multi-layer Euler fast path ────────────────────────────────────
  // Applies when: multi-layer, eulerSolvable, targetLayers 0, connected.
  // greedyEulerSolve uses Hierholzer's on the expanded adjacency list so it is
  // guaranteed to find a valid solution — no null fallback needed.
  if (
    eulerSolvable &&
    target === 0 &&
    startTotal > 0 &&
    !allSingleLayer(initLayers) &&
    isEdgeConnected(initLayers)
  ) {
    if (fsKey !== null && !fsIsValidEulerStart) {
      // forcedStart is not a valid Euler start; fall through to BFS.
    } else {
      const greedyMoves = greedyEulerSolve(initLayers, fsKey);
      // Validate forcedEnd: last move must end at feKey if set.
      const lastMove = greedyMoves[greedyMoves.length - 1];
      const lastToKey = lastMove ? `${lastMove.to[0]},${lastMove.to[1]}` : '';
      if (feKey === null || lastToKey === feKey) {
        return {
          solvable:           true,
          minMoves:           greedyMoves.length,
          solutionCount:      null,
          requiresDraw:       false,
          difficulty:         computeDifficulty(greedyMoves.length, 1, false),
          sampleSolution:     greedyMoves,
          minRemainingLayers: 0,
          eulerSolvable:      true,
        };
      }
      // feKey not satisfied; fall through to BFS.
    }
  }

  // BFS result accumulators.
  let solvable = false;
  let minMoves: number | null = null;
  let solutionCount = 0;
  let requiresDraw = false;
  let sampleSolution: Move[] | null = null;
  const SOLUTION_CAP = 100;

  let head = 0; // pointer into queue (avoids O(n) shift)

  while (head < queue.length) {
    const state = queue[head++]!;
    const { layers, player, moves, hasDraw } = state;

    const remaining = totalLayers(layers);
    if (remaining < minRemainingLayers) minRemainingLayers = remaining;

    // Win check.
    if (remaining <= target) {
      // If forcedEnd is set the player must be on that dot.
      if (feKey !== null && `${player![0]},${player![1]}` !== feKey) continue;

      solvable = true;
      const moveCount = moves.length;

      if (minMoves === null || moveCount < minMoves) {
        // Found a strictly shorter solution: reset counter.
        minMoves = moveCount;
        solutionCount = 1;
        requiresDraw = hasDraw;
        sampleSolution = moves;
      } else if (moveCount === minMoves) {
        solutionCount = Math.min(solutionCount + 1, SOLUTION_CAP);
        if (hasDraw) requiresDraw = true;
      }

      // Don't explore further from a winning state.
      continue;
    }

    // Pruning: skip if we've already found a shorter solution and this state
    // can't possibly beat it.
    if (minMoves !== null && moves.length >= minMoves) continue;

    // Pruning: abandon runaway draw states.
    if (remaining > drawBudget) continue;

    if (player === null) continue; // shouldn't happen

    const [col, row] = player;
    const nbrs = neighbours(col, row, cols, rows);

    for (const nb of nbrs) {
      const { newLayers, action, layerBefore, layerAfter } = applyMove(layers, player, nb);

      const h = hashState(newLayers, nb);
      if (visited.has(h)) continue;
      visited.add(h);

      const move: Move = {
        from: [col, row],
        to:   [nb[0], nb[1]],
        action,
        layerBefore,
        layerAfter,
      };

      queue.push({
        layers:  newLayers,
        player:  nb,
        moves:   [...moves, move],
        hasDraw: hasDraw || action === 'draw',
      });
    }
  }

  // Euler fast-path: if the graph satisfies the Euler path/circuit condition
  // and targetLayers is 0, solvability is mathematically guaranteed — unless
  // forcedStart is set to an invalid Euler starting node, in which case the
  // puzzle is genuinely unsolvable with that constraint.
  if (!solvable && eulerSolvable && target === 0 && fsIsValidEulerStart) {
    solvable = true;
    // minMoves and sampleSolution remain null — BFS was exhausted before
    // finding the solution, so we can confirm solvable but not the path.
  }

  const difficulty = solvable
    ? (minMoves !== null ? computeDifficulty(minMoves, solutionCount, requiresDraw) : null)
    : null;

  return {
    solvable,
    minMoves:            solvable ? minMoves : null,
    solutionCount:       solvable ? solutionCount : null,
    requiresDraw,
    difficulty,
    sampleSolution:      solvable ? sampleSolution : null,
    minRemainingLayers,
    eulerSolvable,
  };
}
