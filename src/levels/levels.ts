// Level loading and level data types

import { TEST_LEVELS } from './test-levels.ts';
import type { LevelData } from '../types.ts';

export function getLevelCount(): number {
  return TEST_LEVELS.length;
}

export function getCurrentLevel(index: number): LevelData {
  return TEST_LEVELS[index % TEST_LEVELS.length]!;
}
