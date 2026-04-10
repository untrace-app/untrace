// Tutorial system — 5 guided intro levels on first launch

import type { GameState, ConnectionKey, ConnectionState } from '../types.ts';
import { processMove, checkWin, makeConnectionKey, undo, redo } from '../engine/logic.ts';
import { initInput } from '../engine/input.ts';
import { render } from '../engine/renderer.ts';
import { animationManager, triggerErase, triggerAccidentalDraw, triggerDotActivation } from '../engine/animations.ts';
import { startIntroAnimation, isIntroActive, updateIntro, renderIntro } from '../engine/intro-animation.ts';
import { playProgressNote, resetProgressAudio, playPuzzleComplete, playButtonTap, playUndo } from '../audio/audio.ts';
import { addPressFeedback } from './overlay.ts';
import { GRID_FILL_RATIO, FONT, FONT_HEADING, C_TEXT, C_TEXT_SEC, C_RECESSED } from '../constants.ts';

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_KEY    = 'tutorial-complete';
const C_SUCCESS = '#fb5607';

// ─── Tutorial level definitions ───────────────────────────────────────────────

interface TutorialLevel {
  grid: { cols: number; rows: number };
  connections: Array<{ from: [number, number]; to: [number, number]; layers: number }>;
  targetLayers: number;
  forcedStart: [number, number];
  hint: string;
  completionText: string;
  completionDelay: number; // ms to show completion text before advancing
  handPath: [number, number][] | null; // dot coords for hand animation, null = no hand
  handLift?: number; // index in handPath where hand "lifts" (for multi-stroke demo)
  handPauseAt?: number; // index where hand pauses (for lift-and-continue demo)
  handPauseDuration?: number; // ms to pause at handPauseAt
  reactiveHint?: string; // shown on first accidental draw instead of upfront hint
}

const TUTORIAL_LEVELS: TutorialLevel[] = [
  // Level 1: Single line, hand shows the swipe
  {
    grid: { cols: 3, rows: 3 },
    connections: [{ from: [0, 0], to: [1, 0], layers: 1 }],
    targetLayers: 0,
    forcedStart: [0, 0],
    hint: 'Swipe to erase the line',
    completionText: 'Nice!',
    completionDelay: 1000,
    handPath: [[0, 0], [1, 0]],
  },
  // Level 2: L-shape, continuous trace
  {
    grid: { cols: 3, rows: 3 },
    connections: [
      { from: [0, 0], to: [1, 0], layers: 1 },
      { from: [1, 0], to: [1, 1], layers: 1 },
    ],
    targetLayers: 0,
    forcedStart: [0, 0],
    hint: 'Keep your finger down to trace multiple lines',
    completionText: 'Keep going!',
    completionDelay: 1000,
    handPath: [[0, 0], [1, 0], [1, 1]],
  },
  // Level 3: Lift and continue — teaches finger-lift mechanic
  {
    grid: { cols: 3, rows: 3 },
    connections: [
      { from: [0, 0], to: [1, 0], layers: 1 },
      { from: [1, 0], to: [2, 0], layers: 1 },
    ],
    targetLayers: 0,
    forcedStart: [0, 0],
    hint: 'Lift and continue from your last dot',
    completionText: 'Got it!',
    completionDelay: 1000,
    handPath: [[0, 0], [1, 0], [2, 0]],
    handPauseAt: 1,
    handPauseDuration: 1000,
  },
  // Level 4: Accidental drawing discovery
  // L-shape + extension: natural rightward swipe from [1,0] hits empty [1,0]-[2,0].
  // Correct path turns down at [1,0]: [0,0]->[1,0]->[1,1]->[2,1].
  {
    grid: { cols: 3, rows: 3 },
    connections: [
      { from: [0, 0], to: [1, 0], layers: 1 },
      { from: [1, 0], to: [1, 1], layers: 1 },
      { from: [1, 1], to: [2, 1], layers: 1 },
    ],
    targetLayers: 0,
    forcedStart: [0, 0],
    hint: '',
    reactiveHint: 'Oops! Tracing empty spaces draws new lines',
    completionText: 'Watch your path!',
    completionDelay: 1000,
    handPath: null,
  },
  // Level 5: Real mini puzzle — no hints
  {
    grid: { cols: 3, rows: 3 },
    connections: [
      { from: [0, 0], to: [1, 0], layers: 1 },
      { from: [1, 0], to: [2, 0], layers: 1 },
      { from: [2, 0], to: [2, 1], layers: 1 },
      { from: [2, 1], to: [1, 1], layers: 1 },
      { from: [1, 1], to: [0, 1], layers: 1 },
    ],
    targetLayers: 0,
    forcedStart: [0, 0],
    hint: 'Solve it!',
    completionText: "You're ready!",
    completionDelay: 1500,
    handPath: null,
  },
];

// ─── State ────────────────────────────────────────────────────────────────────

let _resolve: (() => void) | null = null;
let _currentIndex = 0;
let _inputEnabled = false;
let _accidentalTipShown = false;
let _loopRunning = false;
let _prevTime = 0;
let _inputState: ReturnType<typeof initInput> | null = null;

// DOM elements
let _canvas: HTMLCanvasElement;
let _ctx: CanvasRenderingContext2D;
let _boardBgEl: HTMLElement;
let _completionEl: HTMLDivElement | null = null;
let _handEl: HTMLImageElement | null = null;
let _handAnimId: number | null = null;

// Tutorial bars (mirror overlay.ts layout)
let _topBarEl: HTMLDivElement | null = null;
let _bottomBarEl: HTMLDivElement | null = null;
let _stepLabelEl: HTMLElement | null = null;
let _tipEl: HTMLDivElement | null = null;
let _moveCounterEl: HTMLElement | null = null;
let _undoBtnEl: HTMLButtonElement | null = null;
let _redoBtnEl: HTMLButtonElement | null = null;

// Game state for the tutorial
const _state: GameState = {
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

// ─── Public API ───────────────────────────────────────────────────────────────

export function isTutorialComplete(): boolean {
  if (localStorage.getItem(LS_KEY) === 'true') return true;
  // Skip tutorial for returning players who already have level progress.
  const stars = localStorage.getItem('untrace_stars');
  if (stars) {
    try {
      const parsed = JSON.parse(stars) as Record<string, number>;
      if (Object.values(parsed).some((v) => v > 0)) return true;
    } catch { /* malformed — fall through */ }
  }
  return false;
}

/**
 * Run the full 5-level tutorial sequence.
 * Resolves when the tutorial is done.
 */
export async function startTutorial(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  boardBgEl: HTMLElement,
): Promise<void> {
  _canvas = canvas;
  _ctx = ctx;
  _boardBgEl = boardBgEl;
  _currentIndex = 0;

  // Show welcome popup before any game board is visible
  await _showWelcome();

  // Make canvas visible for tutorial
  canvas.style.opacity = '1';

  return new Promise((resolve) => {
    _resolve = resolve;
    _buildBars();
    _setupInput();
    _startLevel(0);
    if (!_loopRunning) {
      _loopRunning = true;
      _prevTime = 0;
      requestAnimationFrame(_loop);
    }
  });
}

// ─── Grid-to-pixel (mirrors main.ts) ─────────────────────────────────────────

function _gridToPixel(col: number, row: number): { x: number; y: number } {
  const cssW = _canvas.clientWidth;
  const cssH = _canvas.clientHeight;
  const smaller = Math.min(cssW, cssH);
  const gridSpan = smaller * GRID_FILL_RATIO;
  const { cols, rows } = _state.grid;
  const spacingX = cols > 1 ? gridSpan / (cols - 1) : 0;
  const spacingY = rows > 1 ? gridSpan / (rows - 1) : 0;
  const spacing = Math.min(spacingX, spacingY);
  const originX = (cssW - spacing * (cols - 1)) / 2;
  const originY = (cssH - spacing * (rows - 1)) / 2;
  return { x: originX + col * spacing, y: originY + row * spacing };
}

// ─── Input setup ──────────────────────────────────────────────────────────────

function _setupInput(): void {
  _inputState = initInput(_canvas, _gridToPixel, _state, (from, to) => {
    if (!_inputEnabled) return;

    // Remove hand on first player touch
    _removeHand();

    const key = makeConnectionKey(from, to);
    const layersBefore = _state.connections.get(key)?.layers ?? -1;

    processMove(_state, from, to);
    _state.playerDot = to;

    const won = checkWin(_state);

    if (won) {
      // handled after delay
    } else if (layersBefore <= 0) {
      playProgressNote(false);
      triggerAccidentalDraw(key);
      // Show reactive hint on first accidental draw (if level uses it)
      const lvl = TUTORIAL_LEVELS[_currentIndex];
      if (!_accidentalTipShown && lvl?.reactiveHint) {
        _accidentalTipShown = true;
        const parts = key.split('-');
        const [c1, r1] = parts[0]!.split(',').map(Number);
        const [c2, r2] = parts[1]!.split(',').map(Number);
        const p1 = _gridToPixel(c1!, r1!);
        const p2 = _gridToPixel(c2!, r2!);
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const canvasRect = _canvas.getBoundingClientRect();
        const screenY = canvasRect.top + midY;
        const showBelow = screenY < 100;
        const tipY = showBelow ? screenY + 30 : screenY - 65;
        const tipDiv = document.createElement('div');
        tipDiv.setAttribute('data-reactive-tip', '');
        tipDiv.textContent = lvl.reactiveHint;
        tipDiv.style.cssText = [
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
        document.getElementById('ui')!.appendChild(tipDiv);
        // Clamp horizontal position so tooltip stays on screen
        const tipW = tipDiv.offsetWidth;
        const pad = 12;
        const centerX = canvasRect.left + midX;
        let tipLeft = centerX - tipW / 2;
        if (tipLeft < pad) tipLeft = pad;
        if (tipLeft + tipW > window.innerWidth - pad) tipLeft = window.innerWidth - pad - tipW;
        tipDiv.style.left = `${tipLeft}px`;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { tipDiv.style.opacity = '1'; });
        });
        setTimeout(() => {
          tipDiv.style.opacity = '0';
          setTimeout(() => tipDiv.remove(), 300);
        }, 3000);
      }
    } else {
      playProgressNote(true);
      triggerErase(key, layersBefore);
    }
    triggerDotActivation(to);

    if (won) {
      _inputEnabled = false;
      const level = TUTORIAL_LEVELS[_currentIndex]!;
      setTimeout(() => {
        playPuzzleComplete();
        _showCompletion(level.completionText, () => {
          if (_currentIndex < TUTORIAL_LEVELS.length - 1) {
            _currentIndex++;
            _startLevel(_currentIndex);
          } else {
            // Tutorial complete
            localStorage.setItem(LS_KEY, 'true');
            _cleanup();
            _resolve?.();
          }
        }, level.completionDelay);
      }, 150);
    }
  }, true);
}

// ─── Level loading ────────────────────────────────────────────────────────────

function _startLevel(index: number): void {
  const level = TUTORIAL_LEVELS[index]!;

  // Build connections
  const connections = new Map<ConnectionKey, ConnectionState>();
  for (const c of level.connections) {
    const a = c.from;
    const b = c.to;
    const aFirst = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
    const [first, second] = aFirst ? [a, b] : [b, a];
    const key: ConnectionKey = `${first[0]},${first[1]}-${second[0]},${second[1]}`;
    connections.set(key, { layers: c.layers });
  }

  _state.grid = { ...level.grid };
  _state.connections = connections;
  // Pre-set playerDot and moveCount so input.ts enforces the forced start dot.
  // The player can only begin tracing from this dot; tapping elsewhere triggers
  // the red wrong-dot flash and is ignored.
  _state.playerDot = level.forcedStart;
  _state.isTracing = false;
  _state.moveCount = 1;
  _state.targetLayers = level.targetLayers;
  _state.undoStack = [];
  _state.redoStack = [];
  _state.currentStrokeConnections = new Set();

  resetProgressAudio();
  _removeCompletion();
  _removeHand();
  _accidentalTipShown = false;
  const oldReactiveTip = document.querySelector('[data-reactive-tip]');
  if (oldReactiveTip) oldReactiveTip.remove();

  // Update header and tip text
  if (_stepLabelEl) _stepLabelEl.textContent = `Step ${index + 1} of ${TUTORIAL_LEVELS.length}`;
  _updateTip(level.hint);
  _updateBars();

  // Run intro animation, then enable input + hand
  _inputEnabled = false;
  _canvas.style.pointerEvents = 'none';
  _boardBgEl.style.transition = 'none';
  _boardBgEl.style.opacity = '0';
  _boardBgEl.style.display = 'block';

  startIntroAnimation(_state, _boardBgEl).then(() => {
    _inputEnabled = true;
    _canvas.style.pointerEvents = '';
    if (level.handPath) {
      _startHand(level.handPath, level.handLift, level.handPauseAt, level.handPauseDuration);
    }
  });
}

// ─── Render loop ──────────────────────────────────────────────────────────────

function _loop(time: number): void {
  if (!_loopRunning) return;

  const dt = _prevTime > 0 ? time - _prevTime : 0;
  _prevTime = time;

  if (isIntroActive()) {
    updateIntro(dt);
    renderIntro(_ctx, _state, _canvas);
  } else {
    render(_ctx, _state, _canvas, _inputState?.rawPointer ?? null);
    animationManager.update(dt);
    animationManager.draw(_ctx, _gridToPixel, _state);
  }
  _updateBars();

  requestAnimationFrame(_loop);
}

// ─── SVG icons (same as overlay.ts) ──────────────────────────────────────────

const SVG_OPEN  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">';
const SVG_CLOSE = '</svg>';
const UNDO_ICON  = `${SVG_OPEN}<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5.5"/>${SVG_CLOSE}`;
const REDO_ICON  = `${SVG_OPEN}<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-5.5"/>${SVG_CLOSE}`;
const RESET_ICON = '<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor"><path d="M65.9 228.5c13.3-93 93.4-164.5 190.1-164.5 53 0 101 21.5 135.8 56.2 .2 .2 .4 .4 .6 .6l7.6 7.2-47.9 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l128 0c17.7 0 32-14.3 32-32l0-128c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 53.4-11.3-10.7C390.5 28.6 326.5 0 256 0 127 0 20.3 95.4 2.6 219.5 .1 237 12.2 253.2 29.7 255.7s33.7-9.7 36.2-27.1zm443.5 64c2.5-17.5-9.7-33.7-27.1-36.2s-33.7 9.7-36.2 27.1c-13.3 93-93.4 164.5-190.1 164.5-53 0-101-21.5-135.8-56.2-.2-.2-.4-.4-.6-.6l-7.6-7.2 47.9 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 320c-8.5 0-16.7 3.4-22.7 9.5S-.1 343.7 0 352.3l1 127c.1 17.7 14.6 31.9 32.3 31.7S65.2 496.4 65 478.7l-.4-51.5 10.7 10.1c46.3 46.1 110.2 74.7 180.7 74.7 129 0 235.7-95.4 253.4-219.5z"/></svg>';

const BTN_INLINE = [
  'width:40px', 'height:40px', 'flex-shrink:0',
  'display:flex', 'align-items:center', 'justify-content:center',
  `background:${C_RECESSED}`, 'border:none', 'border-radius:9999px',
  `color:${C_TEXT}`, 'cursor:pointer', 'padding:0',
  '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation', 'outline:none',
  'transition:transform 0.15s ease-out, filter 0.15s ease-out',
].join(';');

const LABEL_STYLE = [
  `color:${C_TEXT}`, 'font-size:14px', 'font-weight:600',
  'letter-spacing:0.02em', 'white-space:nowrap',
  'user-select:none', 'pointer-events:none',
  `font-family:${FONT_HEADING}`,
].join(';');

function _makeBtn(icon: string, label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.style.cssText = BTN_INLINE;
  btn.innerHTML = icon;
  btn.setAttribute('aria-label', label);
  addPressFeedback(btn);
  return btn;
}

// ─── Tutorial bars ───────────────────────────────────────────────────────────

function _buildBars(): void {
  _removeBars();
  const ui = document.getElementById('ui')!;

  // ── Top bar ─────────────────────────────────────────────────────────────
  _topBarEl = document.createElement('div');
  _topBarEl.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0',
    'padding-top:calc(env(safe-area-inset-top, 0px) + 12px)',
    'height:52px',
    'display:flex', 'align-items:center', 'justify-content:space-between',
    'padding-left:16px', 'padding-right:16px',
    'background:#ffedcd',
    'z-index:5',
    `font-family:${FONT}`,
    'box-sizing:content-box',
  ].join(';');

  // Left column — empty (no back button in tutorial).
  const leftCol = document.createElement('div');
  leftCol.style.cssText = 'flex:1;display:flex;align-items:center;';

  // Center column — "TUTORIAL" + "Step N of 5" (mirrors game's level indicator).
  const centerCol = document.createElement('div');
  centerCol.style.cssText = 'flex:0;display:flex;align-items:center;';

  const labelWrap = document.createElement('div');
  labelWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;';

  const titleEl = document.createElement('div');
  titleEl.textContent = 'TUTORIAL';
  titleEl.style.cssText = [
    `color:${C_TEXT}`, 'font-size:16px', 'font-weight:600',
    'letter-spacing:0.02em', 'white-space:nowrap',
    'user-select:none', 'pointer-events:none',
    `font-family:${FONT_HEADING}`,
  ].join(';');

  _stepLabelEl = document.createElement('div');
  _stepLabelEl.style.cssText = [
    `font-family:${FONT}`, 'font-size:12px', 'font-weight:400',
    `color:${C_TEXT_SEC}`, 'user-select:none', 'pointer-events:none',
    'white-space:nowrap', 'line-height:1',
  ].join(';');
  _stepLabelEl.textContent = `Step 1 of ${TUTORIAL_LEVELS.length}`;

  labelWrap.appendChild(titleEl);
  labelWrap.appendChild(_stepLabelEl);
  centerCol.appendChild(labelWrap);

  // Right column — reset button (instant, no dialog).
  const rightCol = document.createElement('div');
  rightCol.style.cssText = 'flex:1;display:flex;justify-content:flex-end;align-items:center;';

  const resetBtn = _makeBtn(RESET_ICON, 'Reset puzzle');
  resetBtn.addEventListener('click', () => {
    playButtonTap();
    _startLevel(_currentIndex);
  });
  rightCol.appendChild(resetBtn);

  _topBarEl.appendChild(leftCol);
  _topBarEl.appendChild(centerCol);
  _topBarEl.appendChild(rightCol);
  ui.appendChild(_topBarEl);

  // ── Bottom bar ──────────────────────────────────────────────────────────
  _bottomBarEl = document.createElement('div');
  _bottomBarEl.style.cssText = [
    'position:fixed', 'bottom:0', 'left:0', 'right:0',
    'padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 16px)',
    'height:48px',
    'display:flex', 'align-items:center', 'justify-content:space-between',
    'padding-left:24px', 'padding-right:24px',
    'background:#ffedcd',
    `font-family:${FONT}`,
    'box-sizing:content-box',
  ].join(';');

  _undoBtnEl = _makeBtn(UNDO_ICON, 'Undo');
  _undoBtnEl.addEventListener('click', () => {
    playButtonTap();
    undo(_state);
    playUndo();
  });

  _redoBtnEl = _makeBtn(REDO_ICON, 'Redo');
  _redoBtnEl.addEventListener('click', () => {
    playButtonTap();
    redo(_state);
    playUndo();
  });

  const bottomCenter = document.createElement('div');
  bottomCenter.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;';

  _moveCounterEl = document.createElement('div');
  _moveCounterEl.style.cssText = LABEL_STYLE;
  _moveCounterEl.textContent = 'Moves: 0';
  bottomCenter.appendChild(_moveCounterEl);

  _bottomBarEl.appendChild(_undoBtnEl);
  _bottomBarEl.appendChild(bottomCenter);
  _bottomBarEl.appendChild(_redoBtnEl);
  ui.appendChild(_bottomBarEl);

  // ── Floating tip (between header and board) ─────────────────────────────
  _tipEl = document.createElement('div');
  _tipEl.style.cssText = [
    'position:fixed',
    'left:50%',
    'transform:translateX(-50%)',
    'width:90%',
    'box-sizing:border-box',
    `font-family:${FONT}`,
    'font-size:18px', 'font-weight:600',
    `color:${C_TEXT}`,
    'text-align:center',
    'line-height:1.4',
    'user-select:none', 'pointer-events:none',
    'z-index:5',
    'opacity:0',
    'transition:opacity 0.3s ease',
  ].join(';');
  ui.appendChild(_tipEl);
}

function _removeBars(): void {
  if (_topBarEl) { _topBarEl.remove(); _topBarEl = null; }
  if (_bottomBarEl) { _bottomBarEl.remove(); _bottomBarEl = null; }
  if (_tipEl) { _tipEl.remove(); _tipEl = null; }
  _stepLabelEl = null;
  _moveCounterEl = null;
  _undoBtnEl = null;
  _redoBtnEl = null;
}

function _updateTip(text: string): void {
  if (!_tipEl || !_topBarEl) return;

  _tipEl.textContent = text;
  _tipEl.style.opacity = '0';

  // Compute position: midway between top bar bottom and board top.
  const topBarRect  = _topBarEl.getBoundingClientRect();
  const barBottom   = topBarRect.bottom;
  const ih          = window.innerHeight;
  const iw          = window.innerWidth;
  const boardSize   = Math.min(iw, ih) * GRID_FILL_RATIO + 80;
  const boardTop    = (ih - boardSize) / 2;
  const gap         = boardTop - barBottom;
  const centerY     = barBottom + gap / 2;

  // Use smaller font if gap is tight
  _tipEl.style.fontSize = gap < 60 ? '15px' : '18px';
  _tipEl.style.top = `${centerY}px`;
  _tipEl.style.transform = 'translate(-50%, -50%)';

  // Fade in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (_tipEl) _tipEl.style.opacity = '1';
    });
  });
}

function _updateBars(): void {
  // Move counter — subtract the initial 1 we set for forced-start enforcement.
  const displayMoves = Math.max(0, _state.moveCount - 1);
  if (_moveCounterEl) _moveCounterEl.textContent = `Moves: ${displayMoves}`;

  const solved = checkWin(_state);

  if (_undoBtnEl) {
    const canUndo = !solved && _state.undoStack.length > 0;
    _undoBtnEl.disabled      = !canUndo;
    _undoBtnEl.style.opacity = canUndo ? '1' : '0.3';
    _undoBtnEl.style.cursor  = canUndo ? 'pointer' : 'default';
  }

  if (_redoBtnEl) {
    const canRedo = !solved && _state.redoStack.length > 0;
    _redoBtnEl.disabled      = !canRedo;
    _redoBtnEl.style.opacity = canRedo ? '1' : '0.3';
    _redoBtnEl.style.cursor  = canRedo ? 'pointer' : 'default';
  }
}

// ─── Completion text ──────────────────────────────────────────────────────────

function _showCompletion(text: string, onDone: () => void, delay: number): void {
  _removeCompletion();

  _completionEl = document.createElement('div');
  _completionEl.style.cssText = [
    'position:fixed',
    'top:50%', 'left:50%',
    'transform:translate(-50%,-50%) scale(0.8)',
    'background:#feffe5',
    'border-radius:24px',
    'padding:10px 24px',
    'box-shadow:0 8px 32px rgba(46,47,44,0.08)',
    'text-align:center',
    'white-space:nowrap',
    'user-select:none', 'pointer-events:none',
    'z-index:200',
    'opacity:0',
    'transition:opacity 0.3s ease, transform 0.3s ease',
  ].join(';');

  const textEl = document.createElement('span');
  textEl.textContent = text;
  textEl.style.cssText = [
    `font-family:${FONT_HEADING}`,
    'font-size:17px', 'font-weight:700',
    `color:${C_SUCCESS}`,
  ].join(';');
  _completionEl.appendChild(textEl);

  document.getElementById('ui')!.appendChild(_completionEl);

  // Fade in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (_completionEl) {
        _completionEl.style.opacity = '1';
        _completionEl.style.transform = 'translate(-50%,-50%) scale(1)';
      }
    });
  });

  // Fade out then advance
  setTimeout(() => {
    if (_completionEl) {
      _completionEl.style.opacity = '0';
      _completionEl.style.transform = 'translate(-50%,-50%) scale(0.8)';
    }
    setTimeout(() => {
      _removeCompletion();
      onDone();
    }, 300);
  }, delay);
}

function _removeCompletion(): void {
  if (_completionEl) {
    _completionEl.remove();
    _completionEl = null;
  }
}

// ─── Hand animation ───────────────────────────────────────────────────────────

function _startHand(path: [number, number][], liftIndex?: number, pauseAt?: number, pauseDuration?: number): void {
  _removeHand();

  _handEl = document.createElement('img');
  _handEl.src = '/hand.svg';
  _handEl.style.cssText = [
    'position:fixed',
    'width:60px', 'height:auto',
    'pointer-events:none',
    'z-index:99',
    'opacity:0.7',
    'filter:drop-shadow(0 4px 8px rgba(0,0,0,0.35))',
    'transition:opacity 0.2s ease',
    'will-change:transform',
  ].join(';');
  document.getElementById('ui')!.appendChild(_handEl);

  // Build the full animation path
  let fullPath: [number, number][];
  if (pauseAt !== undefined) {
    // Pause variant: straight path, no reversal
    fullPath = [...path];
  } else if (liftIndex !== undefined && liftIndex < path.length) {
    // Forward path, then reversed path for second pass
    fullPath = [...path, ...path.slice().reverse()];
  } else {
    fullPath = [...path];
  }

  const MOVE_DURATION = 1500; // ms total for one pass
  const PAUSE_BETWEEN = 1000;
  let cancelled = false;

  // First touch on canvas removes the hand
  const removeOnTouch = () => {
    cancelled = true;
    _removeHand();
    _canvas.removeEventListener('pointerdown', removeOnTouch);
  };
  _canvas.addEventListener('pointerdown', removeOnTouch);

  // Pause timing
  const hasPause = pauseAt !== undefined && pauseDuration !== undefined && pauseDuration > 0;
  const totalSegments = fullPath.length - 1;
  const pauseRatio = hasPause ? pauseAt! / totalSegments : 0;
  const phase1Duration = hasPause ? MOVE_DURATION * pauseRatio : MOVE_DURATION;
  const phase2Duration = hasPause ? MOVE_DURATION * (1 - pauseRatio) : 0;
  const totalAnimDuration = hasPause ? phase1Duration + pauseDuration! + phase2Duration : MOVE_DURATION;

  function animateLoop(): void {
    if (cancelled || !_handEl) return;

    const startTime = performance.now();

    function frame(): void {
      if (cancelled || !_handEl) return;

      const elapsed = performance.now() - startTime;

      if (elapsed >= totalAnimDuration) {
        const last = fullPath[fullPath.length - 1]!;
        _positionHand(last[0], last[1]);
        if (_handEl) _handEl.style.opacity = '0.7';

        setTimeout(() => {
          if (!cancelled && _handEl) animateLoop();
        }, PAUSE_BETWEEN);
        return;
      }

      let pathProgress: number;

      if (hasPause) {
        if (elapsed < phase1Duration) {
          pathProgress = phase1Duration > 0 ? (elapsed / phase1Duration) * pauseRatio : pauseRatio;
          if (_handEl) _handEl.style.opacity = '0.7';
        } else if (elapsed < phase1Duration + pauseDuration!) {
          pathProgress = pauseRatio;
          if (_handEl) _handEl.style.opacity = '0.2';
        } else {
          const p2 = elapsed - phase1Duration - pauseDuration!;
          pathProgress = pauseRatio + (phase2Duration > 0 ? (p2 / phase2Duration) * (1 - pauseRatio) : (1 - pauseRatio));
          if (_handEl) _handEl.style.opacity = '0.7';
        }
      } else {
        pathProgress = elapsed / MOVE_DURATION;
      }

      const segIndex = Math.min(totalSegments - 1, Math.floor(pathProgress * totalSegments));
      const segProgress = (pathProgress * totalSegments) - segIndex;

      const t = segProgress < 0.5
        ? 2 * segProgress * segProgress
        : 1 - Math.pow(-2 * segProgress + 2, 2) / 2;

      const fromDot = fullPath[segIndex]!;
      const toDot = fullPath[segIndex + 1]!;
      const fromPx = _gridToPixel(fromDot[0], fromDot[1]);
      const toPx = _gridToPixel(toDot[0], toDot[1]);

      const x = fromPx.x + (toPx.x - fromPx.x) * t;
      const y = fromPx.y + (toPx.y - fromPx.y) * t;

      if (_handEl) {
        _handEl.style.transform = `translate(${x - 8}px, ${y - 6}px) rotate(-15deg)`;
      }

      // Existing lift animation (for non-pause variant)
      if (!hasPause && liftIndex !== undefined && segIndex === liftIndex - 1 && segProgress > 0.9 && _handEl) {
        _handEl.style.opacity = '0.4';
        setTimeout(() => {
          if (_handEl) _handEl.style.opacity = '0.7';
        }, 200);
      }

      _handAnimId = requestAnimationFrame(frame);
    }

    const firstDot = fullPath[0]!;
    _positionHand(firstDot[0], firstDot[1]);
    _handAnimId = requestAnimationFrame(frame);
  }

  animateLoop();
}

function _positionHand(col: number, row: number): void {
  if (!_handEl) return;
  const px = _gridToPixel(col, row);
  _handEl.style.transform = `translate(${px.x - 8}px, ${px.y - 6}px) rotate(-15deg)`;
}

function _removeHand(): void {
  if (_handAnimId !== null) {
    cancelAnimationFrame(_handAnimId);
    _handAnimId = null;
  }
  if (_handEl) {
    _handEl.style.opacity = '0';
    const el = _handEl;
    _handEl = null;
    setTimeout(() => el.remove(), 200);
  }
}

// ─── Welcome popup ────────────────────────────────────────────────────────────

function _showWelcome(): Promise<void> {
  return new Promise((resolve) => {
    const ui = document.getElementById('ui')!;

    const backdrop = document.createElement('div');
    backdrop.style.cssText = [
      'position:fixed', 'inset:0',
      'background:rgba(255,237,205,0.85)',
      'backdrop-filter:blur(20px)', '-webkit-backdrop-filter:blur(20px)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'z-index:200',
      'opacity:0',
      'transition:opacity 0.3s ease',
    ].join(';');

    const card = document.createElement('div');
    card.style.cssText = [
      'background:#feffe5', 'border-radius:24px',
      'padding:28px 24px 24px', 'max-width:280px', 'width:calc(100% - 48px)',
      'text-align:center',
      `font-family:${FONT}`,
      'box-shadow:0 8px 32px rgba(46,47,44,0.06)',
    ].join(';');

    const title = document.createElement('p');
    title.textContent = 'Welcome to Untrace';
    title.style.cssText = [
      `color:${C_TEXT}`, 'font-size:24px', 'font-weight:700',
      'margin:0 0 10px', 'line-height:1.3',
      `font-family:${FONT_HEADING}`,
    ].join(';');

    const sub = document.createElement('p');
    sub.textContent = "Learn the basics in a few quick puzzles. No pressure, just play!";
    sub.style.cssText = [
      `color:${C_TEXT_SEC}`, 'font-size:15px', 'font-weight:400',
      'margin:0 0 24px', 'line-height:1.5',
    ].join(';');

    const btn = document.createElement('button');
    btn.textContent = "Let's go";
    btn.style.cssText = [
      'width:100%', 'padding:14px 0', 'border:none', 'border-radius:9999px',
      'background:linear-gradient(135deg, #fb5607, #fb5607)', 'color:#ffffff',
      'font-size:16px', 'font-weight:600', 'cursor:pointer',
      `font-family:${FONT}`,
      'touch-action:manipulation', '-webkit-tap-highlight-color:transparent',
      'transition:transform 0.15s ease-out, filter 0.15s ease-out',
    ].join(';');
    addPressFeedback(btn);
    btn.addEventListener('click', () => {
      playButtonTap();
      backdrop.style.opacity = '0';
      setTimeout(() => { backdrop.remove(); resolve(); }, 300);
    });

    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(btn);
    backdrop.appendChild(card);
    ui.appendChild(backdrop);

    // Fade in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { backdrop.style.opacity = '1'; });
    });
  });
}

// ─── Suspension recovery ──────────────────────────────────────────────────────

/**
 * Recover tutorial state after page suspension.
 * Resets the time reference so the large dt from suspension doesn't cause
 * animation jumps, and restarts the hand animation if it was running.
 */
export function recoverTutorial(): void {
  if (!_loopRunning) return;
  // Reset so the first resumed frame treats dt as 0 (avoids giant animation jump).
  _prevTime = 0;
  // Restart hand animation if the element is still present but rAF chain died.
  if (_handEl !== null && _handAnimId === null) {
    const level = TUTORIAL_LEVELS[_currentIndex];
    if (level?.handPath && _inputEnabled) {
      _startHand(level.handPath, level.handLift);
    }
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

function _cleanup(): void {
  _loopRunning = false;
  _inputEnabled = false;
  _removeBars();
  _removeCompletion();
  _removeHand();
  const reactiveTip = document.querySelector('[data-reactive-tip]');
  if (reactiveTip) reactiveTip.remove();
  // Remove tutorial input listeners so main.ts can attach its own
  if (_inputState) {
    _inputState.destroy();
    _inputState = null;
  }
  // Hide canvas so level select can show clean
  _canvas.style.opacity = '0';
  _boardBgEl.style.display = 'none';
}
