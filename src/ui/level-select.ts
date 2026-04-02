// Level select screen (Phase 3)

import { getLevelCount, getCurrentLevel } from '../levels/levels.ts';

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const LS_UNLOCKED = 'untrace_unlocked'; // highest unlocked level index (0-based)
const LS_STARS    = 'untrace_stars';    // JSON object: { [levelId]: starCount (0–3) }

// ─── Persistence ──────────────────────────────────────────────────────────────

function loadUnlockedUpTo(): number {
  return Math.max(0, parseInt(localStorage.getItem(LS_UNLOCKED) ?? '0', 10) || 0);
}

function saveUnlockedUpTo(index: number): void {
  if (index > loadUnlockedUpTo()) {
    localStorage.setItem(LS_UNLOCKED, String(index));
  }
}

function loadStars(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_STARS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Reject legacy array format (migrated automatically to empty object).
    if (Array.isArray(parsed)) return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

function persistStars(levelIndex: number, stars: number): void {
  const level = getCurrentLevel(levelIndex);
  const map   = loadStars();
  if (stars > (map[level.id] ?? 0)) {
    map[level.id] = stars;
    localStorage.setItem(LS_STARS, JSON.stringify(map));
  }
}

// ─── Module state ─────────────────────────────────────────────────────────────

let overlayEl:       HTMLDivElement    | null = null;
let gridEl:          HTMLDivElement    | null = null;
let activeLevelIdx   = 0;
let onSelectCb:      ((index: number) => void) | null = null;

// ─── Star dots row ────────────────────────────────────────────────────────────

function makeStarDots(count: number): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:4px;align-items:center;height:8px;';
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('div');
    const filled = i < count;
    dot.style.cssText = [
      'width:5px', 'height:5px', 'border-radius:50%', 'flex-shrink:0',
      `background:${filled ? '#4ECDC4' : 'rgba(255,255,255,0.14)'}`,
    ].join(';');
    row.appendChild(dot);
  }
  return row;
}

// ─── Grid rendering ───────────────────────────────────────────────────────────

function renderGrid(): void {
  if (!gridEl) return;
  const count      = getLevelCount();
  const starsMap   = loadStars();
  const unlockedTo = loadUnlockedUpTo();

  gridEl.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const levelData = getCurrentLevel(i);
    const isLocked  = i > unlockedTo;
    const isActive  = i === activeLevelIdx;
    const stars     = starsMap[levelData.id] ?? 0;
    const completed = stars > 0;

    // ── Cell wrapper ─────────────────────────────────────────────────────────
    const cell = document.createElement('div');
    cell.style.cssText = [
      'display:flex', 'flex-direction:column', 'align-items:center', 'gap:7px',
      `cursor:${isLocked ? 'default' : 'pointer'}`,
      '-webkit-tap-highlight-color:transparent',
      'touch-action:manipulation',
    ].join(';');

    // ── Circle ───────────────────────────────────────────────────────────────
    const circle = document.createElement('div');

    let bg: string;
    let border: string;
    let textColor: string;

    if (isLocked) {
      bg        = 'rgba(255,255,255,0.02)';
      border    = '1.5px solid rgba(255,255,255,0.07)';
      textColor = 'rgba(255,255,255,0.18)';
    } else if (isActive) {
      bg        = 'rgba(78,205,196,0.14)';
      border    = '1.5px solid #4ECDC4';
      textColor = '#4ECDC4';
    } else if (completed) {
      bg        = 'rgba(255,255,255,0.06)';
      border    = '1.5px solid rgba(255,255,255,0.22)';
      textColor = '#FFFFFF';
    } else {
      bg        = 'rgba(255,255,255,0.03)';
      border    = '1.5px solid rgba(255,255,255,0.1)';
      textColor = 'rgba(255,255,255,0.65)';
    }

    circle.style.cssText = [
      'width:62px', 'height:62px',
      'border-radius:50%',
      `background:${bg}`,
      `border:${border}`,
      'display:flex', 'align-items:center', 'justify-content:center',
      'flex-shrink:0',
      'transition:transform 0.12s ease, border-color 0.12s ease, background 0.12s ease',
    ].join(';');

    if (isLocked) {
      circle.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" `
        + `stroke="${textColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`
        + `<rect x="3" y="11" width="18" height="11" rx="2"/>`
        + `<path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
    } else {
      const num = document.createElement('span');
      num.textContent = String(i + 1);
      num.style.cssText = [
        `color:${textColor}`,
        'font-size:18px', 'font-weight:600',
        `font-family:${FONT}`,
        'line-height:1', 'user-select:none',
      ].join(';');
      circle.appendChild(num);
    }

    // ── Interaction ──────────────────────────────────────────────────────────
    if (!isLocked) {
      cell.addEventListener('pointerdown', () => {
        circle.style.transform = 'scale(0.94)';
      });
      cell.addEventListener('pointerup', () => {
        circle.style.transform = 'scale(1)';
      });
      cell.addEventListener('pointercancel', () => {
        circle.style.transform = 'scale(1)';
      });
      cell.addEventListener('click', () => {
        if (onSelectCb) {
          hideLevelSelect();
          onSelectCb(i);
        }
      });
    }

    cell.appendChild(circle);
    cell.appendChild(makeStarDots(isLocked ? 0 : stars));
    gridEl.appendChild(cell);
  }
}

// ─── Build overlay ────────────────────────────────────────────────────────────

function buildOverlay(ui: HTMLElement): void {
  overlayEl = document.createElement('div');
  overlayEl.style.cssText = [
    'position:fixed', 'inset:0',
    'background:#0A0A0F',
    'z-index:50',
    'display:flex', 'flex-direction:column',
    'overflow:hidden',
    'opacity:0',
    'transform:translateY(8px)',
    'pointer-events:none',
    'transition:opacity 0.22s ease, transform 0.22s ease',
    'will-change:opacity,transform',
  ].join(';');

  // ── Header ────────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.style.cssText = [
    'padding:env(safe-area-inset-top,0px) 28px 0',
    'padding-top:calc(env(safe-area-inset-top,0px) + 48px)',
    'padding-bottom:18px',
    'flex-shrink:0',
  ].join(';');

  const title = document.createElement('h1');
  title.textContent = 'Untrace';
  title.style.cssText = [
    'color:#FFFFFF',
    'font-size:34px', 'font-weight:700', 'letter-spacing:-0.03em',
    `font-family:${FONT}`, 'line-height:1',
    'margin:0 0 6px', 'user-select:none',
  ].join(';');

  const worldLabel = document.createElement('p');
  worldLabel.style.cssText = [
    'color:rgba(255,255,255,0.38)',
    'font-size:12px', 'font-weight:600', 'letter-spacing:0.1em',
    'text-transform:uppercase',
    `font-family:${FONT}`,
    'margin:0', 'user-select:none',
  ].join(';');

  // Derive world name from level data
  const levelCount = getLevelCount();
  if (levelCount > 0) {
    const firstLevel = getCurrentLevel(0);
    const worldNum   = firstLevel.world;
    const worldNames: Record<number, string> = {
      1: 'First Light', 2: 'Layers', 3: 'The Knot', 4: 'Remnants',
    };
    worldLabel.textContent = `World ${worldNum} — ${worldNames[worldNum] ?? ''}`;
  } else {
    worldLabel.textContent = 'World 1 — First Light';
  }

  header.appendChild(title);
  header.appendChild(worldLabel);

  // ── Divider ───────────────────────────────────────────────────────────────
  const divider = document.createElement('div');
  divider.style.cssText = [
    'height:1px',
    'background:linear-gradient(90deg,rgba(78,205,196,0.35) 0%,rgba(78,205,196,0.08) 60%,transparent 100%)',
    'flex-shrink:0',
    'margin:0 28px',
  ].join(';');

  // ── Scroll area with level grid ───────────────────────────────────────────
  const scroll = document.createElement('div');
  scroll.style.cssText = [
    'flex:1',
    'overflow-y:auto',
    '-webkit-overflow-scrolling:touch',
    'padding:24px 24px 64px',
  ].join(';');

  gridEl = document.createElement('div');
  gridEl.style.cssText = [
    'display:grid',
    'grid-template-columns:repeat(3,1fr)',
    'gap:18px 12px',
    'max-width:380px',
    'margin:0 auto',
  ].join(';');

  scroll.appendChild(gridEl);
  overlayEl.appendChild(header);
  overlayEl.appendChild(divider);
  overlayEl.appendChild(scroll);
  ui.appendChild(overlayEl);
}

// ─── Show / hide ──────────────────────────────────────────────────────────────

/** Show the level select overlay. */
export function showLevelSelect(): void {
  if (!overlayEl) return;
  renderGrid();
  overlayEl.style.pointerEvents = 'auto';
  // Double rAF to ensure transition plays after display state settles.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (overlayEl) {
        overlayEl.style.opacity   = '1';
        overlayEl.style.transform = 'translateY(0)';
      }
    });
  });
}

/** Hide the level select overlay. */
export function hideLevelSelect(): void {
  if (!overlayEl) return;
  overlayEl.style.opacity       = '0';
  overlayEl.style.transform     = 'translateY(8px)';
  overlayEl.style.pointerEvents = 'none';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the level-select overlay and back button.
 * Call once after loadLevels() resolves.
 * @param onSelect  Invoked with the tapped level index when the player picks a level.
 */
export function initLevelSelect(onSelect: (index: number) => void): void {
  const ui = document.getElementById('ui')!;
  onSelectCb = onSelect;
  buildOverlay(ui);
}

/**
 * Tell level-select which level is currently loaded so it can highlight it.
 * Call inside loadLevel() in main.ts.
 */
export function setCurrentLevel(index: number): void {
  activeLevelIdx = index;
}

/**
 * Record a level completion. Persists stars and unlocks the next level.
 * Call when the player wins before showing level select.
 */
export function completedLevel(index: number, stars: number): void {
  persistStars(index, stars);
  saveUnlockedUpTo(index + 1);
}

/** Returns the highest currently unlocked level index. */
export function getUnlockedLevel(): number {
  return loadUnlockedUpTo();
}
