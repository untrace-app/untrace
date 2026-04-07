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

function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
  width: number,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

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

      ctx.save();
      ctx.fillStyle = isActive ? COLOR_DOT_ACTIVE : COLOR_DOT_INACTIVE;
      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
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

    drawLine(ctx, a.x, a.y, b.x, b.y, color, width);
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
}
