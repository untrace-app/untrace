// Canvas 2D rendering (grid, dots, lines, animations)

import type { GameState } from '../types.ts';
import {
  COLOR_DOT_INACTIVE,
  COLOR_DOT_ACTIVE,
  LAYER_COLORS,
  DOT_RADIUS,
  LINE_WIDTH_BASE,
  GRID_FILL_RATIO,
} from '../constants.ts';
import {
  getCurrentHintLevel,
  hasHint,
  getStartingDot,
  getActiveHintAnim,
  updateHintAnim,
} from '../hints.ts';
import { drawPatternedLine } from '../colorblind.ts';

// ─── Ghost hand image (lazy-loaded) ───────────────────────────────────────

let _handImg: HTMLImageElement | null = null;
let _handImgLoaded = false;
function getHandImg(): HTMLImageElement | null {
  if (_handImg === null) {
    _handImg = new Image();
    _handImg.onload = () => { _handImgLoaded = true; };
    _handImg.src = '/hand.svg';
  }
  return _handImgLoaded ? _handImg : null;
}

// ─── Grid layout helper ───────────────────────────────────────────────────────

interface GridLayout {
  spacing: number;   // px between adjacent dots
  originX: number;   // px of the top-left dot centre
  originY: number;   // px of the top-left dot centre
}

function computeLayout(
  canvas: HTMLCanvasElement,
  cols: number,
  rows: number,
): GridLayout {
  // Work in CSS pixels (canvas.style dimensions), not physical pixels.
  const cssWidth  = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;

  const smaller  = Math.min(cssWidth, cssHeight);
  const gridSpan = smaller * GRID_FILL_RATIO;

  // spacing is the distance between adjacent dot centres.
  // For an N-column grid there are (N-1) gaps.
  const spacingX = cols  > 1 ? gridSpan / (cols  - 1) : 0;
  const spacingY = rows > 1 ? gridSpan / (rows - 1) : 0;
  const spacing  = Math.min(spacingX, spacingY);

  const gridW = spacing * (cols  - 1);
  const gridH = spacing * (rows - 1);

  const originX = (cssWidth  - gridW) / 2;
  const originY = (cssHeight - gridH) / 2;

  return { spacing, originX, originY };
}

/** Convert a grid coordinate [col, row] to a canvas CSS-pixel position. */
export function gridToPixel(
  col: number,
  row: number,
  layout: GridLayout,
): { x: number; y: number } {
  return {
    x: layout.originX + col * layout.spacing,
    y: layout.originY + row * layout.spacing,
  };
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────

function drawDots(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  layout: GridLayout,
): void {
  const { cols, rows } = state.grid;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const { x, y } = gridToPixel(col, row, layout);

      const isActive =
        state.playerDot !== null &&
        state.playerDot[0] === col &&
        state.playerDot[1] === row;

      const isPulsing = isActive && !state.isTracing && state.moveCount > 0;
      let radius = DOT_RADIUS;

      if (isPulsing) {
        const pulse = (Math.sin(performance.now() / 1000 * Math.PI * 2) + 1) / 2;
        radius = DOT_RADIUS * (1.0 + 0.3 * pulse);
        // Soft radial glow behind the dot
        const glowR = 25;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        grad.addColorStop(0, `rgba(255,255,255,${(0.15 + 0.15 * pulse).toFixed(2)})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save();
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.fillStyle = isActive ? COLOR_DOT_ACTIVE : COLOR_DOT_INACTIVE;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse the sorted connection key "x1,y1-x2,y2" back into two grid coords.
 * Returns null if the key is malformed.
 */
function parseKey(key: string): [[number, number], [number, number]] | null {
  const parts = key.split('-');
  if (parts.length !== 2) return null;
  const a = parts[0]!.split(',').map(Number);
  const b = parts[1]!.split(',').map(Number);
  if (a.length !== 2 || b.length !== 2) return null;
  return [[a[0]!, a[1]!], [b[0]!, b[1]!]];
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvas: HTMLCanvasElement,
  rawPointer: { x: number; y: number } | null,
): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  // Clear to transparent so the board-bg div shows through behind the canvas.
  ctx.clearRect(0, 0, w, h);

  const layout = computeLayout(canvas, state.grid.cols, state.grid.rows);

  // Draw connections first so dots render on top.
  for (const [key, conn] of state.connections) {
    if (conn.layers === 0) continue;

    const color = LAYER_COLORS[conn.layers];
    if (!color) continue;

    const coords = conn.directional
      ? [conn.directional.from, conn.directional.to] as const
      : parseKey(key);

    if (!coords) continue;

    const a = gridToPixel(coords[0][0], coords[0][1], layout);
    const b = gridToPixel(coords[1][0], coords[1][1], layout);
    const width = LINE_WIDTH_BASE + (conn.layers - 1) * 2;

    drawPatternedLine(ctx, a.x, a.y, b.x, b.y, color, width, conn.layers);
  }

  // Ghost trail: line from the snapped dot to the raw pointer position.
  // Drawn before dots so it renders behind them.
  if (state.isTracing && state.playerDot !== null && rawPointer !== null) {
    const from = gridToPixel(state.playerDot[0], state.playerDot[1], layout);
    ctx.save();
    ctx.strokeStyle = 'rgba(127, 124, 108, 0.6)'; // #7f7c6c at 60% opacity
    ctx.lineWidth   = LINE_WIDTH_BASE;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(rawPointer.x, rawPointer.y);
    ctx.stroke();
    ctx.restore();
  }

  drawDots(ctx, state, layout);

  // Hint overlays (glow on starting dot, ghost trail for replayed solutions).
  drawHintOverlays(ctx, layout);
}

// ─── Hint overlays ────────────────────────────────────────────────────────

function drawHintOverlays(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
): void {
  const level = getCurrentHintLevel();
  if (!level) return;

  // Hint 1: bright pulsing blue glow on the optimal starting dot.
  if (hasHint(level.id, 1)) {
    const start = getStartingDot(level);
    if (start) {
      const { x, y } = gridToPixel(start[0], start[1], layout);
      const t = performance.now() / 1000;
      const pulse = (Math.sin(t * Math.PI * 2) + 1) / 2; // 0..1
      const scale   = 1.0 + 0.4 * pulse;
      const opacity = 0.6 + 0.4 * pulse;
      const baseR   = DOT_RADIUS * 1.6;

      ctx.save();
      ctx.globalAlpha = opacity;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, baseR * scale);
      grad.addColorStop(0,    'rgba(58,134,255,0.85)');
      grad.addColorStop(0.5,  'rgba(58,134,255,0.35)');
      grad.addColorStop(1,    'rgba(58,134,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, baseR * scale, 0, Math.PI * 2);
      ctx.fill();
      // Solid core ring
      ctx.globalAlpha = 0.9 * opacity;
      ctx.strokeStyle = '#3a86ff';
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS * 1.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Hint 2 / Hint 3: ghost-trace animation.
  const now = performance.now();
  updateHintAnim(now);
  const anim = getActiveHintAnim();
  if (!anim || anim.levelId !== level.id) return;

  // Overall fade (applied to all ghost drawing).
  let fade = 1;
  if (anim.fadeOutStart !== 0) {
    fade = Math.max(0, 1 - (now - anim.fadeOutStart) / 500);
  }

  const elapsed = now - anim.startTime;
  const rawIdx  = elapsed / anim.stepMs;
  const clampedIdx = Math.min(rawIdx, anim.moves.length);
  const fullIdx    = Math.floor(clampedIdx);
  const partial    = clampedIdx - fullIdx;

  const ghostAlpha = 0.5 * fade;

  // Completed ghost segments.
  for (let i = 0; i < Math.min(fullIdx, anim.moves.length); i++) {
    const m = anim.moves[i]!;
    const a = gridToPixel(m.from[0], m.from[1], layout);
    const b = gridToPixel(m.to[0],   m.to[1],   layout);
    const layerIdx = Math.max(1, Math.min(5, m.layerBefore || 1));
    const color = LAYER_COLORS[layerIdx] || '#3a86ff';
    drawPatternedLine(
      ctx, a.x, a.y, b.x, b.y, color,
      LINE_WIDTH_BASE * 0.7, layerIdx, ghostAlpha,
    );
  }

  // Partial current segment + hand.
  let handX = 0, handY = 0, haveHand = false;
  if (fullIdx < anim.moves.length) {
    const m = anim.moves[fullIdx]!;
    const a = gridToPixel(m.from[0], m.from[1], layout);
    const b = gridToPixel(m.to[0],   m.to[1],   layout);
    const cx = a.x + (b.x - a.x) * partial;
    const cy = a.y + (b.y - a.y) * partial;
    const layerIdx = Math.max(1, Math.min(5, m.layerBefore || 1));
    const color = LAYER_COLORS[layerIdx] || '#3a86ff';
    drawPatternedLine(
      ctx, a.x, a.y, cx, cy, color,
      LINE_WIDTH_BASE * 0.7, layerIdx, ghostAlpha,
    );
    handX = cx;
    handY = cy;
    haveHand = true;
  } else if (anim.moves.length > 0) {
    const last = anim.moves[anim.moves.length - 1]!;
    const p = gridToPixel(last.to[0], last.to[1], layout);
    handX = p.x;
    handY = p.y;
    haveHand = true;
  }

  // Draw hand pointer on top of the trail (not faded as far).
  if (haveHand) {
    ctx.save();
    ctx.globalAlpha = 0.85 * fade;
    const hand = getHandImg();
    if (hand) {
      const size = 36;
      ctx.drawImage(hand, handX - size * 0.25, handY, size, size);
    } else {
      ctx.fillStyle = '#b17025';
      ctx.beginPath();
      ctx.arc(handX, handY, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
