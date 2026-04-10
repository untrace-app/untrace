// Touch/pointer input handling, dot snapping, path interpolation

import type { GameState } from '../types.ts';
import { SNAP_RADIUS, INPUT_DEBOUNCE_MS, FONT, C_TEXT } from '../constants.ts';
import { checkWin } from './logic.ts';
import { triggerWrongDotFlash } from './animations.ts';
import { hapticSnap } from '../haptics.ts';

type GridToPixel = (col: number, row: number) => { x: number; y: number };
type OnMove = (from: [number, number], to: [number, number]) => void;

/** Mutable object returned by initInput so the renderer can read the live pointer position. */
export interface InputState {
  /** Raw CSS-pixel position of the active pointer, or null when not tracing. */
  rawPointer: { x: number; y: number } | null;
  /** Cancel any active trace immediately (e.g. on window blur / phone call). */
  cancelTrace: () => void;
  /** Remove all pointer listeners from the canvas. */
  destroy: () => void;
}

// ─── Nearest dot ─────────────────────────────────────────────────────────────

function findNearestDot(
  px: number,
  py: number,
  cols: number,
  rows: number,
  gridToPixel: GridToPixel,
): [number, number] | null {
  let nearest: [number, number] | null = null;
  let minDist = SNAP_RADIUS;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const { x, y } = gridToPixel(col, row);
      const dx = px - x;
      const dy = py - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = [col, row];
      }
    }
  }

  return nearest;
}

// ─── Intermediate dot interpolation ──────────────────────────────────────────

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) { const t = b; b = a % b; a = t; }
  return a;
}

/**
 * Find all grid dots that lie exactly on the straight line between `from` and
 * `to` (in grid-coordinate space), excluding the endpoints. Returned in order
 * from `from` toward `to`.
 *
 * Uses integer GCD stepping: divide the displacement by gcd(|dc|,|dr|) to get
 * the minimal unit step, then walk from `from` to `to` collecting every
 * intermediate lattice point. This is exact — no floating-point division.
 *
 * Examples: (0,0)→(2,0) yields [(1,0)].  (0,0)→(2,2) yields [(1,1)].
 *           (2,0)→(0,2) yields [(1,1)].  (0,0)→(1,0) yields [].
 */
function getIntermediateDots(
  from: [number, number],
  to: [number, number],
  _cols: number,
  _rows: number,
): [number, number][] {
  const [c1, r1] = from;
  const [c2, r2] = to;
  const dc = c2 - c1;
  const dr = r2 - r1;
  if (dc === 0 && dr === 0) return [];

  const step = gcd(Math.abs(dc), Math.abs(dr));
  const sc = dc / step;
  const sr = dr / step;

  const results: [number, number][] = [];
  let c = c1 + sc;
  let r = r1 + sr;
  while (c !== c2 || r !== r2) {
    results.push([c, r]);
    c += sc;
    r += sr;
  }
  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Attach pointer event listeners to `canvas` and wire them into the game loop.
 *
 * @param canvas      The game canvas element.
 * @param gridToPixel Maps (col, row) → CSS pixel position. Called each frame so
 *                    it always reflects the current canvas layout.
 * @param state       The mutable game state (read and written directly).
 * @param onMove      Called once per dot-to-dot transition with (from, to).
 */
export function initInput(
  canvas: HTMLCanvasElement,
  gridToPixel: GridToPixel,
  state: GameState,
  onMove: OnMove,
  isTutorial?: boolean,
): InputState {
  // Prevent the browser from claiming touch events for scrolling.
  canvas.style.touchAction = 'none';

  const ac = new AbortController();
  const inputState: InputState = {
    rawPointer: null,
    cancelTrace: () => {
      clearTimeout(debounceTimer);
      pendingEvent    = null;
      activePointerId = null;
      inputState.rawPointer           = null;
      state.isTracing                 = false;
      state.currentStrokeConnections  = new Set();
    },
    destroy: () => ac.abort(),
  };

  let currentDot: [number, number] | null = null;
  let activePointerId: number | null = null;
  let lastMoveTime = 0;
  let pendingEvent: PointerEvent | null = null;
  let debounceTimer = 0;

  function getPointerPos(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function processSnap(px: number, py: number): void {
    if (currentDot === null) return;
    const { cols, rows } = state.grid;

    const snapped = findNearestDot(px, py, cols, rows, gridToPixel);
    if (snapped === null) return;
    if (snapped[0] === currentDot[0] && snapped[1] === currentDot[1]) return;

    // Walk through any intermediate dots on the straight-line path first,
    // then emit the final move to the actual snap target.
    const intermediates = getIntermediateDots(currentDot, snapped, cols, rows);

    for (const next of intermediates) {
      state.playerDot = currentDot;
      hapticSnap();
      onMove(currentDot, next);
      currentDot = next;
      state.playerDot = next;
    }

    // Final move: last intermediate (or original dot) → snap target.
    state.playerDot = currentDot;
    hapticSnap();
    onMove(currentDot, snapped);
    currentDot = snapped;
    state.playerDot = snapped;
  }

  // ── pointerdown ────────────────────────────────────────────────────────────

  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    if (checkWin(state)) return;
    // Only track one finger at a time.
    if (activePointerId !== null) return;

    const { x, y } = getPointerPos(e);
    const { cols, rows } = state.grid;
    const snapped = findNearestDot(x, y, cols, rows, gridToPixel);
    if (snapped === null) return;

    // Lock to the last dot only after the player has committed at least one move.
    // Before any move (moveCount === 0), any dot is freely selectable as a start.
    if (state.moveCount > 0 && state.playerDot !== null && !state.isTracing) {
      if (snapped[0] !== state.playerDot[0] || snapped[1] !== state.playerDot[1]) {
        triggerWrongDotFlash(snapped[0], snapped[1]);
        // Tooltip: always in tutorial, first 3 times outside tutorial
        const tipCount = parseInt(localStorage.getItem('untrace_wrongdot_tip_count') ?? '0', 10);
        const showTip = isTutorial || tipCount < 3;
        if (showTip) {
          if (!isTutorial) localStorage.setItem('untrace_wrongdot_tip_count', String(tipCount + 1));
          // Remove any existing tooltip before showing a new one
          const prev = document.querySelector('[data-wrongdot-tip]');
          if (prev) prev.remove();
          const dotPx = gridToPixel(snapped[0], snapped[1]);
          const rect = canvas.getBoundingClientRect();
          const screenY = rect.top + dotPx.y;
          const showBelow = screenY < 100;
          const tipY = showBelow ? screenY + 30 : screenY - 65;
          const tip = document.createElement('div');
          tip.setAttribute('data-wrongdot-tip', '');
          tip.textContent = 'Continue from the glowing dot';
          tip.style.cssText = [
            'position:fixed',
            `top:${tipY}px`,
            `font-family:${FONT}`,
            'font-size:13px', 'font-weight:500', `color:${C_TEXT}`,
            'background:#feffe5', 'border-radius:12px',
            'padding:6px 12px',
            'box-shadow:0 2px 8px rgba(0,0,0,0.1)',
            'pointer-events:none', 'white-space:nowrap',
            'z-index:100',
            'transition:opacity 0.5s ease',
          ].join(';');
          document.body.appendChild(tip);
          // Clamp horizontal position so tooltip stays on screen
          const tipW = tip.offsetWidth;
          const pad = 12;
          const centerX = rect.left + dotPx.x;
          let tipLeft = centerX - tipW / 2;
          if (tipLeft < pad) tipLeft = pad;
          if (tipLeft + tipW > window.innerWidth - pad) tipLeft = window.innerWidth - pad - tipW;
          tip.style.left = `${tipLeft}px`;
          setTimeout(() => { tip.style.opacity = '0'; }, 2000);
          setTimeout(() => { tip.remove(); }, 2500);
        }
        return;
      }
    }

    activePointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);

    currentDot           = snapped;
    state.playerDot      = snapped;
    state.isTracing      = true;
    inputState.rawPointer = getPointerPos(e);
  }, { signal: ac.signal });

  // ── pointermove ────────────────────────────────────────────────────────────

  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    if (checkWin(state)) return;
    if (e.pointerId !== activePointerId || !state.isTracing) return;

    // Always update raw pointer immediately for the ghost trail.
    inputState.rawPointer = getPointerPos(e);

    const now = Date.now();
    if (now - lastMoveTime >= INPUT_DEBOUNCE_MS) {
      // Enough time has passed — process immediately.
      clearTimeout(debounceTimer);
      pendingEvent = null;
      lastMoveTime = now;
      processSnap(inputState.rawPointer.x, inputState.rawPointer.y);
    } else {
      // Too soon — store as pending and schedule a trailing-edge fire.
      pendingEvent = e;
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        if (pendingEvent !== null) {
          lastMoveTime = Date.now();
          const { x, y } = getPointerPos(pendingEvent);
          processSnap(x, y);
          pendingEvent = null;
        }
      }, INPUT_DEBOUNCE_MS - (now - lastMoveTime));
    }
  }, { signal: ac.signal });

  // ── pointerup / pointercancel ──────────────────────────────────────────────

  function endStroke(e: PointerEvent): void {
    if (e.pointerId !== activePointerId) return;
    clearTimeout(debounceTimer);
    pendingEvent                   = null;
    activePointerId                = null;
    inputState.rawPointer          = null;
    state.isTracing                = false;
    state.currentStrokeConnections = new Set();
  }

  canvas.addEventListener('pointerup',     endStroke, { signal: ac.signal });
  canvas.addEventListener('pointercancel', endStroke, { signal: ac.signal });

  return inputState;
}
