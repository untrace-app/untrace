import { render } from './engine/renderer.ts';
import { animationManager, triggerErase, triggerAccidentalDraw, triggerDotActivation } from './engine/animations.ts';
import { initInput } from './engine/input.ts';
import { processMove, checkWin, makeConnectionKey, undo, redo } from './engine/logic.ts';
import { initAudio, playErase, playFinalErase, playAccidentalDraw, playPuzzleComplete, playUndo } from './audio/audio.ts';
import { initOverlay, updateOverlay } from './ui/overlay.ts';
import { initCelebration, showCelebration } from './ui/celebration.ts';
import { initLevelSelect, showLevelSelect, setCurrentLevel, completedLevel } from './ui/level-select.ts';
import { loadLevels, getCurrentLevel, getLevelCount } from './levels/levels.ts';
import type { GameState, ConnectionKey, ConnectionState } from './types.ts';
import { GRID_FILL_RATIO } from './constants.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const ctx = canvas.getContext('2d')!;
const boardBgEl = document.getElementById('board-bg')!;

function resizeBoardBg(): void {
  const iw   = window.innerWidth;
  const ih   = window.innerHeight;
  // Grid span + 40px padding on each side so outermost dots aren't clipped.
  const size = Math.min(iw, ih) * GRID_FILL_RATIO + 80;
  // Center matches the renderer's grid center (full-screen midpoint).
  const left = (iw - size) / 2;
  const top  = (ih - size) / 2;
  boardBgEl.style.width  = `${size}px`;
  boardBgEl.style.height = `${size}px`;
  boardBgEl.style.left   = `${left}px`;
  boardBgEl.style.top    = `${top}px`;
}

function resize(): void {
  const dpr = window.devicePixelRatio ?? 1;
  canvas.width  = Math.floor(window.innerWidth  * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width  = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.scale(dpr, dpr);
  resizeBoardBg();
}

resize();
window.addEventListener('resize', resize);

// Canvas stays invisible until the player selects a level from the level select.
// This prevents a flash of game content before the level select screen appears.
canvas.style.opacity    = '0';
canvas.style.transition = 'opacity 0.25s ease';

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

// ─── Save state ───────────────────────────────────────────────────────────────

interface SavedState {
  levelId:     string;
  connections: Array<[string, number]>; // [ConnectionKey, layers]
  playerDot:   [number, number] | null;
  moveCount:   number;
}

function _saveKey(levelId: string): string {
  return 'untrace-save-' + levelId;
}

function saveGameState(levelId: string): void {
  const data: SavedState = {
    levelId,
    connections: Array.from(gameState.connections, ([k, v]) => [k, v.layers] as [string, number]),
    playerDot:   gameState.playerDot,
    moveCount:   gameState.moveCount,
  };
  try { localStorage.setItem(_saveKey(levelId), JSON.stringify(data)); } catch { /* ignore */ }
}

function loadSave(levelId: string): SavedState | null {
  try {
    const raw = localStorage.getItem(_saveKey(levelId));
    return raw ? (JSON.parse(raw) as SavedState) : null;
  } catch { return null; }
}

function clearSave(levelId: string): void {
  localStorage.removeItem(_saveKey(levelId));
}

function applySave(save: SavedState): void {
  const connections = new Map<ConnectionKey, ConnectionState>();
  for (const [k, layers] of save.connections) {
    connections.set(k as ConnectionKey, { layers });
  }
  gameState.connections              = connections;
  gameState.playerDot                = save.playerDot;
  gameState.moveCount                = save.moveCount;
  gameState.isTracing                = false;
  gameState.undoStack                = [];
  gameState.redoStack                = [];
  gameState.currentStrokeConnections = new Set();
}

function showResumeDialog(levelId: string, save: SavedState): void {
  const ui = document.getElementById('ui')!;

  const backdrop = document.createElement('div');
  backdrop.style.cssText = [
    'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.65)',
    'display:flex', 'align-items:center', 'justify-content:center', 'z-index:15',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'background:rgba(18,18,30,0.97)', 'border-radius:16px',
    'padding:28px 24px 24px', 'max-width:280px', 'width:calc(100% - 48px)',
    'text-align:center', `font-family:${FONT}`, 'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
  ].join(';');

  const title = document.createElement('p');
  title.textContent = 'Resume where you left off?';
  title.style.cssText = 'color:#ffffff;font-size:16px;font-weight:500;margin:0 0 6px;line-height:1.4;';

  const sub = document.createElement('p');
  sub.textContent = `${save.moveCount} move${save.moveCount === 1 ? '' : 's'} in progress`;
  sub.style.cssText = 'color:rgba(255,255,255,0.45);font-size:13px;font-weight:400;margin:0 0 24px;line-height:1.4;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:12px;';

  const DIALOG_BTN = [
    'flex:1', 'padding:12px 0', 'border:none', 'border-radius:10px',
    'font-size:15px', 'font-weight:500', 'cursor:pointer',
    'touch-action:manipulation', '-webkit-tap-highlight-color:transparent',
  ].join(';');

  function dismiss(): void { backdrop.remove(); }

  const restartBtn = document.createElement('button');
  restartBtn.textContent = 'Restart';
  restartBtn.style.cssText = `${DIALOG_BTN};background:rgba(255,255,255,0.12);color:#ffffff;`;
  restartBtn.addEventListener('click', () => { clearSave(levelId); dismiss(); });

  const resumeBtn = document.createElement('button');
  resumeBtn.textContent = 'Resume';
  resumeBtn.style.cssText = `${DIALOG_BTN};background:#4ECDC4;color:#0A0A14;`;
  resumeBtn.addEventListener('click', () => { applySave(save); dismiss(); });

  btnRow.appendChild(restartBtn);
  btnRow.appendChild(resumeBtn);
  card.appendChild(title);
  card.appendChild(sub);
  card.appendChild(btnRow);
  backdrop.appendChild(card);
  ui.appendChild(backdrop);
}

// ─── Level loading ────────────────────────────────────────────────────────────

// Snapshot of initial connections for the current level (used by resetGame).
let initialConnections = new Map<ConnectionKey, ConnectionState>();

function loadLevel(index: number): void {
  currentLevelIndex = index % getLevelCount();
  setCurrentLevel(currentLevelIndex);
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

  // If gameplay is already active (canvas visible), check for a mid-level save.
  // Skips silently on the startup loadLevel(0) call when the canvas is still hidden.
  if (canvas.style.opacity === '1') {
    const save = loadSave(level.id);
    if (save) showResumeDialog(level.id, save);
  }
}

function resetGame(): void {
  clearSave(getCurrentLevel(currentLevelIndex).id);
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

// ─── Render loop ──────────────────────────────────────────────────────────────

// inputState is assigned inside the async startup below; loop() only runs after
// requestAnimationFrame is called, so it is always populated by the first frame.
let inputState!: ReturnType<typeof initInput>;
let prevLoopTime = 0;

function loop(time: number): void {
  const dt = prevLoopTime > 0 ? time - prevLoopTime : 0;
  prevLoopTime = time;

  render(ctx, gameState, canvas, inputState.rawPointer);
  animationManager.update(dt);
  animationManager.draw(ctx, gridToPixel, gameState);
  updateOverlay(gameState, currentLevelIndex, getLevelCount());
  requestAnimationFrame(loop);
}

// ─── Async startup ────────────────────────────────────────────────────────────
// Fetch level data before wiring input/overlay and starting the render loop.

(async () => {
  await loadLevels();

  // Initialise celebration screen (before overlay so it exists when onWin fires).
  initCelebration();

  // Initialise level-select before loadLevel so setCurrentLevel works immediately.
  initLevelSelect((index) => {
    // Reveal canvas, show board background, and start gameplay when a level is tapped.
    canvas.style.opacity      = '1';
    boardBgEl.style.display   = 'block';
    loadLevel(index);
  });

  loadLevel(0);
  showLevelSelect(); // Show level select on app start (board-bg stays hidden).

  // Dismiss the splash cover once the level-select transition has completed.
  // showLevelSelect() uses a double rAF + 0.22s CSS transition, so wait for
  // the same two frames then let the transition finish before hiding.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) splash.style.display = 'none';
      }, 220);
    });
  });

  inputState = initInput(canvas, gridToPixel, gameState, (from, to) => {
    // Capture layer count before the move to drive audio decisions.
    const key = makeConnectionKey(from, to);
    const layersBefore = gameState.connections.get(key)?.layers ?? -1;

    processMove(gameState, from, to);

    const layersAfter = gameState.connections.get(key)?.layers ?? 0;
    const won = checkWin(gameState);
    const levelId = getCurrentLevel(currentLevelIndex).id;

    // Persist progress after every non-winning move. Cleared in onWin.
    if (!won) saveGameState(levelId);

    if (won) {
      // Win sound and celebration card are both triggered after a 150ms delay
      // (see onWin callback below) so the final erase animation is visible first.
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

  initOverlay(gameState, {
    onUndo: () => {
      undo(gameState);
      playUndo();
    },
    onRedo: () => {
      redo(gameState);
    },
    onReset: resetGame,
    // onNextLevel is unused when onWin is provided, but required by the interface.
    onNextLevel: nextLevel,
    onLevelSelect: () => { boardBgEl.style.display = 'none'; showLevelSelect(); },
    onWin: (moveCount: number) => {
      const level    = getCurrentLevel(currentLevelIndex);
      clearSave(level.id);
      const minMoves = level.meta.minMoves;
      let stars = 1;
      if (minMoves !== null && minMoves > 0) {
        const twoStarThreshold = minMoves + Math.max(2, Math.floor(minMoves * 0.5));
        if (moveCount <= minMoves)             stars = 3;
        else if (moveCount <= twoStarThreshold) stars = 2;
      }
      const remainingLayers = Array.from(gameState.connections.values())
        .reduce((sum, c) => sum + c.layers, 0);
      completedLevel(currentLevelIndex, stars);
      setTimeout(() => {
        playPuzzleComplete();
        showCelebration({
          levelName:      level.name,
          levelNumber:    currentLevelIndex + 1,
          moveCount,
          minMoves,
          stars,
          remainingLayers,
          targetLayers:   level.targetLayers,
          onNextLevel:    () => { nextLevel();       },
          onReplay:       () => { resetGame();        },
          onLevelSelect:  () => { boardBgEl.style.display = 'none'; showLevelSelect(); },
        });
      }, 150);
    },
  });

  requestAnimationFrame(loop);
})();
