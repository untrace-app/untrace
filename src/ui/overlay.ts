// In-game UI (undo, move counter, reset, win screen)

import type { GameState } from '../types.ts';
import { playUndo } from '../audio/audio.ts';
import { checkWin } from '../engine/logic.ts';

export interface OverlayCallbacks {
  onUndo:        () => void;
  onRedo:        () => void;
  onReset:       () => void;
  onNextLevel:   () => void;
  /** Called when the player taps the level-select back button (after confirmation if needed). */
  onLevelSelect: () => void;
  /** If provided, the built-in "Solved!" win card is suppressed and this is called instead. */
  onWin?:        (moveCount: number) => void;
}

// ─── Module-level refs updated by updateOverlay ───────────────────────────────

let undoBtnEl:            HTMLButtonElement | null = null;
let redoBtnEl:            HTMLButtonElement | null = null;
let moveCounterEl:        HTMLElement | null = null;
let remainingIndicatorEl: HTMLElement | null = null;
let _reduceNumEl:         HTMLElement | null = null;
let levelIndicatorEl:     HTMLElement | null = null;
// targetIndicatorEl removed — target value is now shown inline inside remainingIndicatorEl.
let _levelIndex = 0;
let _levelTotal = 1;

interface WinOverlay { show: (moveCount: number) => void; hide: () => void; }
let winOverlay: WinOverlay | null = null;
let prevSolved = false;

// Cached for the level-select back button's confirmation check.
let _cachedMoveCount  = 0;
let _onLevelSelect:   (() => void) | null = null;
let _onWin:           ((moveCount: number) => void) | null = null;

// For the remaining-layers flash: track previous value to detect threshold crossing.
let _prevRemaining    = Infinity;
let _prevTargetLayers = -1;

// ─── SVG icons ────────────────────────────────────────────────────────────────

const SVG_OPEN  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">';
const SVG_CLOSE = '</svg>';

const UNDO_ICON  = `${SVG_OPEN}<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5.5"/>${SVG_CLOSE}`;
const REDO_ICON  = `${SVG_OPEN}<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-5.5"/>${SVG_CLOSE}`;
const RESET_ICON = `${SVG_OPEN}<polyline points="1 4 1 10 7 10"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>${SVG_CLOSE}`;
const LEVELS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">'
  + '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>'
  + '<rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'
  + '</svg>';

// ─── Style constants ──────────────────────────────────────────────────────────

const BG   = 'rgba(10,10,20,0.72)';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

const BTN_BASE = [
  'position:fixed',
  'width:44px',
  'height:44px',
  'display:flex',
  'align-items:center',
  'justify-content:center',
  `background:${BG}`,
  'border:none',
  'border-radius:12px',
  'color:#ffffff',
  'cursor:pointer',
  'padding:0',
  '-webkit-tap-highlight-color:transparent',
  'touch-action:manipulation',
  'outline:none',
  'transition:opacity 0.15s ease',
].join(';');

// Inline button for use inside the top bar (no position:fixed).
const BTN_INLINE = [
  'width:44px',
  'height:44px',
  'flex-shrink:0',
  'display:flex',
  'align-items:center',
  'justify-content:center',
  `background:${BG}`,
  'border:none',
  'border-radius:12px',
  'color:#ffffff',
  'cursor:pointer',
  'padding:0',
  '-webkit-tap-highlight-color:transparent',
  'touch-action:manipulation',
  'outline:none',
  'transition:opacity 0.15s ease',
].join(';');

// Larger inline button for the back/level-select button specifically.
const BTN_INLINE_BACK = [
  'width:48px',
  'height:48px',
  'flex-shrink:0',
  'display:flex',
  'align-items:center',
  'justify-content:center',
  'background:rgba(255,255,255,0.1)',
  'border:none',
  'border-radius:12px',
  'color:#ffffff',
  'cursor:pointer',
  'padding:0',
  '-webkit-tap-highlight-color:transparent',
  'touch-action:manipulation',
  'outline:none',
  'transition:opacity 0.15s ease',
].join(';');

function makeBtn(icon: string, label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.style.cssText = BTN_BASE;
  btn.innerHTML = icon;
  btn.setAttribute('aria-label', label);
  return btn;
}

function makeInlineBtn(icon: string, label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.style.cssText = BTN_INLINE;
  btn.innerHTML = icon;
  btn.setAttribute('aria-label', label);
  return btn;
}

// ─── Custom reset confirm dialog ──────────────────────────────────────────────

function buildResetDialog(ui: HTMLElement, onConfirm: () => void): () => void {
  const backdrop = document.createElement('div');
  backdrop.style.cssText = [
    'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.55)',
    'display:none', 'align-items:center', 'justify-content:center', 'z-index:10',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'background:rgba(18,18,30,0.97)', 'border-radius:16px',
    'padding:28px 24px 24px', 'max-width:280px', 'width:calc(100% - 48px)',
    'text-align:center', `font-family:${FONT}`, 'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
  ].join(';');

  const text = document.createElement('p');
  text.textContent = 'Reset this puzzle?';
  text.style.cssText = 'color:#ffffff;font-size:16px;font-weight:500;margin:0 0 24px;line-height:1.4;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:12px;';

  const DIALOG_BTN = [
    'flex:1', 'padding:12px 0', 'border:none', 'border-radius:10px',
    'font-size:15px', 'font-weight:500', 'cursor:pointer',
    'touch-action:manipulation', '-webkit-tap-highlight-color:transparent', 'color:#ffffff',
  ].join(';');

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `${DIALOG_BTN};background:rgba(255,255,255,0.12);`;

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Reset';
  confirmBtn.style.cssText = `${DIALOG_BTN};background:#ff6b6b;`;

  function hide(): void { backdrop.style.display = 'none'; }
  backdrop.addEventListener('click', hide);
  card.addEventListener('click', (e) => e.stopPropagation());
  cancelBtn.addEventListener('click', hide);
  confirmBtn.addEventListener('click', () => { hide(); onConfirm(); });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  card.appendChild(text);
  card.appendChild(btnRow);
  backdrop.appendChild(card);
  ui.appendChild(backdrop);

  return () => { backdrop.style.display = 'flex'; };
}

// ─── Leave level confirmation dialog ─────────────────────────────────────────

function buildLeaveDialog(ui: HTMLElement, onConfirm: () => void): () => void {
  const backdrop = document.createElement('div');
  backdrop.style.cssText = [
    'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.55)',
    'display:none', 'align-items:center', 'justify-content:center', 'z-index:12',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'background:rgba(18,18,30,0.97)', 'border-radius:16px',
    'padding:28px 24px 24px', 'max-width:280px', 'width:calc(100% - 48px)',
    'text-align:center', `font-family:${FONT}`, 'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
  ].join(';');

  const text = document.createElement('p');
  text.textContent = 'Return to level select?';
  text.style.cssText = 'color:#ffffff;font-size:16px;font-weight:500;margin:0 0 6px;line-height:1.4;';

  const sub = document.createElement('p');
  sub.textContent = 'Progress on this level will be lost.';
  sub.style.cssText = 'color:rgba(255,255,255,0.45);font-size:13px;font-weight:400;margin:0 0 24px;line-height:1.4;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:12px;';

  const DIALOG_BTN = [
    'flex:1', 'padding:12px 0', 'border:none', 'border-radius:10px',
    'font-size:15px', 'font-weight:500', 'cursor:pointer',
    'touch-action:manipulation', '-webkit-tap-highlight-color:transparent', 'color:#ffffff',
  ].join(';');

  const stayBtn = document.createElement('button');
  stayBtn.textContent = 'Stay';
  stayBtn.style.cssText = `${DIALOG_BTN};background:rgba(255,255,255,0.12);`;

  const leaveBtn = document.createElement('button');
  leaveBtn.textContent = 'Leave';
  leaveBtn.style.cssText = `${DIALOG_BTN};background:#ff6b6b;`;

  function hide(): void { backdrop.style.display = 'none'; }
  backdrop.addEventListener('click', hide);
  card.addEventListener('click', (e) => e.stopPropagation());
  stayBtn.addEventListener('click', hide);
  leaveBtn.addEventListener('click', () => { hide(); onConfirm(); });

  btnRow.appendChild(stayBtn);
  btnRow.appendChild(leaveBtn);
  card.appendChild(text);
  card.appendChild(sub);
  card.appendChild(btnRow);
  backdrop.appendChild(card);
  ui.appendChild(backdrop);

  return () => { backdrop.style.display = 'flex'; };
}

// ─── Win overlay ──────────────────────────────────────────────────────────────

function buildWinOverlay(
  ui: HTMLElement,
  onNextLevel: () => void,
  onReplay: () => void,
): WinOverlay {
  const backdrop = document.createElement('div');
  backdrop.style.cssText = [
    'position:fixed', 'inset:0',
    'display:none', 'align-items:center', 'justify-content:center',
    'z-index:20',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'background:rgba(18,18,30,0.97)',
    'border-radius:20px',
    'padding:36px 28px 28px',
    'max-width:300px',
    'width:calc(100% - 48px)',
    'text-align:center',
    `font-family:${FONT}`,
    'box-shadow:0 12px 48px rgba(0,0,0,0.75)',
    'will-change:opacity,transform',
  ].join(';');

  const title = document.createElement('p');
  title.textContent = 'Solved!';
  title.style.cssText = [
    'color:#ffffff', 'font-size:34px', 'font-weight:700',
    'margin:0 0 8px', 'letter-spacing:-0.01em',
  ].join(';');

  const movesEl = document.createElement('p');
  movesEl.style.cssText = [
    'color:rgba(255,255,255,0.5)', 'font-size:15px',
    'font-weight:400', 'margin:0 0 28px',
  ].join(';');

  const WIN_BTN = [
    'width:100%', 'padding:14px 0', 'border:none', 'border-radius:12px',
    'font-size:16px', 'font-weight:600', 'cursor:pointer',
    'touch-action:manipulation', '-webkit-tap-highlight-color:transparent',
    'color:#ffffff', 'display:block', 'box-sizing:border-box',
  ].join(';');

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next Level';
  nextBtn.style.cssText = `${WIN_BTN};background:#4ECDC4;margin-bottom:12px;`;

  const replayBtn = document.createElement('button');
  replayBtn.textContent = 'Replay';
  replayBtn.style.cssText = `${WIN_BTN};background:rgba(255,255,255,0.12);`;

  nextBtn.addEventListener('click',   () => { hide(); onNextLevel(); });
  replayBtn.addEventListener('click', () => { hide(); onReplay();    });

  card.appendChild(title);
  card.appendChild(movesEl);
  card.appendChild(nextBtn);
  card.appendChild(replayBtn);
  backdrop.appendChild(card);
  ui.appendChild(backdrop);

  function show(moveCount: number): void {
    movesEl.textContent = `Moves: ${moveCount}`;
    card.style.transition = 'none';
    card.style.opacity    = '0';
    card.style.transform  = 'scale(0.85)';
    backdrop.style.display = 'flex';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        card.style.opacity    = '1';
        card.style.transform  = 'scale(1)';
      });
    });
  }

  function hide(): void {
    backdrop.style.display = 'none';
  }

  return { show, hide };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Update the level indicator text. Call whenever the level changes. */
export function setLevelIndicator(text: string): void {
  if (levelIndicatorEl !== null) levelIndicatorEl.textContent = text;
}

export function initOverlay(state: GameState, callbacks: OverlayCallbacks): void {
  const ui = document.getElementById('ui')!;

  // Cache callbacks needed by updateOverlay and the back button.
  _onLevelSelect = callbacks.onLevelSelect;
  _onWin         = callbacks.onWin ?? null;

  // ── Top bar: true three-column flex row ─────────────────────────────────
  // Left (flex:1): back button + level indicator — grows to fill left half.
  // Center (flex:0): move counter — natural width, stays centered.
  // Right (flex:1, end-aligned): reset button — grows to fill right half.

  const topBar = document.createElement('div');
  topBar.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0',
    'height:60px',
    'display:flex', 'align-items:center', 'justify-content:space-between',
    'padding:0 16px',
    'background:#0A0A14',
    'z-index:5',
    `font-family:${FONT}`,
    'box-sizing:border-box',
  ].join(';');

  const LABEL_STYLE = [
    'color:#ffffff', 'font-size:14px', 'font-weight:500',
    'letter-spacing:0.04em', 'white-space:nowrap',
    'user-select:none', 'pointer-events:none',
  ].join(';');

  // Left column — back button only.
  const leftCol = document.createElement('div');
  leftCol.style.cssText = 'flex:1;display:flex;align-items:center;';

  const showLeaveDialog = buildLeaveDialog(ui, () => _onLevelSelect?.());
  const backBtn = document.createElement('button');
  backBtn.style.cssText = BTN_INLINE_BACK;
  backBtn.innerHTML = LEVELS_ICON;
  backBtn.setAttribute('aria-label', 'Level select');
  backBtn.addEventListener('click', () => {
    console.log('[overlay] back button pressed, moveCount =', _cachedMoveCount);
    if (_cachedMoveCount > 0) {
      showLeaveDialog();
    } else {
      _onLevelSelect?.();
    }
  });
  leftCol.appendChild(backBtn);

  // Center column — level name only (single row, no stacking).
  const centerCol = document.createElement('div');
  centerCol.style.cssText = 'flex:0;display:flex;align-items:center;';

  levelIndicatorEl = document.createElement('div');
  levelIndicatorEl.style.cssText = `${LABEL_STYLE}`;
  levelIndicatorEl.textContent = '';
  centerCol.appendChild(levelIndicatorEl);

  // Right column — reset button, right-aligned inside its flex:1 container.
  const rightCol = document.createElement('div');
  rightCol.style.cssText = 'flex:1;display:flex;justify-content:flex-end;align-items:center;';
  const showResetDialog = buildResetDialog(ui, callbacks.onReset);
  const resetBtn = makeInlineBtn(RESET_ICON, 'Reset puzzle');
  resetBtn.addEventListener('click', showResetDialog);
  rightCol.appendChild(resetBtn);

  topBar.appendChild(leftCol);
  topBar.appendChild(centerCol);
  topBar.appendChild(rightCol);
  ui.appendChild(topBar);

  // ── Bottom bar: undo | move counter (+ reduce indicator) | redo ──────────
  const bottomBar = document.createElement('div');
  bottomBar.style.cssText = [
    'position:fixed', 'bottom:0', 'left:0', 'right:0',
    'height:80px',
    'display:flex', 'align-items:center', 'justify-content:space-between',
    'padding:0 24px',
    `font-family:${FONT}`,
    'box-sizing:border-box',
  ].join(';');

  undoBtnEl = makeInlineBtn(UNDO_ICON, 'Undo');
  undoBtnEl.addEventListener('click', () => callbacks.onUndo());

  redoBtnEl = makeInlineBtn(REDO_ICON, 'Redo');
  redoBtnEl.addEventListener('click', () => { callbacks.onRedo(); playUndo(); });

  // Center cluster: moves counter is the in-flow anchor, always vertically centered.
  // The reduce indicator floats above it via absolute positioning — never shifts the row.
  const bottomCenter = document.createElement('div');
  bottomCenter.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;';

  moveCounterEl = document.createElement('div');
  moveCounterEl.style.cssText = `${LABEL_STYLE}`;

  // Reduce indicator: absolutely positioned above the moves counter, out of flow.
  remainingIndicatorEl = document.createElement('div');
  remainingIndicatorEl.style.cssText = [
    'position:absolute', 'bottom:calc(100% + 10px)', 'left:50%', 'transform:translateX(-50%)',
    'display:none', 'flex-direction:column', 'align-items:center', 'gap:1px',
    'color:rgba(255,255,255,0.55)', 'transition:color 0.15s ease',
    'white-space:nowrap',
  ].join(';');

  _reduceNumEl = document.createElement('div');
  _reduceNumEl.style.cssText = [
    'font-size:14px', 'font-weight:600', 'letter-spacing:0.04em',
    'user-select:none', 'pointer-events:none',
  ].join(';');

  const reduceLblEl = document.createElement('div');
  reduceLblEl.textContent = 'left / target';
  reduceLblEl.style.cssText = [
    'font-size:10px', 'font-weight:500', 'letter-spacing:0.06em',
    'opacity:0.5', 'user-select:none', 'pointer-events:none',
  ].join(';');

  remainingIndicatorEl.appendChild(_reduceNumEl);
  remainingIndicatorEl.appendChild(reduceLblEl);

  bottomCenter.appendChild(moveCounterEl);
  bottomCenter.appendChild(remainingIndicatorEl);

  bottomBar.appendChild(undoBtnEl);
  bottomBar.appendChild(bottomCenter);
  bottomBar.appendChild(redoBtnEl);
  ui.appendChild(bottomBar);

  // ── Win overlay (only when onWin is not provided) ────────────────────────
  winOverlay = _onWin ? null : buildWinOverlay(ui, callbacks.onNextLevel, callbacks.onReset);
  prevSolved = false;

  updateOverlay(state, _levelIndex, _levelTotal);
}

/** Call every frame to keep counter and button states current. */
export function updateOverlay(state: GameState, levelIndex: number, levelTotal: number): void {
  _levelIndex      = levelIndex;
  _levelTotal      = levelTotal;
  _cachedMoveCount = state.moveCount;

  if (levelIndicatorEl !== null) {
    levelIndicatorEl.textContent = `Level ${levelIndex + 1}`;
  }

  if (moveCounterEl !== null) {
    moveCounterEl.textContent = `Moves: ${state.moveCount}`;
  }

  const t = state.targetLayers;
  if (t > 0) {
    const remaining    = Array.from(state.connections.values()).reduce((sum, c) => sum + c.layers, 0);
    const goalMet      = remaining <= t;
    const levelChanged = t !== _prevTargetLayers;
    const justMet      = goalMet && _prevRemaining > t && !levelChanged;

    if (_reduceNumEl !== null) {
      _reduceNumEl.textContent = `${remaining} / ${t}`;
    }
    if (remainingIndicatorEl !== null) {
      remainingIndicatorEl.style.display = 'flex';
      if (justMet) {
        remainingIndicatorEl.style.transition = 'color 0.1s ease';
        remainingIndicatorEl.style.color      = '#4ECDC4';
        setTimeout(() => {
          if (remainingIndicatorEl) {
            remainingIndicatorEl.style.transition = 'color 0.5s ease';
            remainingIndicatorEl.style.color      = goalMet
              ? 'rgba(78,205,196,0.75)'
              : 'rgba(255,255,255,0.55)';
          }
        }, 400);
      } else if (!goalMet) {
        remainingIndicatorEl.style.transition = 'color 0.3s ease';
        remainingIndicatorEl.style.color      = 'rgba(255,255,255,0.55)';
      }
    }

    _prevRemaining    = levelChanged ? Infinity : remaining;
    _prevTargetLayers = t;
  } else {
    if (remainingIndicatorEl !== null) remainingIndicatorEl.style.display = 'none';
    _prevRemaining    = Infinity;
    _prevTargetLayers = 0;
  }

  const solved = checkWin(state);

  if (solved && !prevSolved) {
    if (_onWin !== null) {
      _onWin(state.moveCount);
    } else if (winOverlay !== null) {
      winOverlay.show(state.moveCount);
    }
  }
  if (!solved && prevSolved && winOverlay !== null) {
    winOverlay.hide();
  }
  prevSolved = solved;

  if (undoBtnEl !== null) {
    const canUndo = !solved && state.undoStack.length > 0;
    undoBtnEl.disabled      = !canUndo;
    undoBtnEl.style.opacity = canUndo ? '1' : '0.3';
    undoBtnEl.style.cursor  = canUndo ? 'pointer' : 'default';
  }

  if (redoBtnEl !== null) {
    const canRedo = !solved && state.redoStack.length > 0;
    redoBtnEl.disabled      = !canRedo;
    redoBtnEl.style.opacity = canRedo ? '1' : '0.3';
    redoBtnEl.style.cursor  = canRedo ? 'pointer' : 'default';
  }
}
