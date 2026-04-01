import { render } from './engine/renderer.ts';
import { animationManager, triggerErase, triggerAccidentalDraw, triggerDotActivation } from './engine/animations.ts';
import { initInput } from './engine/input.ts';
import { processMove, checkWin, makeConnectionKey, undo, redo } from './engine/logic.ts';
import { initAudio, playErase, playFinalErase, playAccidentalDraw, playPuzzleComplete, playUndo } from './audio/audio.ts';
import { initOverlay, updateOverlay } from './ui/overlay.ts';
import { getCurrentLevel, getLevelCount } from './levels/levels.ts';
import type { GameState, ConnectionKey, ConnectionState } from './types.ts';
import { GRID_FILL_RATIO } from './constants.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const ctx = canvas.getContext('2d')!;

function resize(): void {
  const dpr = window.devicePixelRatio ?? 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.scale(dpr, dpr);
}

resize();
window.addEventListener('resize', resize);

// ─── Level tracking ───────────────────────────────────────────────────────────

let currentLevelIndex = 0;

// ─── Game state ───────────────────────────────────────────────────────────────

const gameState: GameState = {
  grid: { cols: 3, rows: 3 },
  connections: new Map(),
  playerDot: null,
  isTracing: false,
  moveCount: 0,
  targetLayers: 0,
  undoStack: [],
  redoStack: [],
  currentStrokeConnections: new Set(),
};

// ─── Level indicator (top-left) ───────────────────────────────────────────────

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const BG   = 'rgba(10,10,20,0.72)';

const levelIndicatorEl = document.createElement('div');
levelIndicatorEl.style.cssText = [
  'position:fixed', 'top:20px', 'left:20px',
  `background:${BG}`, 'border-radius:12px', 'padding:8px 18px',
  'color:#ffffff', `font-family:${FONT}`, 'font-size:14px', 'font-weight:500',
  'letter-spacing:0.04em', 'white-space:nowrap', 'user-select:none', 'pointer-events:none',
].join(';');
document.getElementById('ui')!.appendChild(levelIndicatorEl);

function updateLevelIndicator(): void {
  const total = getLevelCount();
  const level = getCurrentLevel(currentLevelIndex);
  levelIndicatorEl.textContent = `Level ${currentLevelIndex + 1}/${total} — ${level.name}`;
}

// ─── Level loading ────────────────────────────────────────────────────────────

// Snapshot of initial connections for the current level (used by resetGame).
let initialConnections = new Map<ConnectionKey, ConnectionState>();

function loadLevel(index: number): void {
  currentLevelIndex = index % getLevelCount();
  const level = getCurrentLevel(currentLevelIndex);

  // Build connections map from level data.
  const connections = new Map<ConnectionKey, ConnectionState>();
  for (const c of level.connections) {
    const a = c.from;
    const b = c.to;
    const aFirst = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
    const [first, second] = aFirst ? [a, b] : [b, a];
    const key: ConnectionKey = `${first[0]},${first[1]}-${second[0]},${second[1]}`;
    connections.set(key, { layers: c.layers });
  }

  // Save snapshot for reset.
  initialConnections = new Map<ConnectionKey, ConnectionState>(
    Array.from(connections, ([k, v]): [ConnectionKey, ConnectionState] => [k, { ...v }])
  );

  // Apply to game state.
  gameState.grid                      = { ...level.grid };
  gameState.connections               = connections;
  gameState.playerDot                 = null;
  gameState.isTracing                 = false;
  gameState.moveCount                 = 0;
  gameState.targetLayers              = level.targetLayers;
  gameState.undoStack                 = [];
  gameState.redoStack                 = [];
  gameState.currentStrokeConnections  = new Set();

  updateLevelIndicator();
}

function resetGame(): void {
  gameState.connections = new Map<ConnectionKey, ConnectionState>(
    Array.from(initialConnections, ([k, v]): [ConnectionKey, ConnectionState] => [k, { ...v }])
  );
  gameState.playerDot               = null;
  gameState.isTracing               = false;
  gameState.moveCount               = 0;
  gameState.undoStack               = [];
  gameState.redoStack               = [];
  gameState.currentStrokeConnections = new Set();
}

function nextLevel(): void {
  loadLevel((currentLevelIndex + 1) % getLevelCount());
}

// Load the first level immediately.
loadLevel(0);

// ─── Grid-to-pixel helper ─────────────────────────────────────────────────────
//
// Mirrors the layout math in renderer.ts (computeLayout + gridToPixel).
// Kept here so input.ts receives a simple (col, row) → pixel callback
// without needing to export unexported internals from the renderer.

function gridToPixel(col: number, row: number): { x: number; y: number } {
  const cssWidth  = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  const smaller   = Math.min(cssWidth, cssHeight);
  const gridSpan  = smaller * GRID_FILL_RATIO;
  const { cols, rows } = gameState.grid;
  const spacingX  = cols > 1 ? gridSpan / (cols - 1) : 0;
  const spacingY  = rows > 1 ? gridSpan / (rows - 1) : 0;
  const spacing   = Math.min(spacingX, spacingY);
  const originX   = (cssWidth  - spacing * (cols - 1)) / 2;
  const originY   = (cssHeight - spacing * (rows - 1)) / 2;
  return { x: originX + col * spacing, y: originY + row * spacing };
}

// ─── Audio init ───────────────────────────────────────────────────────────────
// AudioContext must be resumed from a user gesture. Fire once on first touch.

function onFirstInteraction(): void {
  initAudio();
  document.removeEventListener('pointerdown', onFirstInteraction);
}
document.addEventListener('pointerdown', onFirstInteraction);

// ─── Input wiring ─────────────────────────────────────────────────────────────

const inputState = initInput(canvas, gridToPixel, gameState, (from, to) => {
  // Capture layer count before the move to drive audio decisions.
  const key = makeConnectionKey(from, to);
  const layersBefore = gameState.connections.get(key)?.layers ?? -1;

  processMove(gameState, from, to);

  const layersAfter = gameState.connections.get(key)?.layers ?? 0;
  const won = checkWin(gameState);

  if (won) {
    playPuzzleComplete();
  } else if (layersBefore <= 0) {
    playAccidentalDraw();
    triggerAccidentalDraw(key);
  } else if (layersAfter === 0) {
    playFinalErase();
    triggerErase(key, layersBefore);
  } else {
    playErase(layersBefore);
    triggerErase(key, layersBefore);
  }
  triggerDotActivation(to);
});

// ─── Overlay ──────────────────────────────────────────────────────────────────

initOverlay(gameState, {
  onUndo: () => {
    undo(gameState);
    playUndo();
  },
  onRedo: () => {
    redo(gameState);
  },
  onReset: resetGame,
  onNextLevel: nextLevel,
});

// ─── Render loop ──────────────────────────────────────────────────────────────

let prevLoopTime = 0;

function loop(time: number): void {
  const dt = prevLoopTime > 0 ? time - prevLoopTime : 0;
  prevLoopTime = time;

  render(ctx, gameState, canvas, inputState.rawPointer);
  animationManager.update(dt);
  animationManager.draw(ctx, gridToPixel);
  updateOverlay(gameState, currentLevelIndex, getLevelCount());
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
