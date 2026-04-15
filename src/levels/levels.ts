// Level loading and level data types

import { TEST_LEVELS } from './test-levels.ts';
import type { LevelData } from '../types.ts';

// ─── Module state ─────────────────────────────────────────────────────────────

let _levels: LevelData[] = [];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch and parse world JSON files at app startup.
 * Concatenates World 1 and World 2 into a single array.
 * Falls back to hardcoded TEST_LEVELS if world1.json fails.
 * World 2 is silently skipped if its file is missing.
 */
export async function loadLevels(): Promise<void> {
  try {
    const res = await fetch('/levels/world1.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const w1 = await res.json() as LevelData[];
    _levels = w1;
  } catch {
    _levels = [...TEST_LEVELS];
  }

  try {
    const res = await fetch('/levels/world2.json');
    if (res.ok) {
      const w2 = await res.json() as LevelData[];
      _levels = [..._levels, ...w2];
    }
  } catch {
    // World 2 not available — use World 1 only
  }
}

export function getLevelCount(): number {
  return _levels.length;
}

export function getCurrentLevel(index: number): LevelData {
  return _levels[index % _levels.length]!;
}

export function getWorldName(): string {
  return 'World 1';
}

/**
 * If the level at `index` is the final level of its world AND a next world
 * exists in the loaded data, return that next world's number. Otherwise null.
 */
export function getWorldUnlockedByLevel(index: number): number | null {
  const total = _levels.length;
  if (index < 0 || index >= total) return null;
  const current = _levels[index]!;
  const currentWorld = current.world;
  for (let i = index + 1; i < total; i++) {
    if (_levels[i]!.world === currentWorld) return null; // not last in world
  }
  const nextWorld = currentWorld + 1;
  for (let i = 0; i < total; i++) {
    if (_levels[i]!.world === nextWorld) return nextWorld;
  }
  return null;
}

/** Return the index of the first level in the given world, or null. */
export function getFirstLevelIndexInWorld(world: number): number | null {
  for (let i = 0; i < _levels.length; i++) {
    if (_levels[i]!.world === world) return i;
  }
  return null;
}

/**
 * Dev helper: append a custom level to the in-memory level list and return
 * its index. If a level with the same id already exists, its entry is updated
 * in place and the existing index returned (idempotent across repeated taps).
 * Not persisted — lost on reload.
 */
export function injectTestLevel(level: LevelData): number {
  const existing = _levels.findIndex(l => l.id === level.id);
  if (existing >= 0) {
    _levels[existing] = level;
    return existing;
  }
  _levels.push(level);
  return _levels.length - 1;
}

/** Return the 1-based display number within the level's world. */
export function getDisplayNumber(index: number): number {
  const level = _levels[index % _levels.length]!;
  for (let i = 0; i < _levels.length; i++) {
    if (_levels[i]!.world === level.world) return index - i + 1;
  }
  return index + 1;
}
