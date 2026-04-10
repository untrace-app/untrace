// Sparks: in-game currency for hints. Earned passively by completing levels
// and by replaying levels to achieve 3 stars.

const LS_SPARKS       = 'untrace_sparks';
const LS_COMPLETIONS  = 'untrace_completions_count';
const LS_IMPROVEMENTS = 'untrace_spark_improvements';

const DEFAULT_SPARKS = 5;

export function ensureSparksInitialized(): void {
  if (localStorage.getItem(LS_SPARKS) === null) {
    localStorage.setItem(LS_SPARKS, String(DEFAULT_SPARKS));
  }
}

export function getSparkCount(): number {
  const raw = localStorage.getItem(LS_SPARKS);
  if (raw === null) return DEFAULT_SPARKS;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? DEFAULT_SPARKS : n;
}

export function addSparks(n: number): void {
  if (n <= 0) return;
  localStorage.setItem(LS_SPARKS, String(getSparkCount() + n));
}

export function spendSparks(n: number): boolean {
  const current = getSparkCount();
  if (current < n) return false;
  localStorage.setItem(LS_SPARKS, String(current - n));
  return true;
}

function loadImprovements(): string[] {
  try {
    const raw = localStorage.getItem(LS_IMPROVEMENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveImprovements(list: string[]): void {
  localStorage.setItem(LS_IMPROVEMENTS, JSON.stringify(list));
}

/** Read a level's previous star count from the stars map. Returns 0 if unset. */
export function getLevelStars(levelId: string): number {
  try {
    const raw = localStorage.getItem('untrace_stars');
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const n = (parsed as Record<string, number>)[levelId];
      return typeof n === 'number' ? n : 0;
    }
  } catch {}
  return 0;
}

/**
 * Award sparks for a completion and return how many were earned.
 * - Every 3rd level completion yields +1.
 * - First time a level's stars jump to 3 (from 1 or 2) yields +1, once per level.
 * Both storage writes happen immediately so the level-select counter is in
 * sync by the time the celebration animation finishes.
 */
export function checkSparkEarned(
  levelId: string,
  newStars: number,
  oldStars: number,
): number {
  let earned = 0;

  const prevCount = parseInt(localStorage.getItem(LS_COMPLETIONS) || '0', 10) || 0;
  const newCount  = prevCount + 1;
  localStorage.setItem(LS_COMPLETIONS, String(newCount));
  if (newCount % 3 === 0) earned += 1;

  if (newStars === 3 && oldStars > 0 && oldStars < 3) {
    const improvements = loadImprovements();
    if (!improvements.includes(levelId)) {
      improvements.push(levelId);
      saveImprovements(improvements);
      earned += 1;
    }
  }

  if (earned > 0) addSparks(earned);
  return earned;
}
