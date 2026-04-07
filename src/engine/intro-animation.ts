// Level intro animation: board fade → dots appear → lines draw

import type { GameState } from '../types.ts';
import {
  COLOR_DOT_INACTIVE,
  LAYER_COLORS,
  DOT_RADIUS,
  LINE_WIDTH_BASE,
  GRID_FILL_RATIO,
} from '../constants.ts';
import { playPop, playBoardAppear } from '../audio/audio.ts';

// ─── State ───────────────────────────────────────────────────────────────────

export interface IntroState {
  active:       boolean;
  elapsed:      number;   // ms since intro started
  dotCount:     number;   // total dots in the grid
  dotInterval:  number;   // ms between each dot reveal
  lineProgress: number;   // 0–1 progress of line drawing phase
}

let _intro: IntroState = {
  active: false, elapsed: 0, dotCount: 0, dotInterval: 0, lineProgress: 0,
};

// Timing constants
const BOARD_FADE_MS    = 400;
const DOTS_START_MS    = 200;
const DOTS_DURATION_MS = 1000;
const LINES_DURATION_MS = 500;

// Track which dots have had their pop played
let _poppedDots = 0;

// For suspension recovery
let _introResolve: (() => void) | null = null;
let _boardBgElRef: HTMLElement | null  = null;

// ─── Public API ──────────────────────────────────────────────────────────────

/** Start the intro animation. Returns a Promise that resolves when done. */
export function startIntroAnimation(
  state: GameState,
  boardBgEl: HTMLElement,
): Promise<void> {
  _boardBgElRef = boardBgEl;
  const dotCount = state.grid.cols * state.grid.rows;
  const dotInterval = dotCount > 1 ? DOTS_DURATION_MS / (dotCount - 1) : 0;

  _intro = {
    active: true,
    elapsed: 0,
    dotCount,
    dotInterval,
    lineProgress: 0,
  };
  _poppedDots = 0;

  // Board fade: opacity is already 0, display already block (set by runIntro).
  // Delay 100ms so the transparent state is painted before the transition starts.
  console.log('BOARD FADE: starting');
  setTimeout(() => {
    boardBgEl.style.transition = `opacity ${BOARD_FADE_MS}ms ease-out`;
    boardBgEl.style.opacity    = '1';
    playBoardAppear();
    console.log('BOARD FADE: opacity set to 1');
  }, 100);

  const linesEndMs = DOTS_START_MS + DOTS_DURATION_MS + LINES_DURATION_MS;

  return new Promise((resolve) => {
    _introResolve = resolve;
    function check(): void {
      if (_intro.elapsed >= linesEndMs) {
        _intro.active = false;
        boardBgEl.style.transition = '';
        _introResolve = null;
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    }
    requestAnimationFrame(check);
  });
}

/** Is the intro currently playing? */
export function isIntroActive(): boolean {
  return _intro.active;
}

/** Advance intro timer. Call from the render loop with dt in ms. */
export function updateIntro(dt: number): void {
  if (!_intro.active) return;
  _intro.elapsed += dt;

  // Compute line draw progress (0–1)
  const linesStartMs = DOTS_START_MS + DOTS_DURATION_MS;
  if (_intro.elapsed >= linesStartMs) {
    _intro.lineProgress = Math.min(1, (_intro.elapsed - linesStartMs) / LINES_DURATION_MS);
  } else {
    _intro.lineProgress = 0;
  }
}

/** How many dots are visible at the current elapsed time. */
function visibleDotCount(): number {
  const dotsElapsed = _intro.elapsed - DOTS_START_MS;
  if (dotsElapsed <= 0) return 0;
  if (_intro.dotInterval <= 0) return _intro.dotCount;
  return Math.min(_intro.dotCount, Math.floor(dotsElapsed / _intro.dotInterval) + 1);
}

/** Bounce ease: overshoot to 1.15 then settle to 1.0 */
function bounceScale(t: number): number {
  if (t < 0.6) return (t / 0.6) * 1.15;
  return 1.15 - 0.15 * ((t - 0.6) / 0.4);
}

// ─── Intro renderer ──────────────────────────────────────────────────────────

/** Compute grid layout (mirrors renderer.ts computeLayout). */
function computeLayout(canvas: HTMLCanvasElement, cols: number, rows: number) {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const smaller = Math.min(cssW, cssH);
  const gridSpan = smaller * GRID_FILL_RATIO;
  const spacingX = cols > 1 ? gridSpan / (cols - 1) : 0;
  const spacingY = rows > 1 ? gridSpan / (rows - 1) : 0;
  const spacing = Math.min(spacingX, spacingY);
  const originX = (cssW - spacing * (cols - 1)) / 2;
  const originY = (cssH - spacing * (rows - 1)) / 2;
  return { spacing, originX, originY };
}

function gtp(col: number, row: number, layout: { spacing: number; originX: number; originY: number }) {
  return { x: layout.originX + col * layout.spacing, y: layout.originY + row * layout.spacing };
}

function parseKey(key: string): [[number, number], [number, number]] | null {
  const parts = key.split('-');
  if (parts.length !== 2) return null;
  const a = (parts[0] as string).split(',').map(Number);
  const b = (parts[1] as string).split(',').map(Number);
  if (a.length !== 2 || b.length !== 2) return null;
  return [[a[0]!, a[1]!], [b[0]!, b[1]!]];
}

/**
 * Render the intro frame. Call INSTEAD of the normal render() while intro is active.
 * Returns true if the intro is still running, false if done.
 */
export function renderIntro(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvas: HTMLCanvasElement,
): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  const { cols, rows } = state.grid;
  const layout = computeLayout(canvas, cols, rows);
  const visible = visibleDotCount();

  // Play pop sounds for newly visible dots
  while (_poppedDots < visible) {
    playPop();
    _poppedDots++;
  }

  // ── Draw lines (with progress-based dashoffset) ───────────────────────────
  if (_intro.lineProgress > 0) {
    for (const [key, conn] of state.connections) {
      if (conn.layers === 0) continue;
      const color = LAYER_COLORS[conn.layers];
      if (!color) continue;
      const coords = conn.directional
        ? [conn.directional.from, conn.directional.to] as const
        : parseKey(key);
      if (!coords) continue;

      const a = gtp(coords[0][0], coords[0][1], layout);
      const b = gtp(coords[1][0], coords[1][1], layout);
      const lineLen = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
      const width = LINE_WIDTH_BASE + (conn.layers - 1) * 2;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      // Draw only the visible fraction using setLineDash
      const drawn = lineLen * _intro.lineProgress;
      ctx.setLineDash([drawn, lineLen - drawn]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Draw dots (staggered with bounce) ─────────────────────────────────────
  let dotIndex = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (dotIndex >= visible) return; // remaining dots not yet visible

      const { x, y } = gtp(col, row, layout);

      // Compute how long this dot has been visible
      const dotAppearMs = DOTS_START_MS + dotIndex * _intro.dotInterval;
      const dotAge = Math.max(0, _intro.elapsed - dotAppearMs);
      // Scale animation over 150ms with bounce
      const t = Math.min(1, dotAge / 150);
      const scale = bounceScale(t);

      ctx.save();
      ctx.fillStyle = COLOR_DOT_INACTIVE;
      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      dotIndex++;
    }
  }
}

/** Skip the intro to its completed state. Called on page resume after suspension. */
export function recoverIntroAnimation(): void {
  if (!_intro.active || !_boardBgElRef) return;
  _intro.active       = false;
  _intro.elapsed      = 999999;
  _intro.lineProgress = 1;
  _boardBgElRef.style.transition = '';
  _boardBgElRef.style.opacity    = '1';
  _boardBgElRef.style.display    = 'block';
  if (_introResolve) {
    const res = _introResolve;
    _introResolve = null;
    res();
  }
}
