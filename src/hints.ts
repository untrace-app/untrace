// Hint system: purchase state, solution caching, active animation state.

import type { LevelData, Move } from './types.ts';
import { getSparkCount, spendSparks } from './sparks.ts';
import { solve } from './solver/solver.ts';

const LS_HINTS = 'untrace_hints_used';

type HintsMap = Record<string, number[]>;

export const HINT_COSTS: Record<number, number> = { 1: 1, 2: 1, 3: 2 };

function loadAll(): HintsMap {
  try {
    const raw = localStorage.getItem(LS_HINTS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as HintsMap;
    }
  } catch {}
  return {};
}

function saveAll(map: HintsMap): void {
  try { localStorage.setItem(LS_HINTS, JSON.stringify(map)); } catch {}
}

export function getHintsForLevel(levelId: string): number[] {
  const arr = loadAll()[levelId];
  return Array.isArray(arr) ? arr.slice() : [];
}

export function hasHint(levelId: string, tier: number): boolean {
  return getHintsForLevel(levelId).includes(tier);
}

export function purchaseHint(levelId: string, tier: number): boolean {
  if (tier < 1 || tier > 3) return false;
  if (hasHint(levelId, tier)) return false;
  const cost = HINT_COSTS[tier]!;
  if (getSparkCount() < cost) return false;
  if (!spendSparks(cost)) return false;
  const all = loadAll();
  const list = Array.isArray(all[levelId]) ? all[levelId]!.slice() : [];
  if (!list.includes(tier)) list.push(tier);
  all[levelId] = list;
  saveAll(all);
  return true;
}

export function clearHintsForLevel(levelId: string): void {
  const all = loadAll();
  if (levelId in all) {
    delete all[levelId];
    saveAll(all);
  }
}

// ─── Solution cache ────────────────────────────────────────────────────────

const _solutionCache = new Map<string, Move[] | null>();

export function getSolutionForLevel(level: LevelData): Move[] | null {
  if (_solutionCache.has(level.id)) return _solutionCache.get(level.id) ?? null;
  let sol: Move[] | null = null;
  try {
    const result = solve(level);
    sol = result.sampleSolution;
  } catch {
    sol = null;
  }
  _solutionCache.set(level.id, sol);
  return sol;
}

export function getStartingDot(level: LevelData): [number, number] | null {
  const sol = getSolutionForLevel(level);
  if (sol && sol.length > 0) return sol[0]!.from;
  if (level.special.forcedStart) return level.special.forcedStart;
  return null;
}

// ─── Current level context (for renderer overlays) ─────────────────────────

let _currentLevel: LevelData | null = null;

export function setCurrentHintLevel(level: LevelData | null): void {
  _currentLevel = level;
}

export function getCurrentHintLevel(): LevelData | null {
  return _currentLevel;
}

// ─── Active hint animation state (hint 2 / hint 3 ghost playback) ──────────

export interface HintAnimState {
  levelId:       string;
  moves:         Move[];
  startTime:     number;
  stepMs:        number;
  fadeOutStart:  number; // 0 = not yet fading
}

let _activeAnim: HintAnimState | null = null;

export function getActiveHintAnim(): HintAnimState | null {
  return _activeAnim;
}

export function startHintAnim(levelId: string, moves: Move[], stepMs: number): void {
  if (moves.length === 0) { _activeAnim = null; return; }
  _activeAnim = {
    levelId,
    moves,
    startTime: performance.now(),
    stepMs,
    fadeOutStart: 0,
  };
}

export function clearHintAnim(): void {
  _activeAnim = null;
}

export function updateHintAnim(now: number): void {
  if (!_activeAnim) return;
  const total = _activeAnim.moves.length * _activeAnim.stepMs;
  const elapsed = now - _activeAnim.startTime;
  if (_activeAnim.fadeOutStart === 0 && elapsed >= total) {
    _activeAnim.fadeOutStart = now;
  }
  if (_activeAnim.fadeOutStart !== 0 && now - _activeAnim.fadeOutStart >= 500) {
    _activeAnim = null;
  }
}

/** Compute the step duration for a full-solution playback based on length. */
export function stepMsForSolution(len: number): number {
  if (len < 8)  return 600;
  if (len <= 15) return 400;
  return 300;
}
