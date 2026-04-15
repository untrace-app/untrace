// Full-screen theme preview: top bar, live board preview canvas, horizontal
// theme carousel, and a context-dependent action button. Slides up over the
// shop at the same z-index.

import {
  FONT, FONT_HEADING,
  DOT_RADIUS, LINE_WIDTH_BASE, GRID_FILL_RATIO,
  C_TEXT,
} from '../constants.ts';
import { playButtonTap } from '../audio/audio.ts';
import { hapticSnap } from '../haptics.ts';
import { addPressFeedback } from './overlay.ts';

// ─── Theme model ───────────────────────────────────────────────────────────

interface ThemePalette {
  bg:       string; // page background
  board:    string; // board fill
  recessed: string; // recessed card bg
  dot:      string;
  text:     string;
  textSec:  string;
  primary:  string;
  layers:   [string, string, string, string, string];
}

type ThemeUnlock =
  | { kind: 'free' }
  | { kind: 'stars';   count: number }
  | { kind: 'all3star'; world: number }
  | { kind: 'paid';    price: string };

interface ThemeCfg {
  id:       string;
  name:     string;
  palette:  ThemePalette;
  unlock:   ThemeUnlock;
}

const THEMES: ThemeCfg[] = [
  {
    id: 'paper', name: 'Paper',
    palette: {
      bg: '#ffedcd', board: '#f7e6ca', recessed: '#f0d2a8',
      dot: '#a68168', text: '#b17025', textSec: '#7f7c6c', primary: '#fb5607',
      layers: ['#ffbe0b', '#fb5607', '#ff006e', '#8338ec', '#3a86ff'],
    },
    unlock: { kind: 'free' },
  },
  {
    id: 'midnight', name: 'Midnight',
    palette: {
      bg: '#0f1626', board: '#1a2236', recessed: '#242e47',
      dot: '#6b7a99', text: '#e3ecff', textSec: '#8ea0c7', primary: '#7aa2ff',
      layers: ['#ffd166', '#ef476f', '#06d6a0', '#c77dff', '#4cc9f0'],
    },
    unlock: { kind: 'stars', count: 50 },
  },
  {
    id: 'secret', name: 'Secret',
    palette: {
      bg: '#fdf6e3', board: '#f5ecd4', recessed: '#e9dcb8',
      dot: '#8a7a52', text: '#5c4b1a', textSec: '#8a7a52', primary: '#b5651d',
      layers: ['#d4a017', '#c2451c', '#a01a58', '#5e2ca5', '#1a5490'],
    },
    unlock: { kind: 'all3star', world: 1 },
  },
  {
    id: 'hacker', name: 'Hacker',
    palette: {
      bg: '#0a0f0a', board: '#0f1a10', recessed: '#162416',
      dot: '#3a7a3a', text: '#5bff7a', textSec: '#3a9a4a', primary: '#5bff7a',
      layers: ['#5bff7a', '#00ffcc', '#88ff00', '#33ff33', '#aaff55'],
    },
    unlock: { kind: 'paid', price: '$0.99' },
  },
  {
    id: 'neon', name: 'Neon',
    palette: {
      bg: '#1a0a24', board: '#261232', recessed: '#3a1c48',
      dot: '#8a4aa8', text: '#ff4ecd', textSec: '#b47ac8', primary: '#00f0ff',
      layers: ['#ff4ecd', '#ff7a00', '#00f0ff', '#c77dff', '#ffe600'],
    },
    unlock: { kind: 'paid', price: '$0.99' },
  },
  {
    id: 'ocean', name: 'Ocean',
    palette: {
      bg: '#e0f4f8', board: '#c5e6ef', recessed: '#a8d6e0',
      dot: '#3a7a88', text: '#0a4a5c', textSec: '#4a7a85', primary: '#00a0c0',
      layers: ['#00c2d1', '#0077b6', '#90e0ef', '#023e8a', '#48cae4'],
    },
    unlock: { kind: 'paid', price: '$0.99' },
  },
  {
    id: 'sunset', name: 'Sunset',
    palette: {
      bg: '#ffe3c6', board: '#ffd0a0', recessed: '#ffbd7a',
      dot: '#a0522d', text: '#7a2e00', textSec: '#a0522d', primary: '#ff5722',
      layers: ['#ffb300', '#ff5722', '#e91e63', '#9c27b0', '#ff8a65'],
    },
    unlock: { kind: 'paid', price: '$0.99' },
  },
  {
    id: 'forest', name: 'Forest',
    palette: {
      bg: '#e8f0d8', board: '#d4e2b8', recessed: '#b8cc98',
      dot: '#4a6a38', text: '#2d4a1a', textSec: '#5a7a48', primary: '#5d8a3a',
      layers: ['#6ba539', '#c2a93c', '#d4572a', '#8a5a3c', '#3a7a5c'],
    },
    unlock: { kind: 'paid', price: '$0.99' },
  },
];

// ─── Persistence ───────────────────────────────────────────────────────────

const LS_ACTIVE = 'untrace_active_theme';
const LS_OWNED  = 'untrace_owned_themes';
const LS_STARS  = 'untrace_stars';

function getActiveThemeId(): string {
  return localStorage.getItem(LS_ACTIVE) || 'paper';
}

function setActiveThemeId(id: string): void {
  localStorage.setItem(LS_ACTIVE, id);
}

function loadOwned(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_OWNED);
    if (!raw) return new Set(['paper']);
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set([...(arr as string[]), 'paper']);
  } catch {}
  return new Set(['paper']);
}

function saveOwned(set: Set<string>): void {
  localStorage.setItem(LS_OWNED, JSON.stringify([...set]));
}

function getTotalStars(): number {
  try {
    const raw = localStorage.getItem(LS_STARS);
    if (!raw) return 0;
    const map = JSON.parse(raw);
    if (!map || typeof map !== 'object') return 0;
    return Object.values(map).reduce(
      (sum: number, n) => sum + (typeof n === 'number' ? n : 0),
      0,
    );
  } catch { return 0; }
}

function isThemeUnlocked(t: ThemeCfg): boolean {
  if (t.unlock.kind === 'free') return true;
  if (t.unlock.kind === 'stars') return getTotalStars() >= t.unlock.count;
  if (t.unlock.kind === 'all3star') return false; // TODO: proper check
  return loadOwned().has(t.id);
}

function isThemeOwned(t: ThemeCfg): boolean {
  if (t.unlock.kind === 'paid') return loadOwned().has(t.id);
  return isThemeUnlocked(t);
}

type ThemeStatus = 'equipped' | 'equip' | 'buy' | 'locked';

function getThemeStatus(t: ThemeCfg): ThemeStatus {
  if (t.id === getActiveThemeId()) return 'equipped';
  if (isThemeOwned(t)) return 'equip';
  if (t.unlock.kind === 'paid') return 'buy';
  return 'locked';
}

function unlockRequirementText(t: ThemeCfg): string {
  if (t.unlock.kind === 'stars') return `Earn ${t.unlock.count} stars to unlock`;
  if (t.unlock.kind === 'all3star') return `3★ all World ${t.unlock.world} to unlock`;
  return 'Locked';
}

// ─── Icons ─────────────────────────────────────────────────────────────────

const BACK_SVG = `
<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="15 6 9 12 15 18"/>
</svg>`;

const LOCK_SVG = `
<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
  <path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 116 0v3H9z"/>
</svg>`;

// ─── Module state ──────────────────────────────────────────────────────────

let overlayEl:   HTMLDivElement | null = null;
let panelEl:     HTMLDivElement | null = null;
let titleEl:     HTMLDivElement | null = null;
let backBtnEl:   HTMLButtonElement | null = null;
let previewCanvas: HTMLCanvasElement | null = null;
let carouselEl:  HTMLDivElement | null = null;
let actionBtnEl: HTMLButtonElement | null = null;
let actionWrapEl: HTMLDivElement | null = null;
let selectedIdx = 0;
let cardRefs: HTMLElement[] = [];

// ─── Board preview drawing ─────────────────────────────────────────────────

// Sample 3x3 puzzle: a handful of layered connections that show off all 5
// layer colors. Mirrors the real game's data model: (col, row) dots plus
// connections with an integer layer count.
const SAMPLE_COLS = 3;
const SAMPLE_ROWS = 3;
const SAMPLE_LINES: Array<{ from: [number, number]; to: [number, number]; layers: number }> = [
  { from: [0, 0], to: [1, 0], layers: 1 },
  { from: [1, 0], to: [2, 1], layers: 2 },
  { from: [0, 1], to: [1, 1], layers: 3 },
  { from: [1, 1], to: [2, 2], layers: 4 },
  { from: [0, 2], to: [1, 2], layers: 5 },
  { from: [1, 2], to: [1, 1], layers: 2 },
];

function drawBoardPreview(t: ThemeCfg): void {
  const canvas = previewCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr  = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW === 0 || cssH === 0) return;
  canvas.width  = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, cssW, cssH);

  const p = t.palette;

  // Same layout math as engine/renderer.ts computeLayout().
  const smaller  = Math.min(cssW, cssH);
  const gridSpan = smaller * GRID_FILL_RATIO;

  // Recessed board background: matches the #board-bg div in index.html —
  // a rounded rectangle sized to gridSpan + padding, centered, clamped so it
  // always fits inside the canvas. Border-radius is preserved even when the
  // canvas is tiny so small screens still show the rounded corners.
  const maxBoard = Math.max(0, smaller - 8);
  const boardSize = Math.min(gridSpan + 80, maxBoard);
  const boardX = (cssW - boardSize) / 2;
  const boardY = (cssH - boardSize) / 2;
  const boardR = 18;
  ctx.fillStyle = p.recessed;
  ctx.beginPath();
  const rr = Math.min(boardR, boardSize / 2);
  ctx.moveTo(boardX + rr, boardY);
  ctx.lineTo(boardX + boardSize - rr, boardY);
  ctx.quadraticCurveTo(boardX + boardSize, boardY, boardX + boardSize, boardY + rr);
  ctx.lineTo(boardX + boardSize, boardY + boardSize - rr);
  ctx.quadraticCurveTo(boardX + boardSize, boardY + boardSize, boardX + boardSize - rr, boardY + boardSize);
  ctx.lineTo(boardX + rr, boardY + boardSize);
  ctx.quadraticCurveTo(boardX, boardY + boardSize, boardX, boardY + boardSize - rr);
  ctx.lineTo(boardX, boardY + rr);
  ctx.quadraticCurveTo(boardX, boardY, boardX + rr, boardY);
  ctx.closePath();
  ctx.fill();

  const spacingX = SAMPLE_COLS > 1 ? gridSpan / (SAMPLE_COLS - 1) : 0;
  const spacingY = SAMPLE_ROWS > 1 ? gridSpan / (SAMPLE_ROWS - 1) : 0;
  const spacing  = Math.min(spacingX, spacingY);
  const gridW    = spacing * (SAMPLE_COLS - 1);
  const gridH    = spacing * (SAMPLE_ROWS - 1);
  const originX  = (cssW - gridW) / 2;
  const originY  = (cssH - gridH) / 2;
  const px = (c: number, r: number): [number, number] =>
    [originX + c * spacing, originY + r * spacing];

  // Lines first (dots render on top) — same width formula as renderer.ts.
  ctx.lineCap = 'round';
  for (const ln of SAMPLE_LINES) {
    const [x1, y1] = px(ln.from[0], ln.from[1]);
    const [x2, y2] = px(ln.to[0],   ln.to[1]);
    const color = p.layers[ln.layers - 1]!;
    const width = LINE_WIDTH_BASE + (ln.layers - 1) * 2;
    ctx.strokeStyle = color;
    ctx.lineWidth   = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Dots — same radius constant as the real game.
  ctx.fillStyle = p.dot;
  for (let r = 0; r < SAMPLE_ROWS; r++) {
    for (let c = 0; c < SAMPLE_COLS; c++) {
      const [x, y] = px(c, r);
      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ─── Carousel ──────────────────────────────────────────────────────────────

function buildThemeCard(t: ThemeCfg, idx: number): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText = [
    'position:relative',
    'flex:0 0 auto',
    'width:90px', 'height:120px',
    'border-radius:14px',
    'margin:0 4px',
    'scroll-snap-align:center',
    'cursor:pointer', 'touch-action:manipulation',
    '-webkit-tap-highlight-color:transparent',
    'display:flex', 'flex-direction:column', 'align-items:stretch',
    'padding:10px 8px 8px',
    'box-sizing:border-box',
    `background:${t.palette.board}`,
    `border:2px solid transparent`,
    'box-shadow:0 2px 8px rgba(46,47,44,0.08)',
    'transition:transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.2s ease-out',
  ].join(';');

  // Color swatches (4 small dots showing layers)
  const swatchWrap = document.createElement('div');
  swatchWrap.style.cssText = 'display:flex;justify-content:center;gap:4px;margin-bottom:8px;';
  for (let i = 0; i < 4; i++) {
    const sw = document.createElement('div');
    sw.style.cssText = [
      'width:12px', 'height:12px', 'border-radius:9999px',
      `background:${t.palette.layers[i]}`,
    ].join(';');
    swatchWrap.appendChild(sw);
  }

  // Mini sample line
  const sample = document.createElement('div');
  sample.style.cssText = [
    'flex:1', 'border-radius:8px', `background:${t.palette.recessed}`,
    'display:flex', 'align-items:center', 'justify-content:center',
    'margin-bottom:6px',
  ].join(';');
  sample.innerHTML = `
<svg viewBox="0 0 60 30" width="52" height="26">
  <line x1="8" y1="15" x2="30" y2="8"  stroke="${t.palette.layers[0]}" stroke-width="4" stroke-linecap="round"/>
  <line x1="30" y1="8" x2="52" y2="22" stroke="${t.palette.layers[2]}" stroke-width="4" stroke-linecap="round"/>
  <circle cx="8"  cy="15" r="3" fill="${t.palette.dot}"/>
  <circle cx="30" cy="8"  r="3" fill="${t.palette.dot}"/>
  <circle cx="52" cy="22" r="3" fill="${t.palette.dot}"/>
</svg>`;

  // Name label
  const label = document.createElement('div');
  label.textContent = t.name;
  label.style.cssText = [
    `font-family:${FONT}`, 'font-size:11px', 'font-weight:600',
    `color:${t.palette.text}`, 'text-align:center',
    'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis',
  ].join(';');

  card.appendChild(swatchWrap);
  card.appendChild(sample);
  card.appendChild(label);

  // Status badge
  const status = getThemeStatus(t);
  if (status === 'equipped') {
    const b = document.createElement('div');
    b.textContent = '✓';
    b.style.cssText = [
      'position:absolute', 'top:-6px', 'right:-6px',
      'width:22px', 'height:22px', 'border-radius:9999px',
      'background:#4caf50', 'color:#ffffff',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-size:13px', 'font-weight:800',
      'box-shadow:0 2px 6px rgba(0,0,0,0.2)',
    ].join(';');
    card.appendChild(b);
  } else if (status === 'locked') {
    const lockOverlay = document.createElement('div');
    lockOverlay.style.cssText = [
      'position:absolute', 'inset:0', 'border-radius:12px',
      'background:rgba(20,20,30,0.55)',
      'display:flex', 'align-items:center', 'justify-content:center',
      `color:#ffffff`,
    ].join(';');
    lockOverlay.innerHTML = `<div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;">${LOCK_SVG}</div>`;
    card.appendChild(lockOverlay);
  }

  card.addEventListener('click', () => {
    playButtonTap();
    hapticSnap();
    selectTheme(idx);
  });
  addPressFeedback(card);

  return card;
}

function selectTheme(idx: number): void {
  selectedIdx = idx;
  const t = THEMES[idx];
  if (!t) return;
  // Visual: update border on selected, unselect others
  cardRefs.forEach((el, i) => {
    if (i === idx) {
      el.style.borderColor = t.palette.primary;
      el.style.transform   = 'scale(1.06)';
    } else {
      el.style.borderColor = 'transparent';
      el.style.transform   = 'scale(1.0)';
    }
  });
  // Update panel background to match theme
  if (panelEl) panelEl.style.background = t.palette.bg;
  if (actionWrapEl) actionWrapEl.style.background = t.palette.bg;
  if (titleEl) titleEl.style.color = t.palette.text;
  if (backBtnEl) {
    backBtnEl.style.background = t.palette.recessed;
    backBtnEl.style.color      = t.palette.text;
  }
  drawBoardPreview(t);
  updateActionButton();
  // Scroll card into view
  if (carouselEl && cardRefs[idx]) {
    const card = cardRefs[idx]!;
    const target = card.offsetLeft - (carouselEl.clientWidth - card.clientWidth) / 2;
    carouselEl.scrollTo({ left: target, behavior: 'smooth' });
  }
}

function updateActionButton(): void {
  if (!actionBtnEl) return;
  const t = THEMES[selectedIdx];
  if (!t) return;
  const status = getThemeStatus(t);
  const btn = actionBtnEl;
  btn.disabled = false;
  btn.style.opacity = '1';
  btn.style.cursor  = 'pointer';

  if (status === 'equipped') {
    btn.textContent = 'Equipped';
    btn.style.background = '#4caf50';
    btn.style.color      = '#ffffff';
    btn.disabled = true;
    btn.style.cursor = 'default';
  } else if (status === 'equip') {
    btn.textContent = 'Equip';
    btn.style.background = t.palette.primary;
    btn.style.color      = '#ffffff';
  } else if (status === 'buy') {
    const price = t.unlock.kind === 'paid' ? t.unlock.price : '';
    btn.textContent = `Buy ${price}`;
    btn.style.background = t.palette.primary;
    btn.style.color      = '#ffffff';
  } else {
    btn.textContent = unlockRequirementText(t);
    btn.style.background = '#9a9a9a';
    btn.style.color      = '#ffffff';
    btn.disabled = true;
    btn.style.cursor = 'default';
    btn.style.opacity = '0.85';
  }
}

function onActionTap(): void {
  const t = THEMES[selectedIdx];
  if (!t) return;
  const status = getThemeStatus(t);
  if (status === 'equipped' || status === 'locked') return;

  if (status === 'buy') {
    const owned = loadOwned();
    owned.add(t.id);
    saveOwned(owned);
    setActiveThemeId(t.id);
    console.log(`SHOP: theme ${t.id} purchased`);
  } else if (status === 'equip') {
    setActiveThemeId(t.id);
  }
  // Rebuild card statuses
  rebuildCards();
  updateActionButton();
}

function rebuildCards(): void {
  if (!carouselEl) return;
  for (const c of cardRefs) c.remove();
  cardRefs = [];
  THEMES.forEach((t, i) => {
    const c = buildThemeCard(t, i);
    cardRefs.push(c);
    carouselEl!.appendChild(c);
  });
  // Re-apply selection highlight
  const t = THEMES[selectedIdx];
  if (t && cardRefs[selectedIdx]) {
    cardRefs[selectedIdx]!.style.borderColor = t.palette.primary;
    cardRefs[selectedIdx]!.style.transform   = 'scale(1.06)';
  }
}

// ─── Responsive styles ─────────────────────────────────────────────────────

let _stylesInjected = false;
function injectThemePreviewStyles(): void {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
.tp-preview { max-height: 55vh; }
@media (max-height: 700px) { .tp-preview { max-height: 45vh; } }
`;
  document.head.appendChild(style);
}

// ─── Overlay build ─────────────────────────────────────────────────────────

function buildOverlay(): void {
  const ui = document.getElementById('ui')!;

  overlayEl = document.createElement('div');
  overlayEl.style.cssText = [
    'position:fixed', 'inset:0',
    'z-index:60', 'display:none',
    `font-family:${FONT}`,
  ].join(';');

  panelEl = document.createElement('div');
  panelEl.style.cssText = [
    'position:absolute', 'inset:0',
    'background:#ffedcd',
    'display:flex', 'flex-direction:column',
    'transform:translateY(100%)',
    'transition:transform 0.3s ease-out, background 0.25s ease-out',
    'will-change:transform',
  ].join(';');

  // Top bar
  const topBar = document.createElement('div');
  topBar.style.cssText = [
    'position:relative',
    'padding-top:calc(env(safe-area-inset-top, 0px) + 16px)',
    'padding-left:20px', 'padding-right:20px', 'padding-bottom:12px',
    'display:flex', 'align-items:center', 'justify-content:center',
    'flex-shrink:0',
  ].join(';');

  titleEl = document.createElement('div');
  titleEl.textContent = 'Themes';
  titleEl.style.cssText = [
    `font-family:${FONT_HEADING}`, 'font-size:20px', 'font-weight:700',
    'color:#b17025', 'letter-spacing:-0.01em',
    'transition:color 0.25s ease-out',
  ].join(';');

  // Back button — matches the "Back to Levels" button from the game top bar:
  // 40x40 circle, recessed bg, 18px stroke icon. Theme-colored via selectTheme.
  backBtnEl = document.createElement('button');
  backBtnEl.setAttribute('aria-label', 'Back');
  backBtnEl.innerHTML = BACK_SVG;
  backBtnEl.style.cssText = [
    'position:absolute',
    'top:calc(env(safe-area-inset-top, 0px) + 18px)', 'left:16px',
    'width:40px', 'height:40px',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:#f0d2a8', 'border:none', 'padding:0',
    'border-radius:9999px',
    `color:${C_TEXT}`, 'cursor:pointer',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'outline:none',
    'transition:transform 0.15s ease-out, background 0.25s ease-out, color 0.25s ease-out',
  ].join(';');
  addPressFeedback(backBtnEl);
  backBtnEl.addEventListener('click', () => { playButtonTap(); hideThemePreview(); });

  topBar.appendChild(titleEl);
  topBar.appendChild(backBtnEl);

  // Inject responsive max-height rules for the board preview once. The preview
  // shrinks on small screens so the carousel + action button always fit.
  injectThemePreviewStyles();

  // Board preview area — shrinkable. A CSS class handles the responsive
  // max-height (45vh under 700px, 55vh otherwise). No position:absolute —
  // pure flex column so nothing overlaps.
  const previewWrap = document.createElement('div');
  previewWrap.className = 'tp-preview';
  previewWrap.style.cssText = [
    'flex:1 1 auto', 'min-height:0', 'width:100%',
    'display:flex', 'align-items:center', 'justify-content:center',
    'padding:8px 16px',
    'box-sizing:border-box',
  ].join(';');

  previewCanvas = document.createElement('canvas');
  previewCanvas.style.cssText = [
    'display:block',
    'aspect-ratio:1 / 1',
    'max-width:100%', 'max-height:100%',
    'background:transparent',
    'border:none', 'outline:none', 'box-shadow:none',
  ].join(';');
  previewWrap.appendChild(previewCanvas);

  // Carousel area — fixed 160px height, never overlaps the board. 16px top
  // margin provides breathing room between the board preview and the cards.
  const carouselWrap = document.createElement('div');
  carouselWrap.style.cssText = [
    'flex:0 0 160px', 'width:100%',
    'display:flex', 'align-items:center',
    'min-height:0',
    'margin-top:16px',
  ].join(';');

  carouselEl = document.createElement('div');
  carouselEl.style.cssText = [
    'display:flex', 'flex-direction:row', 'align-items:center',
    'width:100%', 'height:100%',
    'overflow-x:auto', 'overflow-y:visible',
    '-webkit-overflow-scrolling:touch',
    'scroll-snap-type:x mandatory',
    'padding:10px 40%',
    'box-sizing:border-box',
    'scrollbar-width:none',
  ].join(';');
  (carouselEl.style as unknown as { msOverflowStyle: string }).msOverflowStyle = 'none';

  carouselWrap.appendChild(carouselEl);

  // Action button pinned to bottom. flex-shrink:0 so it keeps its size; the
  // board shrinks instead. Solid background matches the panel/page bg.
  actionWrapEl = document.createElement('div');
  const actionWrap = actionWrapEl;
  actionWrap.style.cssText = [
    'flex:0 0 auto', 'width:100%',
    'padding:12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)',
    'box-sizing:border-box',
    'background:#ffedcd',
  ].join(';');

  actionBtnEl = document.createElement('button');
  actionBtnEl.style.cssText = [
    'width:100%', 'min-height:52px',
    'border:none', 'border-radius:14px',
    'padding:14px 20px',
    `font-family:${FONT}`, 'font-size:16px', 'font-weight:700',
    'background:#fb5607', 'color:#ffffff',
    'cursor:pointer', 'touch-action:manipulation',
    '-webkit-tap-highlight-color:transparent',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out, background 0.2s ease-out',
  ].join(';');
  addPressFeedback(actionBtnEl);
  actionBtnEl.addEventListener('click', () => {
    if (actionBtnEl?.disabled) return;
    playButtonTap();
    hapticSnap();
    onActionTap();
  });

  actionWrap.appendChild(actionBtnEl);

  panelEl.appendChild(topBar);
  panelEl.appendChild(previewWrap);
  panelEl.appendChild(carouselWrap);
  panelEl.appendChild(actionWrap);
  overlayEl.appendChild(panelEl);
  ui.appendChild(overlayEl);
}

// ─── Public API ────────────────────────────────────────────────────────────

export function showThemePreview(): void {
  if (!overlayEl) buildOverlay();
  if (!overlayEl || !panelEl) return;

  // Rebuild cards from current state
  rebuildCards();

  // Initial selection = active theme (or first)
  const activeId = getActiveThemeId();
  const idx = Math.max(0, THEMES.findIndex(t => t.id === activeId));
  selectedIdx = idx;

  overlayEl.style.display = 'block';
  panelEl.style.transition = 'none';
  panelEl.style.transform  = 'translateY(100%)';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!panelEl) return;
      panelEl.style.transition = 'transform 0.3s ease-out, background 0.25s ease-out';
      panelEl.style.transform  = 'translateY(0)';
      // Apply initial theme state once layout is ready
      selectTheme(selectedIdx);
      // Jump carousel to active card without animation
      if (carouselEl && cardRefs[selectedIdx]) {
        const card = cardRefs[selectedIdx]!;
        carouselEl.scrollLeft =
          card.offsetLeft - (carouselEl.clientWidth - card.clientWidth) / 2;
      }
    });
  });
}

export function hideThemePreview(): void {
  if (!overlayEl || !panelEl) return;
  panelEl.style.transition = 'transform 0.3s ease-out';
  panelEl.style.transform  = 'translateY(100%)';
  setTimeout(() => {
    if (overlayEl) overlayEl.style.display = 'none';
  }, 310);
}
