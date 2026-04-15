// Colorblind accessibility patterns for layer lines.
// The toggle has been removed from settings; the rendering code below is kept
// for later reactivation. Until then, _enabled stays false forever and
// drawPatternedLine always falls through to the solid-line path.

const _enabled = false;

export function updateColorblindCache(): void {
  // Intentionally a no-op while the feature is disabled.
}

export function isColorblindEnabled(): boolean {
  return _enabled;
}

function layer5Pulse(): number {
  return 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(performance.now() / 500));
}

/**
 * Draw a line with layer-specific pattern when colorblind mode is on.
 * When disabled, behaves like a standard solid stroke.
 *
 * layerIdx: 1..5 (the layer count on the connection). Values outside 1..5
 * fall back to solid.
 */
export function drawPatternedLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
  width: number,
  layerIdx: number,
  opacity: number = 1,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = opacity;

  if (!_enabled || layerIdx === 1) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const dpr = window.devicePixelRatio || 1;

  if (layerIdx === 2) {
    ctx.setLineDash([20 * dpr, 14 * dpr]);
    ctx.lineDashOffset = 0;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  } else if (layerIdx === 3) {
    ctx.lineCap = 'round';
    ctx.setLineDash([2 * dpr, 16 * dpr]);
    ctx.lineDashOffset = 0;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  } else if (layerIdx === 4) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const offset = 5 * dpr;
    const ox = nx * offset;
    const oy = ny * offset;
    ctx.lineWidth = width * 0.4;
    ctx.beginPath();
    ctx.moveTo(x1 + ox, y1 + oy);
    ctx.lineTo(x2 + ox, y2 + oy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1 - ox, y1 - oy);
    ctx.lineTo(x2 - ox, y2 - oy);
    ctx.stroke();
  } else if (layerIdx === 5) {
    ctx.globalAlpha = opacity * layer5Pulse();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
}
