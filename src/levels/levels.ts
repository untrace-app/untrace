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

/** Return the 1-based display number within the level's world. */
export function getDisplayNumber(index: number): number {
  const level = _levels[index % _levels.length]!;
  for (let i = 0; i < _levels.length; i++) {
    if (_levels[i]!.world === level.world) return index - i + 1;
  }
  return index + 1;
}
