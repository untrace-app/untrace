// Level loading and level data types

import { TEST_LEVELS } from './test-levels.ts';
import type { LevelData } from '../types.ts';

// ─── Module state ─────────────────────────────────────────────────────────────

let _levels: LevelData[] = [];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch and parse world1.json at app startup.
 * Falls back to the hardcoded TEST_LEVELS if the fetch fails
 * (e.g. running without a dev server, or the file is missing).
 */
export async function loadLevels(): Promise<void> {
  try {
    const res = await fetch('/levels/world1.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as LevelData[];
    _levels = data;
  } catch {
    _levels = [...TEST_LEVELS];
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
