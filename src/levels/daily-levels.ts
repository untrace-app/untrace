// Daily puzzle loading + selection.
// Puzzle choice is deterministic per calendar day so every player gets the
// same puzzle on the same day.

import type { LevelData } from '../types.ts';

let _dailyLevels: LevelData[] = [];
let _loaded = false;
let _cachedDailyNumber: number | null = null;

// Anchor for "day 1" of the daily series. Midnight local on Jan 1 2026.
const EPOCH_MS = new Date(2026, 0, 1).getTime();
const MS_PER_DAY = 86400000;

export async function loadDailyLevels(): Promise<void> {
  if (_loaded) return;
  try {
    const res = await fetch('/levels/daily.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _dailyLevels = await res.json() as LevelData[];
  } catch {
    _dailyLevels = [];
  }
  _loaded = true;
}

export function getDailyLevelCount(): number {
  return _dailyLevels.length;
}

/** Days since Jan 1 2026 (Jan 1 → 0). */
function daysSinceEpoch(): number {
  return Math.floor((Date.now() - EPOCH_MS) / MS_PER_DAY);
}

/** User-facing daily number. "Daily #1" on Jan 1 2026. */
export function getDailyNumber(): number {
  return daysSinceEpoch() + 1;
}

/**
 * Frozen daily number for the currently loaded puzzle. Set when
 * getTodaysDailyLevel() is called so the in-game header and the completion
 * screen always agree, even across a midnight rollover mid-play.
 */
export function getCachedDailyNumber(): number {
  return _cachedDailyNumber ?? getDailyNumber();
}

/** Wrapped index into the daily pool. */
export function getDailyIndex(): number {
  const total = _dailyLevels.length;
  if (total === 0) return 0;
  const d = daysSinceEpoch();
  return ((d % total) + total) % total;
}

/**
 * Today's level, with its id rewritten to "daily-current" so the save system
 * uses a single save slot regardless of which underlying puzzle is in play.
 */
export function getTodaysDailyLevel(): LevelData | null {
  if (_dailyLevels.length === 0) return null;
  const base = _dailyLevels[getDailyIndex()];
  if (!base) return null;
  _cachedDailyNumber = getDailyNumber();
  return { ...base, id: 'daily-current' };
}

/** YYYY-MM-DD in local time. */
export function getTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
