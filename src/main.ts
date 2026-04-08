import { render } from './engine/renderer.ts';
import { animationManager, triggerErase, triggerAccidentalDraw, triggerDotActivation } from './engine/animations.ts';
import { startIntroAnimation, isIntroActive, updateIntro, renderIntro, recoverIntroAnimation } from './engine/intro-animation.ts';
import { initInput } from './engine/input.ts';
import { processMove, checkWin, makeConnectionKey, undo, redo } from './engine/logic.ts';
import { initAudio, playProgressNote, resetProgressAudio, playPuzzleComplete, playUndo, playBgMusic, stopBgMusic, resumeAudioContext } from './audio/audio.ts';
import { initOverlay, updateOverlay, showOverlay, hideOverlay } from './ui/overlay.ts';
import { initCelebration, showCelebration, hideCelebration, recoverCelebration } from './ui/celebration.ts';
import { initLevelSelect, showLevelSelect, setCurrentLevel, completedLevel } from './ui/level-select.ts';
import { loadLevels, getCurrentLevel, getLevelCount } from './levels/levels.ts';
import { showLevelTransition, recoverLevelTransition } from './ui/level-transition.ts';
import { isTutorialComplete, startTutorial, recoverTutorial } from './ui/tutorial.ts';
import type { GameState, ConnectionKey, ConnectionState } from './types.ts';
import { GRID_FILL_RATIO, FONT, FONT_HEADING, C_TEXT, C_TEXT_SEC, C_RECESSED, GRAD_PRIMARY } from './constants.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const ctx = canvas.getContext('2d')!;
const boardBgEl = document.getElementById('board-bg')!;

// ─── Landscape overlay ────────────────────────────────────────────────────────

const landscapeOverlay = document.createElement('div');
landscapeOverlay.style.cssText = [
  'position:fixed', 'inset:0', 'z-index:999999',
  'background:#ffedcd',
  'display:none',
  'flex-direction:column', 'align-items:center', 'justify-content:center',
  'gap:8px',
].join(';');
const lsTitleEl = document.createElement('p');
lsTitleEl.textContent = 'Please rotate your device';
lsTitleEl.style.cssText = [
  "font-family:'Lexend',system-ui,sans-serif",
  'font-size:18px', 'font-weight:600', 'color:#b17025',
  'margin:0', 'text-align:center', 'padding:0 24px',
].join(';');
const lsSubEl = document.createElement('p');
lsSubEl.textContent = 'Untrace is best in portrait mode';
lsSubEl.style.cssText = [
  "font-family:'Lexend',system-ui,sans-serif",
  'font-size:14px', 'color:#7f7c6c',
  'margin:0', 'text-align:center', 'padding:0 24px',
].join(';');
landscapeOverlay.appendChild(lsTitleEl);
landscapeOverlay.appendChild(lsSubEl);
document.body.appendChild(landscapeOverlay);

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
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  resizeBoardBg();
}

function checkOrientation(): void {
  const isLandscape = typeof screen.orientation !== 'undefined'
    ? screen.orientation.type.startsWith('landscape')
    : window.innerWidth > window.innerHeight;
  landscapeOverlay.style.display = isLandscape ? 'flex' : 'none';
}

resize();
checkOrientation();

// Debounce canvas resize to at most once per 200ms; orientation check fires immediately.
let _resizeTimer = 0;
window.addEventListener('resize', () => {
  checkOrientation();
  clearTimeout(_resizeTimer);
  _resizeTimer = window.setTimeout(resize, 200);
});

// Fix 4: prevent pull-to-refresh / scroll bounce on the canvas only.
document.addEventListener('touchmove', (e: TouchEvent) => {
  if (e.target === canvas) e.preventDefault();
}, { passive: false });

// Baseline schema version for future data migrations. Seeded once, never
// downgraded here — migrations will bump this key as they run.
if (localStorage.getItem('save-version') === null) {
  localStorage.setItem('save-version', '1');
}

// Canvas stays invisible until the player selects a level from the level select.
// This prevents a flash of game content before the level select screen appears.
canvas.style.opacity    = '0';
canvas.style.transition = 'opacity 0.25s ease';

// ─── Input gating (disabled during intro/transition) ─────────────────────────

let inputEnabled      = false;
let transitionActive  = false; // true while level-transition splash is covering the screen

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

const levelIndicatorEl = document.createElement('div');
levelIndicatorEl.style.cssText = [
  'position:fixed', 'top:20px', 'left:20px',
  `background:${C_RECESSED}`, 'border-radius:12px', 'padding:8px 18px',
  `color:${C_TEXT}`, `font-family:${FONT}`, 'font-size:14px', 'font-weight:500',
  'letter-spacing:0.04em', 'white-space:nowrap', 'user-select:none', 'pointer-events:none',
  'display:none',
].join(';');
document.getElementById('ui')!.appendChild(levelIndicatorEl);

function updateLevelIndicator(): void {
  const total = getLevelCount();
  const level = getCurrentLevel(currentLevelIndex);
  levelIndicatorEl.textContent = `Level ${currentLevelIndex + 1}/${total} — ${level.name}`;
}

// ─── Save state ───────────────────────────────────────────────────────────────

interface SavedState {
  version:     number;
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
    version:     1,
    levelId,
    connections: Array.from(gameState.connections, ([k, v]) => [k, v.layers] as [string, number]),
    playerDot:   gameState.playerDot,
    moveCount:   gameState.moveCount,
  };
  try { localStorage.setItem(_saveKey(levelId), JSON.stringify(data)); } catch { /* ignore */ }
}

const CURRENT_SAVE_VERSION = 1;

function loadSave(levelId: string): SavedState | null {
  try {
    const raw = localStorage.getItem(_saveKey(levelId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState;
    // version missing (legacy) or older version: still load but could migrate here.
    if ((parsed.version ?? 0) < CURRENT_SAVE_VERSION) {
      parsed.version = CURRENT_SAVE_VERSION;
    }
    return parsed;
  } catch { return null; }
}

function clearSave(levelId: string, _reason: string): void {
  localStorage.removeItem(_saveKey(levelId));
}

function clearOtherSaves(keepLevelId: string): void {
  const keepKey = _saveKey(keepLevelId);
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('untrace-save-') && key !== keepKey) toRemove.push(key);
  }
  for (const key of toRemove) {
    localStorage.removeItem(key);
  }
}

// ─── Emergency save on page suspension ───────────────────────────────────────
// visibilitychange fires most reliably on mobile before the browser kills the
// page (screen lock, app switch). pagehide covers Safari's BFCache eviction.
// beforeunload is a desktop fallback. All three call the same function.

function saveOnSuspend(): void {
  if (canvas.style.opacity !== '1') return; // not in a level (level select / startup)
  if (gameState.moveCount === 0) return;    // no moves yet — nothing worth saving
  if (checkWin(gameState)) return;          // level already won — save was cleared in onWin
  saveGameState(getCurrentLevel(currentLevelIndex).id);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { saveOnSuspend(); stopBgMusic(); }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  // (f) Resume audio context — browsers suspend it on page hide.
  resumeAudioContext();
  playBgMusic();
  // (a) Restart render loop: cancel the stale pending rAF and schedule fresh,
  //     resetting prevLoopTime so the first resumed frame has dt = 0.
  cancelAnimationFrame(_rafId);
  prevLoopTime = 0;
  _rafId = requestAnimationFrame(loop);
  // (c) Skip intro animation if it was mid-play.
  recoverIntroAnimation();
  // (d) Skip level-transition splash if it was mid-play.
  recoverLevelTransition();
  // (b) Re-sync celebration card to fully-visible state.
  recoverCelebration();
  // (e) Reset tutorial time reference and restart hand animation.
  recoverTutorial();
});
window.addEventListener('pagehide', saveOnSuspend);
window.addEventListener('beforeunload', saveOnSuspend);

function applySave(save: SavedState): void {
  const connections = new Map<ConnectionKey, ConnectionState>();
  for (const [k, layers] of save.connections) {
    connections.set(k as ConnectionKey, { layers });
  }
  gameState.connections              = connections;
  gameState.playerDot                = save.playerDot ?? null;
  gameState.moveCount                = save.moveCount;
  gameState.targetLayers             = getCurrentLevel(currentLevelIndex).targetLayers;
  gameState.isTracing                = false;
  gameState.undoStack                = [];
  gameState.redoStack                = [];
  gameState.currentStrokeConnections = new Set();
}

function showResumeDialog(levelId: string, save: SavedState): void {
  const ui = document.getElementById('ui')!;

  const BACKDROP_STYLE = [
    'position:fixed', 'inset:0',
    'background:rgba(255,237,205,0.85)',
    'backdrop-filter:blur(20px)', '-webkit-backdrop-filter:blur(20px)',
    'align-items:center', 'justify-content:center',
    'display:flex', 'z-index:15',
  ].join(';');

  const CARD_STYLE = [
    'background:#feffe5', 'border-radius:24px',
    'padding:28px 24px 24px', 'max-width:280px', 'width:calc(100% - 48px)',
    'text-align:center', `font-family:${FONT}`,
    'box-shadow:0 8px 32px rgba(46,47,44,0.06)',
  ].join(';');

  const DIALOG_BTN = [
    'flex:1', 'padding:13px 0', 'border:none', 'border-radius:9999px',
    'font-size:15px', 'font-weight:600', 'cursor:pointer',
    `font-family:${FONT}`,
    'touch-action:manipulation', '-webkit-tap-highlight-color:transparent',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  ].join(';');

  const backdrop = document.createElement('div');
  backdrop.style.cssText = BACKDROP_STYLE;

  const card = document.createElement('div');
  card.style.cssText = CARD_STYLE;

  const title = document.createElement('p');
  title.textContent = 'Resume where you left off?';
  title.style.cssText = `color:${C_TEXT};font-size:16px;font-weight:600;margin:0 0 6px;line-height:1.4;font-family:${FONT_HEADING};`;

  const sub = document.createElement('p');
  sub.textContent = `${save.moveCount} move${save.moveCount === 1 ? '' : 's'} in progress`;
  sub.style.cssText = `color:${C_TEXT_SEC};font-size:13px;font-weight:400;margin:0 0 24px;line-height:1.4;`;

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;';

  function dismiss(): void { backdrop.remove(); }

  function addPressFeedback(btn: HTMLElement): void {
    btn.addEventListener('pointerdown', () => { btn.style.transform = 'scale(0.92)'; btn.style.filter = 'brightness(1.1)'; });
    btn.addEventListener('pointerup', () => { btn.style.transform = 'scale(1)'; btn.style.filter = 'brightness(1)'; });
    btn.addEventListener('pointercancel', () => { btn.style.transform = 'scale(1)'; btn.style.filter = 'brightness(1)'; });
    btn.addEventListener('pointerleave', () => { btn.style.transform = 'scale(1)'; btn.style.filter = 'brightness(1)'; });
  }

  const restartBtn = document.createElement('button');
  restartBtn.textContent = 'Restart';
  restartBtn.style.cssText = `${DIALOG_BTN};background:${C_RECESSED};color:${C_TEXT};`;
  restartBtn.addEventListener('click', () => { clearSave(levelId, 'restart'); dismiss(); resetGame(); });
  addPressFeedback(restartBtn);

  const resumeBtn = document.createElement('button');
  resumeBtn.textContent = 'Resume';
  resumeBtn.style.cssText = `${DIALOG_BTN};background:${GRAD_PRIMARY};color:#ffffff;`;
  resumeBtn.addEventListener('click', () => { dismiss(); });
  addPressFeedback(resumeBtn);

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
let initialConnections    = new Map<ConnectionKey, ConnectionState>();

function loadLevel(index: number, skipIntro = false): void {
  boardBgEl.style.display = 'none';
  currentLevelIndex = index % getLevelCount();
  setCurrentLevel(currentLevelIndex);
  const level = getCurrentLevel(currentLevelIndex);
  // Only evict other saves when the player actively selects a level (canvas visible).
  // Skip on startup (canvas still hidden) so saves for all levels survive page reload.
  if (canvas.style.opacity === '1') clearOtherSaves(level.id);

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

  // Save snapshot for reset and compute starting total for audio progress mapping.
  initialConnections = new Map<ConnectionKey, ConnectionState>(
    Array.from(connections, ([k, v]): [ConnectionKey, ConnectionState] => [k, { ...v }])
  );
  resetProgressAudio();

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

  // skipIntro: caller will start the intro animation separately (e.g. after transition splash).
  if (skipIntro) return;

  // If gameplay is already active (canvas visible), check for a mid-level save.
  // Skips silently on the startup loadLevel(0) call when the canvas is still hidden.
  if (canvas.style.opacity === '1') {
    const save = loadSave(level.id);
    if (save) {
      applySave(save);
      inputEnabled = true;
      boardBgEl.style.transition = 'none';
      boardBgEl.style.opacity    = '1';
      boardBgEl.style.display    = 'block';
      showResumeDialog(level.id, save);
    } else {
      runIntro();
    }
  }
}

function runIntro(): void {
  inputEnabled = false;
  canvas.style.pointerEvents = 'none';
  // Show board-bg but fully transparent — intro will fade it in.
  boardBgEl.style.transition = 'none';
  boardBgEl.style.opacity    = '0';
  boardBgEl.style.display    = 'block';
  startIntroAnimation(gameState, boardBgEl).then(() => {
    inputEnabled = true;
    canvas.style.pointerEvents = '';
  });
}

function resetGame(): void {
  clearSave(getCurrentLevel(currentLevelIndex).id, 'reset');
  gameState.connections = new Map<ConnectionKey, ConnectionState>(
    Array.from(initialConnections, ([k, v]): [ConnectionKey, ConnectionState] => [k, { ...v }])
  );
  gameState.playerDot               = null;
  gameState.isTracing               = false;
  gameState.moveCount               = 0;
  gameState.undoStack               = [];
  gameState.redoStack               = [];
  gameState.currentStrokeConnections = new Set();
  runIntro();
}

function nextLevel(): void {
  loadLevel((currentLevelIndex + 1) % getLevelCount());
}

function nextLevelWithTransition(): void {
  const nextIndex = (currentLevelIndex + 1) % getLevelCount();
  const next = getCurrentLevel(nextIndex);

  inputEnabled     = false;
  transitionActive = true;

  showLevelTransition(
    nextIndex + 1,
    next.name,
    // onCovered: splash is fully opaque — safe to tear down behind it.
    () => {
      hideCelebration();
      boardBgEl.style.display = 'none';
      // Load level data only (skipIntro=true). Intro starts after splash is gone.
      loadLevel(nextIndex, true);
    },
  ).then(() => {
    // Splash is fully gone (opacity 0, pointer-events none).
    transitionActive = false;
    runIntro();
  });
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

// ─── Render loop ──────────────────────────────────────────────────────────────

// inputState is assigned inside the async startup below; loop() only runs after
// requestAnimationFrame is called, so it is always populated by the first frame.
let inputState!: ReturnType<typeof initInput>;
let prevLoopTime = 0;
let _rafId       = 0;

function loop(time: number): void {
  const dt = prevLoopTime > 0 ? time - prevLoopTime : 0;
  prevLoopTime = time;

  if (transitionActive) {
    // Blank canvas while the transition splash covers the screen.
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  } else if (isIntroActive()) {
    updateIntro(dt);
    renderIntro(ctx, gameState, canvas);
  } else {
    render(ctx, gameState, canvas, inputState.rawPointer);
    animationManager.update(dt);
    animationManager.draw(ctx, gridToPixel, gameState);
  }
  updateOverlay(gameState, currentLevelIndex, getLevelCount());
  _rafId = requestAnimationFrame(loop);
}

// ─── Main menu ───────────────────────────────────────────────────────────────
// Shown after the splash fades out. Waits for a tap — which also unlocks the
// iOS AudioContext since it fires from a real user gesture.

function showMainMenu(splash: HTMLElement): Promise<void> {
  return new Promise<void>((resolve) => {
    // Combined scale + opacity pulse.
    const pulseStyle = document.createElement('style');
    pulseStyle.textContent = '@keyframes mm-pulse { from { transform:scale(1.0); opacity:0.85; } to { transform:scale(1.1); opacity:1.0; } }';
    document.head.appendChild(pulseStyle);

    // Container: same layout as splash (full-screen flex center, no column direction).
    // The logo is the only flex child so it lands at the exact same visual position.
    const menuEl = document.createElement('div');
    menuEl.style.cssText = [
      'position:fixed', 'inset:0',
      'background:#ffedcd',
      'z-index:9998',
      'display:flex', 'align-items:center', 'justify-content:center',
      'opacity:0',
      'transition:opacity 0.3s ease',
    ].join(';');

    // Clone the SVG logo from the live splash element, stripping svg-elem-N
    // animation classes so it renders fully drawn (not re-animated).
    const splashSvg = splash.querySelector('svg');
    if (splashSvg) {
      const logo = splashSvg.cloneNode(true) as SVGElement;
      logo.querySelectorAll<Element>('*').forEach(el => el.removeAttribute('class'));
      logo.removeAttribute('class');
      logo.style.cssText = 'max-width:80%;height:auto;display:block;';
      menuEl.appendChild(logo);
    }

    // Button wrapper — position:absolute keeps it out of the flex flow so the
    // logo stays at exact center. top:calc(50% + 52px) ≈ SVG half-height (20px)
    // + 32px gap, placing the button just below the logo on typical phone screens.
    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = [
      'position:absolute',
      'top:calc(50% + 52px)',
      'left:0', 'right:0',
      'display:flex', 'justify-content:center',
      'pointer-events:none',
    ].join(';');

    const btn = document.createElement('button');
    btn.textContent = 'Tap to Begin';
    btn.style.cssText = [
      "font-family:'Lexend',system-ui,sans-serif",
      'font-size:17px', 'font-weight:700',
      'color:#ffffff',
      'background:#fb5607',
      'border:none', 'border-radius:9999px',
      'padding:14px 44px',
      'cursor:pointer', 'outline:none',
      'box-shadow:0 4px 12px rgba(0,0,0,0.10)',
      'animation:mm-pulse 1.2s ease-in-out infinite alternate',
      '-webkit-tap-highlight-color:transparent',
      'touch-action:manipulation',
      'pointer-events:auto',
    ].join(';');
    btnWrap.appendChild(btn);
    menuEl.appendChild(btnWrap);
    document.body.appendChild(menuEl);

    function pressDown(): void {
      btn.style.animation = 'none';
      btn.style.transform = 'scale(0.92)';
      btn.style.opacity   = '1';
    }
    function pressUp(): void {
      btn.style.animation = 'mm-pulse 1.2s ease-in-out infinite alternate';
      btn.style.transform = '';
      btn.style.opacity   = '';
    }
    btn.addEventListener('pointerdown',   pressDown);
    btn.addEventListener('pointercancel', pressUp);
    btn.addEventListener('pointerleave',  pressUp);

    let dismissed = false;
    btn.addEventListener('pointerup', async () => {
      if (dismissed) return;
      dismissed = true;
      pressUp();
      await initAudio();
      playBgMusic();
      menuEl.style.opacity = '0';
      // Resolve immediately so the caller (showLevelSelect) starts rendering
      // underneath while the menu CSS transition is still playing.
      // DOM cleanup happens after the 0.3s fade completes.
      resolve();
      setTimeout(() => { menuEl.remove(); pulseStyle.remove(); }, 300);
    });

    // Fade in after double-rAF so the CSS transition fires.
    requestAnimationFrame(() => requestAnimationFrame(() => { menuEl.style.opacity = '1'; }));
  });
}

// ─── Async startup ────────────────────────────────────────────────────────────
// Fetch level data before wiring input/overlay and starting the render loop.

(async () => {
  // ── Splash screen ─────────────────────────────────────────────────────────
  const splash       = document.getElementById('splash')!;
  const splashLoader = document.getElementById('splash-loader')!;

  // SVG draw animation is handled by splash-animation.css.

  // Pulse animation for the loader dot.
  let loaderInterval: ReturnType<typeof setInterval> | null = null;
  function showLoader(): void {
    splashLoader.style.opacity = '1';
    loaderInterval = setInterval(() => {
      splashLoader.style.opacity = splashLoader.style.opacity === '1' ? '0.3' : '1';
    }, 600);
  }
  function hideLoader(): void {
    if (loaderInterval !== null) { clearInterval(loaderInterval); loaderInterval = null; }
    splashLoader.style.opacity = '0';
  }

  // Load assets in parallel with the minimum display time.
  const minTime     = new Promise<void>((r) => setTimeout(r, 2000));
  const assetsReady = Promise.all([loadLevels(), document.fonts.ready]);

  // Show loader if assets take longer than 2s.
  const loaderTimeout = setTimeout(showLoader, 2000);

  // Wait for BOTH minimum time AND assets — no tap-to-skip.
  await Promise.all([minTime, assetsReady]);
  clearTimeout(loaderTimeout);
  hideLoader();

  // ── Initialize game behind the splash ─────────────────────────────────────
  initCelebration();

  initLevelSelect((index) => {
    canvas.style.opacity    = '1';
    levelIndicatorEl.style.display = '';
    showOverlay();
    // Board-bg display is handled by runIntro / applySave — not set here.
    loadLevel(index);
  });

  // Fade out splash, then remove it.
  splash.style.transition = 'opacity 0.3s ease';
  splash.style.opacity    = '0';
  setTimeout(() => { splash.style.display = 'none'; }, 300);

  // Show main menu — blocks until the player taps "Tap to Begin".
  // The tap gesture is the first user interaction, which unlocks the iOS
  // AudioContext via the existing onFirstInteraction pointerdown listener.
  await showMainMenu(splash);

  // Show tutorial on first launch, otherwise go straight to level select.
  if (!isTutorialComplete()) {
    await startTutorial(canvas, ctx, boardBgEl);
  }
  showLevelSelect();

  inputState = initInput(canvas, gridToPixel, gameState, (from, to) => {
    if (!inputEnabled) return;
    // Capture layer count before the move to drive audio decisions.
    const key = makeConnectionKey(from, to);
    const layersBefore = gameState.connections.get(key)?.layers ?? -1;

    processMove(gameState, from, to);
    // playerDot is updated by input.ts AFTER onMove returns, so set it here
    // to ensure the save captures the destination dot, not the stale origin.
    gameState.playerDot = to;

    const won = checkWin(gameState);
    const levelId = getCurrentLevel(currentLevelIndex).id;

    // Persist progress after every non-winning move. Cleared in onWin.
    if (!won) saveGameState(levelId);

    if (won) {
      // Win sound and celebration card are both triggered after a 150ms delay
      // (see onWin callback below) so the final erase animation is visible first.
    } else if (layersBefore <= 0) {
      playProgressNote(false);
      triggerAccidentalDraw(key);
    } else {
      playProgressNote(true);
      triggerErase(key, layersBefore);
    }
    triggerDotActivation(to);
  });

  // Fix 2: end any active trace on phone call / notification / tab switch.
  window.addEventListener('blur', () => { inputState.cancelTrace(); });
  window.addEventListener('focus', () => { resumeAudioContext(); });

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
    onLevelSelect: () => { boardBgEl.style.display = 'none'; levelIndicatorEl.style.display = 'none'; hideOverlay(); showLevelSelect(); },
    onWin: (moveCount: number) => {
      const level    = getCurrentLevel(currentLevelIndex);
      clearSave(level.id, 'win');
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
          onNextLevel:    () => { nextLevelWithTransition(); },
          onReplay:       () => { resetGame();        },
          onLevelSelect:  () => { boardBgEl.style.display = 'none'; levelIndicatorEl.style.display = 'none'; hideOverlay(); showLevelSelect(); },
        });
      }, 150);
    },
  });

  _rafId = requestAnimationFrame(loop);
})();
