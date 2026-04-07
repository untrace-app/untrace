// Level select screen — winding path map layout

import { getLevelCount, getCurrentLevel } from '../levels/levels.ts';
import { playButtonTap } from '../audio/audio.ts';
import { addPressFeedback } from './overlay.ts';
import { initSettings, showSettings } from './settings.ts';
import { FONT, FONT_HEADING, C_TEXT, C_TEXT_SEC, C_RECESSED } from '../constants.ts';

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_UNLOCKED = 'untrace_unlocked';
const LS_STARS    = 'untrace_stars';

// Node dimensions
const NODE_SIZE    = 64;  // px diameter, standard
const NODE_CURRENT = 78;  // px diameter, active level
const V_SPACING    = 120; // px between node centers vertically
const TOP_PAD      = 28;  // px above first node center
const BOT_PAD      = 72;  // px below last node bottom

// Winding x-positions grouped in sets of 5 so each group of levels has its own feel
const X_PATTERN = [
  // Group 1 — gentle left-to-right drift
  0.20, 0.35, 0.55, 0.72, 0.82,
  // Group 2 — tight zigzag
  0.22, 0.78, 0.24, 0.76, 0.26,
  // Group 3 — wide sweep right-to-left
  0.80, 0.60, 0.42, 0.24, 0.18,
  // Group 4 — clustered center with variance
  0.48, 0.62, 0.38, 0.55, 0.44,
  // Group 5 — alternating far extremes
  0.16, 0.84, 0.12, 0.88, 0.14,
  // Group 6 — relaxed wave
  0.68, 0.50, 0.32, 0.58, 0.76,
];

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

function getTotalStars(): number {
  const map = loadStars();
  return Object.values(map).reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0);
}

// ─── Module state ─────────────────────────────────────────────────────────────

let overlayEl:  HTMLDivElement | null = null;
let pathEl:     HTMLDivElement | null = null;
let onSelectCb: ((index: number) => void) | null = null;

// ─── CSS injection ────────────────────────────────────────────────────────────

let _stylesInjected = false;
function injectStyles(): void {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = [
    '@keyframes ls-pulse {',
    '  0%,100% { transform:scale(1.0); }',
    '  50%      { transform:scale(1.08); }',
    '}',
  ].join('\n');
  document.head.appendChild(s);
}

// ─── Star SVG ─────────────────────────────────────────────────────────────────

function starSVG(size: number, strokeW: number, strokeColor: string, gradId: string): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" `
    + `fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="${strokeW}" `
    + `stroke-linecap="round" stroke-linejoin="round">`
    + `<defs><radialGradient id="${gradId}" cx="50%" cy="30%" r="65%">`
    + `<stop offset="0%" stop-color="#ffbe0b"/>`
    + `<stop offset="100%" stop-color="#f59e0b"/>`
    + `</radialGradient></defs>`
    + `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`
    + `</svg>`;
}

// ─── Path rendering ───────────────────────────────────────────────────────────

function getNodeX(index: number, pathWidth: number, radius: number): number {
  const frac = X_PATTERN[index % X_PATTERN.length]!;
  return Math.max(radius + 10, Math.min(pathWidth - radius - 10, frac * pathWidth));
}

function renderPath(): void {
  if (!pathEl) return;

  const count    = getLevelCount();
  const starsMap = loadStars();

  function isUnlocked(i: number): boolean {
    if (i === 0) return true;
    return (starsMap[getCurrentLevel(i - 1).id] ?? 0) > 0;
  }

  // First unlocked-but-not-yet-completed level is "current"
  let currentIdx = -1;
  for (let i = 0; i < count; i++) {
    if (isUnlocked(i) && (starsMap[getCurrentLevel(i).id] ?? 0) === 0) {
      currentIdx = i;
      break;
    }
  }

  pathEl.innerHTML = '';

  const pathWidth  = pathEl.offsetWidth || 320;
  const nodeRadius = NODE_SIZE / 2;
  const minHeight  = TOP_PAD + nodeRadius + (count - 1) * V_SPACING + nodeRadius + 32 + BOT_PAD;
  pathEl.style.minHeight = `${minHeight}px`;

  // Compute center positions for every node
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const isCurrent = i === currentIdx;
    const radius    = (isCurrent ? NODE_CURRENT : NODE_SIZE) / 2;
    positions.push({
      x: getNodeX(i, pathWidth, radius),
      y: TOP_PAD + nodeRadius + i * V_SPACING,
    });
  }

  // ── SVG connecting lines (z-index:1, behind nodes) ────────────────────────
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg   = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width',  String(pathWidth));
  svg.setAttribute('height', String(minHeight));
  svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:1;overflow:visible;';

  for (let i = 0; i < count - 1; i++) {
    const a = positions[i]!;
    const b = positions[i + 1]!;
    const aStars  = starsMap[getCurrentLevel(i).id] ?? 0;
    const bStars  = starsMap[getCurrentLevel(i + 1).id] ?? 0;
    const lineCol = (aStars > 0 && bStars > 0) ? '#ffbe0b' : '#f0d2a8';

    // S-curve: control points anchor to each node's side, curving into midpoint
    const offset = V_SPACING * 0.38;
    const line   = document.createElementNS(svgNS, 'path');
    line.setAttribute('d', `M ${a.x} ${a.y} C ${a.x} ${a.y + offset} ${b.x} ${b.y - offset} ${b.x} ${b.y}`);
    line.setAttribute('stroke',          lineCol);
    line.setAttribute('stroke-width',    '4');
    line.setAttribute('stroke-linecap',  'round');
    line.setAttribute('fill',            'none');
    svg.appendChild(line);
  }
  pathEl.appendChild(svg);

  // ── Level nodes ───────────────────────────────────────────────────────────
  for (let i = 0; i < count; i++) {
    const pos       = positions[i]!;
    const levelData = getCurrentLevel(i);
    const locked    = !isUnlocked(i);
    const stars     = starsMap[levelData.id] ?? 0;
    const completed = stars > 0;
    const isCurrent = i === currentIdx;
    const nodeSize  = isCurrent ? NODE_CURRENT : NODE_SIZE;
    const radius    = nodeSize / 2;

    // Visual state
    let bgGrad:      string;
    let borderColor: string;
    let borderWidth: string;
    let textColor:   string;
    let shadow:      string;

    if (locked) {
      bgGrad      = 'radial-gradient(circle at 35% 30%, #e8d8c2, #d8c4a0)';
      borderColor = '#b8a5d4';
      borderWidth = '4px';
      textColor   = '#c4b49a';
      shadow      = '0 3px 6px rgba(0,0,0,0.1)';
    } else if (completed) {
      const bc = stars >= 3 ? '#ffbe0b' : '#fb5607';
      bgGrad      = 'radial-gradient(circle at 35% 30%, #fcecd8, #f0d2a8)';
      borderColor = bc;
      borderWidth = '4px';
      textColor   = C_TEXT;
      shadow      = '0 3px 6px rgba(0,0,0,0.1)';
    } else if (isCurrent) {
      bgGrad      = 'radial-gradient(circle at 35% 30%, #ffffff, #ffe6f4)';
      borderColor = '#ff006e';
      borderWidth = '4px';
      textColor   = '#ff006e';
      shadow      = '0 0 12px rgba(255,0,110,0.5), 0 3px 6px rgba(0,0,0,0.1)';
    } else {
      bgGrad      = 'radial-gradient(circle at 35% 30%, #fffff2, #f4f0da)';
      borderColor = '#d3cfc4';
      borderWidth = '3px';
      textColor   = C_TEXT;
      shadow      = '0 3px 6px rgba(0,0,0,0.1)';
    }

    // Wrapper — absolute, centered at pos
    const wrapper = document.createElement('div');
    wrapper.style.cssText = [
      'position:absolute',
      `left:${pos.x}px`,
      `top:${pos.y}px`,
      'transform:translate(-50%,-50%)',
      'display:flex', 'flex-direction:column', 'align-items:center',
      `cursor:${locked ? 'default' : 'pointer'}`,
      '-webkit-tap-highlight-color:transparent',
      'touch-action:manipulation',
      'z-index:3',
    ].join(';');

    // Node circle
    const node = document.createElement('div');
    node.style.cssText = [
      `width:${nodeSize}px`, `height:${nodeSize}px`,
      'border-radius:50%',
      'flex-shrink:0',
      `background:${bgGrad}`,
      `border:${borderWidth} solid ${borderColor}`,
      'display:flex', 'align-items:center', 'justify-content:center',
      `box-shadow:${shadow}`,
      'position:relative', 'z-index:2',
      ...(isCurrent ? ['animation:ls-pulse 1s ease-in-out infinite'] : []),
    ].join(';');

    if (locked) {
      node.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" '
        + `stroke="${textColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">`
        + '<rect x="3" y="11" width="18" height="11" rx="2"/>'
        + '<path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
    } else {
      const num = document.createElement('span');
      num.textContent = String(i + 1);
      num.style.cssText = [
        `color:${textColor}`,
        `font-size:${isCurrent ? '24px' : '22px'}`, 'font-weight:700',
        `font-family:${FONT_HEADING}`,
        'line-height:1', 'user-select:none',
      ].join(';');
      node.appendChild(num);
    }

    wrapper.appendChild(node);

    // Earned stars only — overlap bottom of circle by 9px
    if (completed && stars > 0) {
      const starsRow = document.createElement('div');
      starsRow.style.cssText = [
        'display:flex', 'gap:2px', 'align-items:center', 'justify-content:center',
        `margin-top:-${Math.round(radius * 0.28)}px`,
        'position:relative', 'z-index:1',
      ].join(';');
      for (let s = 0; s < stars; s++) {
        const starEl = document.createElement('div');
        starEl.style.cssText = 'display:inline-flex;';
        starEl.innerHTML = starSVG(22, 2.5, '#b17025', `lsstar-${i}-${s}`);
        starsRow.appendChild(starEl);
      }
      wrapper.appendChild(starsRow);
    }

    // Interaction (unlocked only)
    if (!locked) {
      addPressFeedback(node);
      wrapper.addEventListener('click', () => {
        if (onSelectCb) { playButtonTap(); hideLevelSelect(); onSelectCb(i); }
      });
    }

    pathEl.appendChild(wrapper);
  }
}

// ─── Build overlay ────────────────────────────────────────────────────────────

function buildOverlay(ui: HTMLElement): void {
  injectStyles();

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

  // ── Top bar ───────────────────────────────────────────────────────────────
  const topBar = document.createElement('div');
  topBar.style.cssText = [
    'flex-shrink:0',
    'padding-top:calc(env(safe-area-inset-top,0px) + 14px)',
    'padding-bottom:14px',
    'padding-left:20px', 'padding-right:20px',
    'background:#feffe5',
    'border-radius:0 0 16px 16px',
    'display:flex', 'align-items:center',
    'z-index:10',
    'box-shadow:0 2px 8px rgba(177,112,37,0.07)',
  ].join(';');

  // Star counter (left, flex:1)
  const starCounter = document.createElement('div');
  starCounter.style.cssText = 'flex:1;display:flex;align-items:center;gap:5px;';
  const starIconEl = document.createElement('div');
  starIconEl.style.cssText = 'display:inline-flex;flex-shrink:0;';
  starIconEl.innerHTML = starSVG(28, 3, '#b17025', 'ls-topstar');
  const starCountText = document.createElement('span');
  starCountText.style.cssText = [
    `color:${C_TEXT}`, 'font-size:18px', 'font-weight:700',
    `font-family:${FONT}`, 'user-select:none', 'line-height:1',
  ].join(';');
  starCountText.textContent = `\u00D7\u00A0${getTotalStars()}`;
  starCounter.appendChild(starIconEl);
  starCounter.appendChild(starCountText);

  // Title + world name (center, flex:0)
  const titleWrap = document.createElement('div');
  titleWrap.style.cssText = 'flex:0;text-align:center;';

  const titleEl = document.createElement('div');
  const levelCount = getLevelCount();
  let worldNum = 1;
  if (levelCount > 0) worldNum = getCurrentLevel(0).world;
  titleEl.textContent = `World ${worldNum}`;
  titleEl.style.cssText = [
    `color:${C_TEXT}`, 'font-size:16px', 'font-weight:600',
    `font-family:${FONT}`, 'user-select:none', 'line-height:1',
  ].join(';');

  const worldNames: Record<number, string> = { 1: 'First Light', 2: 'Layers', 3: 'The Knot', 4: 'Remnants' };
  const subtitleEl = document.createElement('div');
  subtitleEl.textContent = worldNames[worldNum] ?? '';
  subtitleEl.style.cssText = [
    `color:${C_TEXT_SEC}`, 'font-size:11px', 'font-weight:400',
    `font-family:${FONT}`, 'user-select:none', 'letter-spacing:0.06em',
    'text-transform:uppercase', 'margin-top:3px', 'line-height:1',
  ].join(';');

  titleWrap.appendChild(titleEl);
  titleWrap.appendChild(subtitleEl);

  // Gear button (right, flex:1 end-aligned)
  const rightCol = document.createElement('div');
  rightCol.style.cssText = 'flex:1;display:flex;justify-content:flex-end;align-items:center;';

  const gearBtn = document.createElement('button');
  gearBtn.setAttribute('aria-label', 'Open settings');
  gearBtn.style.cssText = [
    'width:40px', 'height:40px',
    'display:flex', 'align-items:center', 'justify-content:center',
    `background:${C_RECESSED}`, 'border:none', 'border-radius:9999px',
    'padding:0', 'cursor:pointer', 'outline:none',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  ].join(';');
  gearBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20">'
    + '<path fill="#b17025" d="M195.1 9.5C198.1-5.3 211.2-16 226.4-16l59.8 0c15.2 0 28.3 10.7 31.3 25.5L332 79.5c14.1 6 27.3 13.7 39.3 22.8l67.8-22.5c14.4-4.8 30.2 1.2 37.8 14.4l29.9 51.8c7.6 13.2 4.9 29.8-6.5 39.9L447 233.3c.9 7.4 1.3 15 1.3 22.7s-.5 15.3-1.3 22.7l53.4 47.5c11.4 10.1 14 26.8 6.5 39.9l-29.9 51.8c-7.6 13.1-23.4 19.2-37.8 14.4l-67.8-22.5c-12.1 9.1-25.3 16.7-39.3 22.8l-14.4 69.9c-3.1 14.9-16.2 25.5-31.3 25.5l-59.8 0c-15.2 0-28.3-10.7-31.3-25.5l-14.4-69.9c-14.1-6-27.2-13.7-39.3-22.8L73.5 432.3c-14.4 4.8-30.2-1.2-37.8-14.4L5.8 366.1c-7.6-13.2-4.9-29.8 6.5-39.9l53.4-47.5c-.9-7.4-1.3-15-1.3-22.7s.5-15.3 1.3-22.7L12.3 185.8c-11.4-10.1-14-26.8-6.5-39.9L35.7 94.1c7.6-13.2 23.4-19.2 37.8-14.4l67.8 22.5c12.1-9.1 25.3-16.7 39.3-22.8L195.1 9.5zM256.3 336a80 80 0 1 0 -.6-160 80 80 0 1 0 .6 160z"/>'
    + '</svg>';
  addPressFeedback(gearBtn);
  gearBtn.addEventListener('click', () => { playButtonTap(); showSettings(); });
  rightCol.appendChild(gearBtn);

  topBar.appendChild(starCounter);
  topBar.appendChild(titleWrap);
  topBar.appendChild(rightCol);

  // ── Scroll area with dot-grid background ─────────────────────────────────
  const scroll = document.createElement('div');
  scroll.style.cssText = [
    'flex:1',
    'overflow-y:auto',
    '-webkit-overflow-scrolling:touch',
    'padding:20px 0 0',
    'background-image:radial-gradient(circle, rgba(161,129,104,0.15) 2px, transparent 2px)',
    'background-size:30px 30px',
  ].join(';');

  pathEl = document.createElement('div');
  pathEl.style.cssText = 'position:relative;width:100%;';

  scroll.appendChild(pathEl);
  overlayEl.appendChild(topBar);
  overlayEl.appendChild(scroll);
  ui.appendChild(overlayEl);
}

// ─── Show / hide ──────────────────────────────────────────────────────────────

export function showLevelSelect(): void {
  if (!overlayEl) return;
  renderPath();
  overlayEl.style.pointerEvents = 'auto';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (overlayEl) {
        overlayEl.style.opacity   = '1';
        overlayEl.style.transform = 'translateY(0)';
      }
    });
  });
}

export function hideLevelSelect(): void {
  if (!overlayEl) return;
  overlayEl.style.opacity       = '0';
  overlayEl.style.transform     = 'translateY(8px)';
  overlayEl.style.pointerEvents = 'none';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function initLevelSelect(onSelect: (index: number) => void): void {
  const ui = document.getElementById('ui')!;
  onSelectCb = onSelect;
  buildOverlay(ui);
  initSettings();
}

export function setCurrentLevel(_index: number): void {
  // Derived from star data in renderPath(); no state needed here.
}

export function completedLevel(index: number, stars: number): void {
  persistStars(index, stars);
  saveUnlockedUpTo(index + 1);
}

export function getUnlockedLevel(): number {
  return loadUnlockedUpTo();
}
