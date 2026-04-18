// How to Play mechanic cards screen.
// Shows illustrated cards explaining game mechanics one at a time.
// Accessible from the settings screen.

import {
  FONT, FONT_HEADING, C_TEXT, C_TEXT_SEC, C_PRIMARY, C_RECESSED,
  COLOR_DOT_INACTIVE, COLOR_LAYER_RED, COLOR_LAYER_AMBER,
  COLOR_ACCIDENTAL_FLASH,
} from '../constants.ts';
import { playButtonTap } from '../audio/audio.ts';
import { addPressFeedback } from './overlay.ts';

// ─── Storage ──────────────────────────────────────────────────────────────────

const LS_MECHANICS = 'untrace_mechanics_seen';

export function getMechanicsSeen(): string[] {
  try {
    const raw = localStorage.getItem(LS_MECHANICS);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* malformed */ }
  // Auto-initialize from tutorial completion state.
  if (localStorage.getItem('tutorial-complete')) {
    const initial = ['trace', 'keep-going', 'accidental', 'hints'];
    localStorage.setItem(LS_MECHANICS, JSON.stringify(initial));
    return initial;
  }
  return [];
}

function addMechanicSeen(id: string): void {
  const seen = getMechanicsSeen();
  if (!seen.includes(id)) {
    seen.push(id);
    localStorage.setItem(LS_MECHANICS, JSON.stringify(seen));
  }
}

/** Call after tutorial completion to unlock cards 1, 2, 3, 5. */
export function onHTPTutorialComplete(): void {
  for (const id of ['trace', 'keep-going', 'accidental', 'hints']) addMechanicSeen(id);
}

/** Call on World 2 first entry to unlock card 4. */
export function onHTPWorld2Entry(): void {
  addMechanicSeen('multiple-layers');
}

// ─── Card definitions ─────────────────────────────────────────────────────────

interface MechanicCard {
  id: string;
  title: string;
  description: string;
  draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void;
}

// ─── Illustration helpers ─────────────────────────────────────────────────────

/** Pixel coords for [col,row] in a 3×3 grid with padding p (both axes). */
function gp(col: number, row: number, W: number, H: number, p: number): { x: number; y: number } {
  return { x: p + col * (W - p * 2) / 2, y: p + row * (H - p * 2) / 2 };
}

/** Polyfill for ctx.roundRect (not available in all WebViews). */
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function illuBoard(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  ctx.fillStyle = '#f7e6ca';
  rrect(ctx, 4, 4, W - 8, H - 8, 12);
  ctx.fill();
}

function illuLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string, lw: number, dashed = false,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = lw;
  ctx.lineCap     = 'round';
  if (dashed) ctx.setLineDash([lw * 0.5, lw * 0.9]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function illuDot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, active = false,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (active) {
    ctx.fillStyle   = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = COLOR_DOT_INACTIVE;
    ctx.lineWidth   = r * 0.3;
    ctx.stroke();
  } else {
    ctx.fillStyle = COLOR_DOT_INACTIVE;
    ctx.fill();
  }
}

const ALL_3X3: [number, number][] = [
  [0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2],
];

// Illustration 1: single yellow line, touch ripple over it.
function drawTraceToErase(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const P  = W * 0.18;
  const dr = Math.min(W, H) * 0.065;
  const lw = dr * 1.5;
  illuBoard(ctx, W, H);
  const a = gp(0, 1, W, H, P), b = gp(2, 1, W, H, P);
  illuLine(ctx, a.x, a.y, b.x, b.y, COLOR_LAYER_RED, lw);
  for (const [c, r] of ALL_3X3) {
    const pt = gp(c, r, W, H, P);
    illuDot(ctx, pt.x, pt.y, dr, c === 0 && r === 1);
  }
  // Touch ripple centred on the line.
  const rx = (a.x + b.x) / 2, ry = a.y;
  ctx.save();
  ctx.fillStyle   = 'rgba(251,86,7,0.15)';
  ctx.strokeStyle = 'rgba(251,86,7,0.55)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath(); ctx.arc(rx, ry, dr * 1.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// Illustration 2: L-shaped two-segment path.
function drawKeepGoing(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const P  = W * 0.18;
  const dr = Math.min(W, H) * 0.065;
  const lw = dr * 1.5;
  illuBoard(ctx, W, H);
  const a = gp(0, 0, W, H, P), b = gp(2, 0, W, H, P), c = gp(2, 2, W, H, P);
  illuLine(ctx, a.x, a.y, b.x, b.y, COLOR_LAYER_RED,   lw);
  illuLine(ctx, b.x, b.y, c.x, c.y, COLOR_LAYER_AMBER, lw);
  for (const [col, row] of ALL_3X3) {
    const pt = gp(col, row, W, H, P);
    illuDot(ctx, pt.x, pt.y, dr, col === 0 && row === 0);
  }
}

// Illustration 3: one existing line + dashed "accidental" line in error color.
function drawAccidentalDraw(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const P  = W * 0.18;
  const dr = Math.min(W, H) * 0.065;
  const lw = dr * 1.5;
  illuBoard(ctx, W, H);
  const a = gp(0, 1, W, H, P), b = gp(2, 1, W, H, P);
  illuLine(ctx, a.x, a.y, b.x, b.y, COLOR_LAYER_RED, lw);
  const c = gp(0, 0, W, H, P), d = gp(0, 2, W, H, P);
  ctx.save(); ctx.globalAlpha = 0.8;
  illuLine(ctx, c.x, c.y, d.x, d.y, COLOR_ACCIDENTAL_FLASH, lw, true);
  ctx.restore();
  for (const [col, row] of ALL_3X3) {
    const pt = gp(col, row, W, H, P);
    illuDot(ctx, pt.x, pt.y, dr);
  }
}

// Illustration 4: two dots with parallel offset lines (double-layer) + ×2 label.
function drawMultipleLayers(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const P  = W * 0.18;
  const dr = Math.min(W, H) * 0.065;
  const lw = dr * 1.5;
  illuBoard(ctx, W, H);
  const a = gp(0, 1, W, H, P), b = gp(2, 1, W, H, P);
  const off = lw * 0.55;
  illuLine(ctx, a.x, a.y - off, b.x, b.y - off, COLOR_LAYER_RED,   lw * 0.7);
  illuLine(ctx, a.x, a.y + off, b.x, b.y + off, COLOR_LAYER_AMBER, lw * 0.7);
  for (const [col, row] of ALL_3X3) {
    const pt = gp(col, row, W, H, P);
    illuDot(ctx, pt.x, pt.y, dr, (col === 0 || col === 2) && row === 1);
  }
  // ×2 badge
  const mx = (a.x + b.x) / 2, my = a.y - lw * 2.2;
  ctx.save();
  ctx.fillStyle      = C_PRIMARY;
  ctx.font           = `700 ${Math.round(dr * 1.3)}px ${FONT_HEADING}`;
  ctx.textAlign      = 'center';
  ctx.textBaseline   = 'middle';
  ctx.fillText('×2', mx, my);
  ctx.restore();
}

// Illustration 5: lightbulb glow + two spark bolts.
function drawNeedHelp(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  illuBoard(ctx, W, H);
  const cx = W / 2, cy = H * 0.44;
  const R  = Math.min(W, H) * 0.24;

  // Glow
  ctx.save();
  ctx.fillStyle = 'rgba(251,86,7,0.12)';
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.55, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Bulb circle
  ctx.save();
  ctx.fillStyle = COLOR_LAYER_RED;
  ctx.beginPath(); ctx.arc(cx, cy - R * 0.05, R, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Base bands
  const bw = R * 0.66, by = cy + R * 0.82, bh = R * 0.22;
  ctx.save();
  ctx.fillStyle = COLOR_DOT_INACTIVE;
  rrect(ctx, cx - bw / 2, by, bw, bh, 3);              ctx.fill();
  rrect(ctx, cx - bw * 0.65 / 2, by + bh + 2, bw * 0.65, bh * 0.85, 3); ctx.fill();
  ctx.restore();

  // Spark bolt lines (×, top-right and top-left)
  const boltR = R * 0.28;
  for (const [sx, sy] of [[cx + R * 1.1, cy - R * 0.85], [cx - R * 1.1, cy - R * 0.7]] as [number,number][]) {
    ctx.save();
    ctx.strokeStyle = C_PRIMARY;
    ctx.lineWidth   = R * 0.12;
    ctx.lineCap     = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy - boltR); ctx.lineTo(sx - boltR * 0.4, sy + boltR * 0.3);
    ctx.lineTo(sx + boltR * 0.1, sy);            ctx.lineTo(sx - boltR * 0.2, sy + boltR); ctx.stroke();
    ctx.restore();
  }
}

const CARDS: MechanicCard[] = [
  {
    id: 'trace',
    title: 'Trace to Erase',
    description: 'Swipe along lines to erase them. Clear the board to win!',
    draw: drawTraceToErase,
  },
  {
    id: 'keep-going',
    title: 'Keep Going',
    description: 'Trace through multiple lines in one stroke without lifting.',
    draw: drawKeepGoing,
  },
  {
    id: 'accidental',
    title: 'Watch Your Path',
    description: 'Crossing empty spaces creates new lines. Plan carefully!',
    draw: drawAccidentalDraw,
  },
  {
    id: 'multiple-layers',
    title: 'Multiple Layers',
    description: 'Some lines need multiple passes to fully erase.',
    draw: drawMultipleLayers,
  },
  {
    id: 'hints',
    title: 'Need Help?',
    description: 'Tap the lightbulb during gameplay to spend sparks on hints.',
    draw: drawNeedHelp,
  },
];

// ─── Overlay state ────────────────────────────────────────────────────────────

let _overlayEl:  HTMLDivElement | null = null;
let _panelEl:    HTMLDivElement | null = null;
let _cardSlotEl: HTMLDivElement | null = null;
let _dotsEl:     HTMLDivElement | null = null;
let _leftBtn:    HTMLButtonElement | null = null;
let _rightBtn:   HTMLButtonElement | null = null;
let _visibleCards: MechanicCard[] = [];
let _currentIdx  = 0;

// ─── Card rendering ───────────────────────────────────────────────────────────

function canvasH(): number {
  return window.innerHeight <= 667 ? 160 : 200;
}

function renderCard(card: MechanicCard): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = [
    'background:#feffe5', 'border-radius:20px',
    'padding:20px',
    'width:100%', 'max-width:360px', 'box-sizing:border-box',
    'box-shadow:0 4px 20px rgba(46,47,44,0.09)',
    'display:flex', 'flex-direction:column', 'align-items:center',
  ].join(';');

  // ── Canvas illustration ────────────────────────────────────────────────────
  const dpr = window.devicePixelRatio || 1;
  const CH  = canvasH();
  const canvas = document.createElement('canvas');
  canvas.style.cssText = [
    `height:${CH}px`, 'width:100%',
    'border-radius:12px',
    'display:block',
  ].join(';');

  // Size the canvas buffer after insertion (so clientWidth is known).
  // We use a rAF to let the layout settle, then draw.
  requestAnimationFrame(() => {
    const CW = canvas.clientWidth || 280;
    canvas.width  = CW * dpr;
    canvas.height = CH * dpr;
    const ctx2 = canvas.getContext('2d');
    if (!ctx2) return;
    ctx2.scale(dpr, dpr);
    card.draw(ctx2, CW, CH);
  });

  el.appendChild(canvas);

  // ── Title ──────────────────────────────────────────────────────────────────
  const title = document.createElement('div');
  title.textContent = card.title;
  title.style.cssText = [
    `font-family:${FONT_HEADING}`, 'font-size:22px', 'font-weight:700',
    `color:${C_TEXT}`, 'text-align:center', 'margin-top:20px',
    'user-select:none', 'line-height:1.2',
  ].join(';');
  el.appendChild(title);

  // ── Description ───────────────────────────────────────────────────────────
  const desc = document.createElement('div');
  desc.textContent = card.description;
  desc.style.cssText = [
    `font-family:${FONT_HEADING}`, 'font-size:14px', 'font-weight:400',
    `color:${C_TEXT_SEC}`, 'text-align:center', 'margin-top:8px',
    'user-select:none', 'line-height:1.45',
    'max-width:280px',
  ].join(';');
  el.appendChild(desc);

  return el;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function updateArrows(): void {
  if (!_leftBtn || !_rightBtn) return;
  _leftBtn.style.opacity  = _currentIdx === 0 ? '0.35' : '1';
  _rightBtn.style.opacity = _currentIdx === _visibleCards.length - 1 ? '0.35' : '1';
}

function updateDots(): void {
  if (!_dotsEl) return;
  Array.from(_dotsEl.children).forEach((dot, i) => {
    (dot as HTMLElement).style.background = i === _currentIdx ? C_PRIMARY : '#d4c8b0';
    (dot as HTMLElement).style.transform  = i === _currentIdx ? 'scale(1.25)' : 'scale(1)';
  });
}

function navigateTo(newIdx: number, dir: number): void {
  if (!_cardSlotEl) return;
  if (newIdx < 0 || newIdx >= _visibleCards.length) return;

  const slideOut = dir > 0 ? '-36px' : '36px';
  _cardSlotEl.style.transition = 'opacity 0.15s ease-out, transform 0.15s ease-out';
  _cardSlotEl.style.opacity    = '0';
  _cardSlotEl.style.transform  = `translateX(${slideOut})`;

  setTimeout(() => {
    _currentIdx = newIdx;
    if (!_cardSlotEl) return;

    // Replace card content
    _cardSlotEl.innerHTML = '';
    const nextCard = _visibleCards[_currentIdx];
    if (nextCard) _cardSlotEl.appendChild(renderCard(nextCard));

    const slideIn = dir > 0 ? '36px' : '-36px';
    _cardSlotEl.style.transition = 'none';
    _cardSlotEl.style.opacity    = '0';
    _cardSlotEl.style.transform  = `translateX(${slideIn})`;

    requestAnimationFrame(() => {
      if (!_cardSlotEl) return;
      _cardSlotEl.style.transition = 'opacity 0.22s ease-out, transform 0.22s ease-out';
      _cardSlotEl.style.opacity    = '1';
      _cardSlotEl.style.transform  = 'translateX(0)';
    });

    updateArrows();
    updateDots();
  }, 150);
}

// ─── Swipe handling ───────────────────────────────────────────────────────────

function attachSwipe(el: HTMLElement): void {
  let startX = 0, startY = 0;
  el.addEventListener('touchstart', (e) => {
    startX = e.touches[0]!.clientX;
    startY = e.touches[0]!.clientY;
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0]!.clientX - startX;
    const dy = e.changedTouches[0]!.clientY - startY;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) navigateTo(_currentIdx + 1,  1);
      else        navigateTo(_currentIdx - 1, -1);
    }
  }, { passive: true });
}

// ─── Overlay builder ──────────────────────────────────────────────────────────

const CLOSE_SVG = `
<svg viewBox="0 0 24 24" width="18" height="18" fill="none"
     stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
  <path d="M6 6l12 12M18 6l-12 12"/>
</svg>`;

const ARROW_LEFT_SVG = `
<svg viewBox="0 0 24 24" width="22" height="22" fill="none"
     stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="15 18 9 12 15 6"/>
</svg>`;

const ARROW_RIGHT_SVG = `
<svg viewBox="0 0 24 24" width="22" height="22" fill="none"
     stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="9 6 15 12 9 18"/>
</svg>`;

function buildOverlay(): void {
  const ui = document.getElementById('ui')!;

  _overlayEl = document.createElement('div');
  _overlayEl.style.cssText = [
    'position:fixed', 'inset:0',
    'z-index:65', 'display:none',
    `font-family:${FONT}`,
  ].join(';');

  _panelEl = document.createElement('div');
  _panelEl.style.cssText = [
    'position:absolute', 'inset:0',
    'background:#ffedcd',
    'display:flex', 'flex-direction:column',
    'transform:translateY(100%)',
    'transition:transform 0.3s ease-out',
    'will-change:transform',
  ].join(';');

  // ── Top bar ────────────────────────────────────────────────────────────────
  const topBar = document.createElement('div');
  topBar.style.cssText = [
    'position:relative',
    'display:flex', 'align-items:center', 'justify-content:center',
    'height:44px',
    'padding-top:calc(env(safe-area-inset-top, 0px) + 12px)',
    'padding-left:16px', 'padding-right:16px',
    'box-sizing:content-box', 'flex-shrink:0',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'How to Play';
  title.style.cssText = [
    `font-family:${FONT_HEADING}`, 'font-size:20px', 'font-weight:700',
    `color:${C_TEXT}`, 'letter-spacing:-0.01em',
  ].join(';');

  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('aria-label', 'Close How to Play');
  closeBtn.innerHTML = CLOSE_SVG;
  closeBtn.style.cssText = [
    'position:absolute',
    'top:calc(env(safe-area-inset-top, 0px) + 12px)', 'bottom:0',
    'right:16px', 'margin:auto 0',
    'width:40px', 'height:40px',
    'display:flex', 'align-items:center', 'justify-content:center',
    `background:${C_RECESSED}`, 'border:none', 'padding:0',
    'border-radius:9999px',
    `color:${C_TEXT}`, 'cursor:pointer',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'outline:none',
    'transition:transform 0.15s ease-out',
  ].join(';');
  addPressFeedback(closeBtn);
  closeBtn.addEventListener('click', () => { playButtonTap(); hideHowToPlay(); });

  topBar.appendChild(title);
  topBar.appendChild(closeBtn);

  // ── Content area ───────────────────────────────────────────────────────────
  const content = document.createElement('div');
  content.style.cssText = [
    'flex:1', 'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center',
    'padding:16px 0 calc(env(safe-area-inset-bottom, 0px) + 20px)',
    'gap:20px', 'overflow:hidden',
  ].join(';');

  // Arrow + card row
  const navRow = document.createElement('div');
  navRow.style.cssText = [
    'display:flex', 'align-items:center',
    'width:100%', 'padding:0 8px', 'box-sizing:border-box',
    'gap:4px',
  ].join(';');

  const makeArrow = (svg: string): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.innerHTML = svg;
    btn.style.cssText = [
      'flex-shrink:0',
      'width:44px', 'height:44px',
      'display:flex', 'align-items:center', 'justify-content:center',
      'border:none', 'background:none', 'padding:0',
      `color:${C_TEXT}`, 'cursor:pointer',
      '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
      'transition:opacity 0.15s ease-out, transform 0.15s ease-out',
    ].join(';');
    addPressFeedback(btn);
    return btn;
  };

  _leftBtn = makeArrow(ARROW_LEFT_SVG);
  _leftBtn.setAttribute('aria-label', 'Previous card');
  _leftBtn.addEventListener('click', () => {
    if (_currentIdx > 0) { playButtonTap(); navigateTo(_currentIdx - 1, -1); }
  });

  _rightBtn = makeArrow(ARROW_RIGHT_SVG);
  _rightBtn.setAttribute('aria-label', 'Next card');
  _rightBtn.addEventListener('click', () => {
    if (_currentIdx < _visibleCards.length - 1) { playButtonTap(); navigateTo(_currentIdx + 1, 1); }
  });

  // Card slot: overflow hidden, clips the slide animation.
  const cardWrapper = document.createElement('div');
  cardWrapper.style.cssText = [
    'flex:1', 'overflow:hidden',
    'display:flex', 'align-items:center', 'justify-content:center',
    'padding:0 4px',
  ].join(';');

  _cardSlotEl = document.createElement('div');
  _cardSlotEl.style.cssText = [
    'display:flex', 'align-items:center', 'justify-content:center',
    'width:100%',
  ].join(';');
  attachSwipe(_cardSlotEl);

  cardWrapper.appendChild(_cardSlotEl);
  navRow.appendChild(_leftBtn);
  navRow.appendChild(cardWrapper);
  navRow.appendChild(_rightBtn);

  // Dots indicator
  _dotsEl = document.createElement('div');
  _dotsEl.style.cssText = 'display:flex;align-items:center;gap:12px;';

  content.appendChild(navRow);
  content.appendChild(_dotsEl);

  _panelEl.appendChild(topBar);
  _panelEl.appendChild(content);
  _overlayEl.appendChild(_panelEl);
  ui.appendChild(_overlayEl);
}

function populateDots(count: number): void {
  if (!_dotsEl) return;
  _dotsEl.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    dot.style.cssText = [
      'width:8px', 'height:8px', 'border-radius:50%',
      'transition:background 0.2s ease-out, transform 0.2s ease-out',
    ].join(';');
    _dotsEl.appendChild(dot);
  }
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function renderEmptyState(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = [
    'display:flex', 'flex-direction:column', 'align-items:center', 'gap:12px',
    'padding:32px 24px', 'text-align:center',
  ].join(';');
  const icon = document.createElement('div');
  icon.textContent = '🎮';
  icon.style.cssText = 'font-size:40px;';
  const msg = document.createElement('div');
  msg.textContent = 'Complete the tutorial to unlock How to Play cards.';
  msg.style.cssText = [
    `font-family:${FONT_HEADING}`, 'font-size:15px', 'font-weight:500',
    `color:${C_TEXT_SEC}`, 'max-width:240px', 'line-height:1.45',
  ].join(';');
  el.appendChild(icon);
  el.appendChild(msg);
  return el;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function showHowToPlay(): void {
  if (!_overlayEl) buildOverlay();
  if (!_overlayEl || !_panelEl || !_cardSlotEl || !_dotsEl) return;

  // Derive visible cards from current unlock state each time.
  const seen = getMechanicsSeen();
  _visibleCards = CARDS.filter(c => seen.includes(c.id));
  _currentIdx   = 0;

  _cardSlotEl.innerHTML = '';
  _dotsEl.innerHTML     = '';

  if (_visibleCards.length === 0) {
    _cardSlotEl.appendChild(renderEmptyState());
    if (_leftBtn)  { _leftBtn.style.visibility  = 'hidden'; }
    if (_rightBtn) { _rightBtn.style.visibility = 'hidden'; }
  } else {
    if (_leftBtn)  { _leftBtn.style.visibility  = 'visible'; }
    if (_rightBtn) { _rightBtn.style.visibility = 'visible'; }
    const firstCard = _visibleCards[0];
    if (firstCard) _cardSlotEl.appendChild(renderCard(firstCard));
    _cardSlotEl.style.opacity   = '1';
    _cardSlotEl.style.transform = 'translateX(0)';
    populateDots(_visibleCards.length);
    updateArrows();
    updateDots();
  }

  // Slide panel up.
  _overlayEl.style.display = 'block';
  _panelEl.style.transition = 'none';
  _panelEl.style.transform  = 'translateY(100%)';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!_panelEl) return;
      _panelEl.style.transition = 'transform 0.3s ease-out';
      _panelEl.style.transform  = 'translateY(0)';
    });
  });
}

export function hideHowToPlay(): void {
  if (!_overlayEl || !_panelEl) return;
  _panelEl.style.transition = 'transform 0.3s ease-out';
  _panelEl.style.transform  = 'translateY(100%)';
  setTimeout(() => {
    if (_overlayEl) _overlayEl.style.display = 'none';
  }, 310);
}
