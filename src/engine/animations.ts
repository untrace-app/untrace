// Animation queue and easing utilities

import type { ConnectionKey, GameState } from '../types.ts';
import {
  LAYER_COLORS,
  COLOR_ACCIDENTAL_FLASH,
  DOT_RADIUS,
  LINE_WIDTH_BASE,
  ANIM_ERASE_MS,
  ANIM_SHIMMER_MS,
} from '../constants.ts';

// Local overrides — values tuned for visibility, not exposed as shared constants.
const GHOST_TRAIL_DURATION    = 500; // ms — longer than ANIM_GHOST_TRAIL_MS (300) for visibility
const ACCIDENTAL_DRAW_DURATION = 200; // ms — longer than ANIM_ACCIDENTAL_FLASH_MS (100) for pop
const DOT_ACTIVATION_DURATION  = 300; // ms — longer than ANIM_DOT_ACTIVATION_MS (150) for ripple
const WRONG_DOT_DURATION       = 200; // ms — brief red flash on wrong dot tap

// ─── Types ────────────────────────────────────────────────────────────────────

export type GridToPixelFn = (col: number, row: number) => { x: number; y: number };

interface EraseAnim {
  type: 'erase';
  key: ConnectionKey;
  fromLayer: number;
  elapsed: number;
}

interface GhostTrailAnim {
  type: 'ghostTrail';
  key: ConnectionKey;
  fromLayer: number;
  elapsed: number;
}

interface ShimmerAnim {
  type: 'shimmer';
  key: ConnectionKey;
  belowLayer: number;
  elapsed: number;
}

interface AccidentalDrawAnim {
  type: 'accidentalDraw';
  key: ConnectionKey;
  elapsed: number;
}

interface DotActivationAnim {
  type: 'dotActivation';
  col: number;
  row: number;
  elapsed: number;
}

interface WrongDotAnim {
  type: 'wrongDot';
  col: number;
  row: number;
  elapsed: number;
}

type AnimEntry =
  | EraseAnim
  | GhostTrailAnim
  | ShimmerAnim
  | AccidentalDrawAnim
  | DotActivationAnim
  | WrongDotAnim;

// ─── Easing ───────────────────────────────────────────────────────────────────

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

// ─── Key parsing ──────────────────────────────────────────────────────────────

function parseKey(key: ConnectionKey): [[number, number], [number, number]] | null {
  const parts = key.split('-');
  if (parts.length !== 2) return null;
  const a = (parts[0] as string).split(',').map(Number);
  const b = (parts[1] as string).split(',').map(Number);
  if (a.length !== 2 || b.length !== 2) return null;
  return [[a[0]!, a[1]!], [b[0]!, b[1]!]];
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────

function drawSegment(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
  width: number,
  alpha: number,
): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

// ─── Module state ─────────────────────────────────────────────────────────────

const _anims: AnimEntry[] = [];

// ─── AnimationManager ─────────────────────────────────────────────────────────

export class AnimationManager {
  /** Advance all animations by dt milliseconds and prune completed ones. */
  update(dt: number): void {
    for (const anim of _anims) {
      anim.elapsed += dt;
    }

    let i = _anims.length;
    while (i-- > 0) {
      const a = _anims[i]!;
      const done =
        (a.type === 'erase'          && a.elapsed >= ANIM_ERASE_MS)            ||
        (a.type === 'ghostTrail'     && a.elapsed >= GHOST_TRAIL_DURATION)     ||
        (a.type === 'shimmer'        && a.elapsed >= ANIM_SHIMMER_MS)          ||
        (a.type === 'accidentalDraw' && a.elapsed >= ACCIDENTAL_DRAW_DURATION) ||
        (a.type === 'dotActivation'  && a.elapsed >= DOT_ACTIVATION_DURATION)  ||
        (a.type === 'wrongDot'       && a.elapsed >= WRONG_DOT_DURATION);
      if (done) _anims.splice(i, 1);
    }
  }

  /** Draw all active animation overlays on top of the already-rendered frame. */
  draw(ctx: CanvasRenderingContext2D, gridToPixel: GridToPixelFn, state?: GameState): void {
    if (state) _drawLockedDotPulse(ctx, gridToPixel, state);
    for (const anim of _anims) {
      switch (anim.type) {
        case 'erase':          _drawErase(ctx, gridToPixel, anim);          break;
        case 'ghostTrail':     _drawGhostTrail(ctx, gridToPixel, anim);     break;
        case 'shimmer':        _drawShimmer(ctx, gridToPixel, anim);        break;
        case 'accidentalDraw': _drawAccidentalDraw(ctx, gridToPixel, anim); break;
        case 'dotActivation':  _drawDotActivation(ctx, gridToPixel, anim);  break;
        case 'wrongDot':       _drawWrongDot(ctx, gridToPixel, anim);       break;
      }
    }
  }
}

// ─── Per-type draw functions ──────────────────────────────────────────────────

function _drawErase(
  ctx: CanvasRenderingContext2D,
  g2p: GridToPixelFn,
  anim: EraseAnim,
): void {
  const coords = parseKey(anim.key);
  if (!coords) return;
  const color = LAYER_COLORS[anim.fromLayer];
  if (!color) return;

  const a = g2p(coords[0][0], coords[0][1]);
  const b = g2p(coords[1][0], coords[1][1]);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;

  // t drives how far the dissolution has spread outward from the midpoint.
  // At t=0 both halves are fully visible; at t=1 both are gone.
  const t     = easeOut(clamp01(anim.elapsed / ANIM_ERASE_MS));
  const width = LINE_WIDTH_BASE + (anim.fromLayer - 1) * 2;
  const alpha = 1 - t * 0.5; // gentle simultaneous fade

  // Each segment shrinks from mid toward its endpoint.
  // Visible: endpoint → lerp(mid → endpoint, t)
  const rax = a.x + (mx - a.x) * (1 - t);
  const ray = a.y + (my - a.y) * (1 - t);
  const rbx = b.x + (mx - b.x) * (1 - t);
  const rby = b.y + (my - b.y) * (1 - t);

  drawSegment(ctx, a.x, a.y, rax, ray, color, width, alpha);
  drawSegment(ctx, b.x, b.y, rbx, rby, color, width, alpha);
}

function _drawGhostTrail(
  ctx: CanvasRenderingContext2D,
  g2p: GridToPixelFn,
  anim: GhostTrailAnim,
): void {
  const coords = parseKey(anim.key);
  if (!coords) return;

  const a = g2p(coords[0][0], coords[0][1]);
  const b = g2p(coords[1][0], coords[1][1]);
  const t = easeOut(clamp01(anim.elapsed / GHOST_TRAIL_DURATION));

  // White ghost trail at 40% opacity, fading to 0 over 500ms.
  const alpha = 0.40 * (1 - t);
  drawSegment(ctx, a.x, a.y, b.x, b.y, '#E8E8F0', LINE_WIDTH_BASE, alpha);
}

function _drawShimmer(
  ctx: CanvasRenderingContext2D,
  g2p: GridToPixelFn,
  anim: ShimmerAnim,
): void {
  if (anim.belowLayer <= 0) return; // no layer beneath — skip
  const coords = parseKey(anim.key);
  if (!coords) return;
  const color = LAYER_COLORS[anim.belowLayer];
  if (!color) return;

  const a = g2p(coords[0][0], coords[0][1]);
  const b = g2p(coords[1][0], coords[1][1]);
  // Shimmer peaks at t=0 and fades to 0 at t=1 (pure ease-out decay).
  const decay = 1 - easeOut(clamp01(anim.elapsed / ANIM_SHIMMER_MS));
  const width  = LINE_WIDTH_BASE + (anim.belowLayer - 1) * 2;

  // White brightness halo behind the layer color.
  drawSegment(ctx, a.x, a.y, b.x, b.y, '#FFFFFF', width + 6, decay * 0.35);
  // Layer color overlay at brightened alpha.
  drawSegment(ctx, a.x, a.y, b.x, b.y, color, width, decay * 0.65);
}

function _drawAccidentalDraw(
  ctx: CanvasRenderingContext2D,
  g2p: GridToPixelFn,
  anim: AccidentalDrawAnim,
): void {
  const coords = parseKey(anim.key);
  if (!coords) return;

  const a = g2p(coords[0][0], coords[0][1]);
  const b = g2p(coords[1][0], coords[1][1]);
  const t = easeOut(clamp01(anim.elapsed / ACCIDENTAL_DRAW_DURATION));

  // Starts at full opacity and 1.5× line width, shrinks to normal width and fades to 0.
  // The settled red layer is drawn by the main renderer underneath.
  const alpha = 1 - t;
  const width = LINE_WIDTH_BASE * 1.5 - (LINE_WIDTH_BASE * 1.5 - LINE_WIDTH_BASE) * t;
  drawSegment(ctx, a.x, a.y, b.x, b.y, COLOR_ACCIDENTAL_FLASH, width, alpha);
}

function _drawDotActivation(
  ctx: CanvasRenderingContext2D,
  g2p: GridToPixelFn,
  anim: DotActivationAnim,
): void {
  const { x, y } = g2p(anim.col, anim.row);
  const t = easeOut(clamp01(anim.elapsed / DOT_ACTIVATION_DURATION));

  // Solid white circle: starts at 2.5× dot radius and shrinks to 1×, fading from 50% to 0%.
  // Shrinking inward gives a visible pulse/ripple that collapses onto the dot.
  const startRadius = DOT_RADIUS * 2.5;
  const endRadius   = DOT_RADIUS * 1.0;
  const radius = startRadius - (startRadius - endRadius) * t;
  const alpha  = 0.5 * (1 - t);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function _drawLockedDotPulse(
  ctx: CanvasRenderingContext2D,
  g2p: GridToPixelFn,
  state: GameState,
): void {
  if (!state.playerDot || state.isTracing || state.moveCount === 0) return;
  const [col, row] = state.playerDot;
  const { x, y } = g2p(col, row);
  // Oscillate over a 1-second cycle using wall-clock time so the pulse is
  // independent of dt accumulation and runs smoothly at any frame rate.
  const phase = (performance.now() % 1000) / 1000; // 0..1 over 1 s
  const t     = (Math.sin(phase * Math.PI * 2) + 1) / 2; // 0..1..0
  const glowR = DOT_RADIUS * (1.0 + 0.8 * t);             // 1× → 1.8×
  const alpha = 0.10 + 0.25 * t;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x, y, glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function _drawWrongDot(
  ctx: CanvasRenderingContext2D,
  g2p: GridToPixelFn,
  anim: WrongDotAnim,
): void {
  const { x, y } = g2p(anim.col, anim.row);
  const t     = easeOut(clamp01(anim.elapsed / WRONG_DOT_DURATION));
  // Expands from 3× to 3.6× dot radius while fading out — large enough to
  // show beyond a fingertip covering the dot.
  const radius = DOT_RADIUS * (3.0 + 0.6 * t);
  const alpha  = 0.30 * (1 - t);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#FF4444';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── Singleton + trigger functions ────────────────────────────────────────────

export const animationManager = new AnimationManager();

/**
 * Trigger a line-erase animation.
 * fromLayer is the layer count before the erase (the color being removed).
 * Automatically queues a ghost trail (final erase) or shimmer (layer reveal).
 */
export function triggerErase(key: ConnectionKey, fromLayer: number): void {
  _anims.push({ type: 'erase', key, fromLayer, elapsed: 0 });
  if (fromLayer === 1) {
    console.log('[anim] ghostTrail', key, 'fromLayer=1→0');
    _anims.push({ type: 'ghostTrail', key, fromLayer, elapsed: 0 });
  } else {
    _anims.push({ type: 'shimmer', key, belowLayer: fromLayer - 1, elapsed: 0 });
  }
}

/** Trigger the red flash for an accidental draw on an empty connection. */
export function triggerAccidentalDraw(key: ConnectionKey): void {
  console.log('[anim] accidentalDraw', key);
  _anims.push({ type: 'accidentalDraw', key, elapsed: 0 });
}

/** Trigger the radial glow when the player arrives at a dot. */
export function triggerDotActivation(dot: [number, number]): void {
  console.log('[anim] dotActivation', dot);
  _anims.push({ type: 'dotActivation', col: dot[0], row: dot[1], elapsed: 0 });
}

/** Trigger the red flash when the player taps a dot that is not the locked dot. */
export function triggerWrongDotFlash(col: number, row: number): void {
  _anims.push({ type: 'wrongDot', col, row, elapsed: 0 });
}
