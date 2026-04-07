// Level select screen (Phase 3)

import { getLevelCount, getCurrentLevel } from '../levels/levels.ts';
import { playButtonTap } from '../audio/audio.ts';
import { addPressFeedback } from './overlay.ts';
import { initSettings, showSettings } from './settings.ts';

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT         = "'Lexend', system-ui, sans-serif";
const FONT_HEADING = "'Lexend', system-ui, sans-serif";
const C_TEXT       = '#b17025';
const C_TEXT_SEC   = '#7f7c6c';
const C_RECESSED   = '#f0d2a8';
const C_PRIMARY    = '#fb5607';
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

let overlayEl:  HTMLDivElement | null = null;
let gridEl:     HTMLDivElement | null = null;
let onSelectCb: ((index: number) => void) | null = null;

// ─── Star dots row ────────────────────────────────────────────────────────────

function makeStarDots(count: number): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:3px;align-items:center;height:8px;';
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('div');
    const filled = i < count;
    dot.style.cssText = [
      'width:5px', 'height:5px', 'border-radius:50%', 'flex-shrink:0',
      `background:${filled ? '#ffbe0b' : '#d3d1c7'}`,
    ].join(';');
    row.appendChild(dot);
  }
  return row;
}

// ─── Grid rendering ───────────────────────────────────────────────────────────

function renderGrid(): void {
  if (!gridEl) return;
  const count    = getLevelCount();
  const starsMap = loadStars();

  // Unlock logic: level 0 always unlocked; each subsequent level requires
  // the previous level to have at least 1 star saved.
  function isUnlocked(i: number): boolean {
    if (i === 0) return true;
    return (starsMap[getCurrentLevel(i - 1).id] ?? 0) > 0;
  }

  // "Current" level: the first unlocked-but-not-yet-completed level.
  // This gets the accent highlight (state 2).
  let currentIdx = -1;
  for (let i = 0; i < count; i++) {
    if (isUnlocked(i) && (starsMap[getCurrentLevel(i).id] ?? 0) === 0) {
      currentIdx = i;
      break;
    }
  }

  gridEl.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const levelData = getCurrentLevel(i);
    const locked    = !isUnlocked(i);
    const stars     = starsMap[levelData.id] ?? 0;
    const completed = stars > 0;
    const isCurrent = i === currentIdx;

    // ── Cell wrapper ─────────────────────────────────────────────────────────
    const cell = document.createElement('div');
    cell.style.cssText = [
      'display:flex', 'flex-direction:column', 'align-items:center', 'gap:7px',
      `cursor:${locked ? 'default' : 'pointer'}`,
      '-webkit-tap-highlight-color:transparent',
      'touch-action:manipulation',
    ].join(';');

    // ── Rounded-square tile ───────────────────────────────────────────────────
    // Four states:
    //   1. Completed  – #e9e8e4 bg, #2e2f2c text, no border, star dots
    //   2. Current    – #ffffff bg, #993c49 text, 2px #993c49 border, no stars
    //   3. Unlocked   – #ffffff bg, #2e2f2c text, 1px #d3d1c7 border, no stars
    //   4. Locked     – #e9e8e4 bg @ 0.4 opacity, lock icon, no stars
    const tile = document.createElement('div');
    let bg:        string;
    let border:    string;
    let textColor: string;

    if (locked) {
      bg        = C_RECESSED;
      border    = 'none';
      textColor = '#a68168';
    } else if (completed) {
      bg        = C_RECESSED;
      border    = 'none';
      textColor = C_TEXT;
    } else if (isCurrent) {
      bg        = '#feffe5';
      border    = `2px solid ${C_PRIMARY}`;
      textColor = C_PRIMARY;
    } else {
      bg        = '#feffe5';
      border    = '1px solid #d3d1c7';
      textColor = C_TEXT;
    }

    tile.style.cssText = [
      'width:62px', 'height:62px',
      'border-radius:16px',
      `background:${bg}`,
      `border:${border}`,
      'display:flex', 'align-items:center', 'justify-content:center',
      'flex-shrink:0',
      locked ? 'opacity:0.4' : 'opacity:1',
      'transition:transform 0.15s ease-out, filter 0.15s ease-out',
    ].join(';');

    if (locked) {
      tile.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" '
        + 'stroke="#7f7c6c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
        + '<rect x="3" y="11" width="18" height="11" rx="2"/>'
        + '<path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
    } else {
      const num = document.createElement('span');
      num.textContent = String(i + 1);
      num.style.cssText = [
        `color:${textColor}`,
        'font-size:18px', 'font-weight:700',
        `font-family:${FONT_HEADING}`,
        'line-height:1', 'user-select:none',
      ].join(';');
      tile.appendChild(num);
    }

    // ── Interaction (unlocked only) ───────────────────────────────────────────
    if (!locked) {
      addPressFeedback(tile);
      cell.addEventListener('click', () => {
        if (onSelectCb) { playButtonTap(); hideLevelSelect(); onSelectCb(i); }
      });
    }

    cell.appendChild(tile);
    // Show star dots only for completed levels; spacer keeps grid alignment.
    if (completed) {
      cell.appendChild(makeStarDots(stars));
    } else {
      const spacer = document.createElement('div');
      spacer.style.cssText = 'height:8px;';
      cell.appendChild(spacer);
    }
    gridEl.appendChild(cell);
  }
}

// ─── Build overlay ────────────────────────────────────────────────────────────

function buildOverlay(ui: HTMLElement): void {
  overlayEl = document.createElement('div');
  overlayEl.style.cssText = [
    'position:fixed', 'inset:0',
    'background:#ffedcd',
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
    `color:${C_TEXT}`,
    'font-size:34px', 'font-weight:700', 'letter-spacing:-0.03em',
    `font-family:${FONT_HEADING}`, 'line-height:1',
    'margin:0 0 6px', 'user-select:none',
  ].join(';');

  const worldLabel = document.createElement('p');
  worldLabel.style.cssText = [
    `color:${C_TEXT_SEC}`,
    'font-size:12px', 'font-weight:500', 'letter-spacing:0.08em',
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
    `background:${C_RECESSED}`,
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

  // ── Gear icon (top-right, opens settings modal) ──────────────────────────
  // Matches the 40x40 inline button style used elsewhere; positioned to sit
  // vertically centered against the "Untrace" title.
  const gearBtn = document.createElement('button');
  gearBtn.setAttribute('aria-label', 'Open settings');
  gearBtn.style.cssText = [
    'position:absolute',
    'right:28px',
    'top:calc(env(safe-area-inset-top,0px) + 45px)',
    'width:40px', 'height:40px',
    'display:flex', 'align-items:center', 'justify-content:center',
    `background:${C_RECESSED}`, 'border:none', 'border-radius:9999px',
    'padding:0', 'cursor:pointer', 'outline:none',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  ].join(';');
  gearBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="24" height="24">'
    + '<path fill="#b17025" d="M195.1 9.5C198.1-5.3 211.2-16 226.4-16l59.8 0c15.2 0 28.3 10.7 31.3 25.5L332 79.5c14.1 6 27.3 13.7 39.3 22.8l67.8-22.5c14.4-4.8 30.2 1.2 37.8 14.4l29.9 51.8c7.6 13.2 4.9 29.8-6.5 39.9L447 233.3c.9 7.4 1.3 15 1.3 22.7s-.5 15.3-1.3 22.7l53.4 47.5c11.4 10.1 14 26.8 6.5 39.9l-29.9 51.8c-7.6 13.1-23.4 19.2-37.8 14.4l-67.8-22.5c-12.1 9.1-25.3 16.7-39.3 22.8l-14.4 69.9c-3.1 14.9-16.2 25.5-31.3 25.5l-59.8 0c-15.2 0-28.3-10.7-31.3-25.5l-14.4-69.9c-14.1-6-27.2-13.7-39.3-22.8L73.5 432.3c-14.4 4.8-30.2-1.2-37.8-14.4L5.8 366.1c-7.6-13.2-4.9-29.8 6.5-39.9l53.4-47.5c-.9-7.4-1.3-15-1.3-22.7s.5-15.3 1.3-22.7L12.3 185.8c-11.4-10.1-14-26.8-6.5-39.9L35.7 94.1c7.6-13.2 23.4-19.2 37.8-14.4l67.8 22.5c12.1-9.1 25.3-16.7 39.3-22.8L195.1 9.5zM256.3 336a80 80 0 1 0 -.6-160 80 80 0 1 0 .6 160z"/>'
    + '</svg>';
  addPressFeedback(gearBtn);
  gearBtn.addEventListener('click', () => { playButtonTap(); showSettings(); });
  overlayEl.appendChild(gearBtn);

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
  initSettings();
}

/**
 * Tell level-select which level is currently loaded so it can highlight it.
 * Call inside loadLevel() in main.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function setCurrentLevel(_index: number): void {
  // Current level is now derived from star data in renderGrid(); no state needed here.
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
