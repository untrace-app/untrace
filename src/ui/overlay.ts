// In-game UI (undo, move counter, reset, win screen)

import type { GameState } from '../types.ts';
import { playUndo, playButtonTap } from '../audio/audio.ts';
import { checkWin } from '../engine/logic.ts';
import { getCurrentLevel, getDisplayNumber } from '../levels/levels.ts';
import { FONT, FONT_HEADING, C_TEXT, C_TEXT_SEC, C_RECESSED, GRAD_PRIMARY } from '../constants.ts';
import { getSparkCount } from '../sparks.ts';
import { showHintPopup } from './hint-popup.ts';

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
let hintBadgeEl:          HTMLElement | null = null;
let moveCounterEl:        HTMLElement | null = null;
let remainingIndicatorEl: HTMLElement | null = null;
let _reduceNumEl:         HTMLElement | null = null;
let levelIndicatorEl:     HTMLElement | null = null;
let levelNameEl:          HTMLElement | null = null;
let _topBarEl:            HTMLElement | null = null;
let _bottomBarEl:         HTMLElement | null = null;
// targetIndicatorEl removed — target value is now shown inline inside remainingIndicatorEl.
let _levelIndex = 0;
let _levelTotal = 1;

interface WinOverlay { show: (moveCount: number) => void; hide: () => void; }
let winOverlay: WinOverlay | null = null;
let prevSolved = false;

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
const RESET_ICON = '<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor"><path d="M65.9 228.5c13.3-93 93.4-164.5 190.1-164.5 53 0 101 21.5 135.8 56.2 .2 .2 .4 .4 .6 .6l7.6 7.2-47.9 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l128 0c17.7 0 32-14.3 32-32l0-128c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 53.4-11.3-10.7C390.5 28.6 326.5 0 256 0 127 0 20.3 95.4 2.6 219.5 .1 237 12.2 253.2 29.7 255.7s33.7-9.7 36.2-27.1zm443.5 64c2.5-17.5-9.7-33.7-27.1-36.2s-33.7 9.7-36.2 27.1c-13.3 93-93.4 164.5-190.1 164.5-53 0-101-21.5-135.8-56.2-.2-.2-.4-.4-.6-.6l-7.6-7.2 47.9 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 320c-8.5 0-16.7 3.4-22.7 9.5S-.1 343.7 0 352.3l1 127c.1 17.7 14.6 31.9 32.3 31.7S65.2 496.4 65 478.7l-.4-51.5 10.7 10.1c46.3 46.1 110.2 74.7 180.7 74.7 129 0 235.7-95.4 253.4-219.5z"/></svg>';
const LEVELS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">'
  + '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>'
  + '<rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'
  + '</svg>';

const LIGHTBULB_ICON = '<svg viewBox="0 0 384 512" width="22" height="22" fill="#b17025">'
  + '<path d="M272 384c9.6-31.9 29.5-59.1 49.2-86.2c0 0 0 0 0 0c5.2-7.1 10.4-14.2 15.4-21.4c19.8-28.5 31.4-63 31.4-100.3C368 78.8 289.2 0 192 0S16 78.8 16 176c0 37.3 11.6 71.9 31.4 100.3c5 7.2 10.2 14.3 15.4 21.4c0 0 0 0 0 0c19.8 27.1 39.7 54.4 49.2 86.2l160 0zM192 512c44.2 0 80-35.8 80-80l-160 0c0 44.2 35.8 80 80 80zM112 176c0 8.8-7.2 16-16 16s-16-7.2-16-16c0-61.9 50.1-112 112-112c8.8 0 16 7.2 16 16s-7.2 16-16 16c-44.2 0-80 35.8-80 80z"/>'
  + '</svg>';

// Inline button for use inside the top/bottom bar (no position:fixed).
const BTN_INLINE = [
  'width:40px',
  'height:40px',
  'flex-shrink:0',
  'display:flex',
  'align-items:center',
  'justify-content:center',
  `background:${C_RECESSED}`,
  'border:none',
  'border-radius:9999px',
  `color:${C_TEXT}`,
  'cursor:pointer',
  'padding:0',
  '-webkit-tap-highlight-color:transparent',
  'touch-action:manipulation',
  'outline:none',
  'transition:transform 0.15s ease-out, filter 0.15s ease-out',
].join(';');

// Shared dialog card style.
const CARD_STYLE = [
  'background:#feffe5',
  'border-radius:24px',
  'padding:28px 24px 24px',
  'max-width:280px',
  'width:calc(100% - 48px)',
  'text-align:center',
  `font-family:${FONT}`,
  'box-shadow:0 8px 32px rgba(46,47,44,0.06)',
].join(';');

// Shared dialog backdrop style (base; display set per-use).
const BACKDROP_STYLE_BASE = [
  'position:fixed', 'inset:0',
  'background:rgba(255,237,205,0.85)',
  'backdrop-filter:blur(20px)',
  '-webkit-backdrop-filter:blur(20px)',
  'align-items:center', 'justify-content:center',
].join(';');

// Shared dialog button base.
const DIALOG_BTN_BASE = [
  'flex:1', 'padding:13px 0', 'border:none', 'border-radius:9999px',
  'font-size:15px', 'font-weight:600', 'cursor:pointer',
  `font-family:${FONT}`,
  'touch-action:manipulation', '-webkit-tap-highlight-color:transparent',
  'transition:transform 0.15s ease-out, filter 0.15s ease-out',
].join(';');

/** Attach press feedback to any button: scale 0.92 + brightness on press. */
export function addPressFeedback(btn: HTMLElement): void {
  btn.addEventListener('pointerdown', () => {
    btn.style.transform = 'scale(0.92)';
    btn.style.filter    = 'brightness(1.1)';
  });
  btn.addEventListener('pointerup', () => {
    btn.style.transform = 'scale(1)';
    btn.style.filter    = 'brightness(1)';
  });
  btn.addEventListener('pointercancel', () => {
    btn.style.transform = 'scale(1)';
    btn.style.filter    = 'brightness(1)';
  });
  btn.addEventListener('pointerleave', () => {
    btn.style.transform = 'scale(1)';
    btn.style.filter    = 'brightness(1)';
  });
}

function makeInlineBtn(icon: string, label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.style.cssText = BTN_INLINE;
  btn.innerHTML = icon;
  btn.setAttribute('aria-label', label);
  addPressFeedback(btn);
  return btn;
}

// ─── Custom reset confirm dialog ──────────────────────────────────────────────

function buildResetDialog(ui: HTMLElement, onConfirm: () => void): () => void {
  const backdrop = document.createElement('div');
  backdrop.style.cssText = `${BACKDROP_STYLE_BASE};display:none;z-index:10;`;

  const card = document.createElement('div');
  card.style.cssText = CARD_STYLE;

  const text = document.createElement('p');
  text.textContent = 'Reset this puzzle?';
  text.style.cssText = `color:${C_TEXT};font-size:16px;font-weight:600;margin:0 0 24px;line-height:1.4;font-family:${FONT_HEADING};`;

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `${DIALOG_BTN_BASE};background:${C_RECESSED};color:${C_TEXT};`;

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Reset';
  confirmBtn.style.cssText = `${DIALOG_BTN_BASE};background:${GRAD_PRIMARY};color:#ffffff;font-size:16px;padding:14px 0;`;

  function hide(): void { backdrop.style.display = 'none'; }
  backdrop.addEventListener('click', hide);
  card.addEventListener('click', (e) => e.stopPropagation());
  cancelBtn.addEventListener('click', hide);
  confirmBtn.addEventListener('click', () => { hide(); onConfirm(); });
  addPressFeedback(cancelBtn);
  addPressFeedback(confirmBtn);

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  card.appendChild(text);
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
  backdrop.style.cssText = `${BACKDROP_STYLE_BASE};display:none;z-index:20;`;

  const card = document.createElement('div');
  card.style.cssText = [
    'background:#feffe5',
    'border-radius:24px',
    'padding:36px 28px 28px',
    'max-width:300px',
    'width:calc(100% - 48px)',
    'text-align:center',
    `font-family:${FONT}`,
    'box-shadow:0 8px 32px rgba(46,47,44,0.08)',
    'will-change:opacity,transform',
  ].join(';');

  const title = document.createElement('p');
  title.textContent = 'Solved!';
  title.style.cssText = [
    `color:${C_TEXT}`, 'font-size:34px', 'font-weight:700',
    'margin:0 0 8px', 'letter-spacing:-0.01em',
    `font-family:${FONT_HEADING}`,
  ].join(';');

  const movesEl = document.createElement('p');
  movesEl.style.cssText = [
    `color:${C_TEXT_SEC}`, 'font-size:15px',
    'font-weight:400', 'margin:0 0 28px',
  ].join(';');

  const WIN_BTN = [
    'width:100%', 'padding:14px 0', 'border:none', 'border-radius:9999px',
    'font-size:16px', 'font-weight:600', 'cursor:pointer',
    'touch-action:manipulation', '-webkit-tap-highlight-color:transparent',
    'display:block', 'box-sizing:border-box',
    `font-family:${FONT}`,
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  ].join(';');

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next Level';
  nextBtn.style.cssText = `${WIN_BTN};background:${GRAD_PRIMARY};color:#ffffff;margin-bottom:10px;`;

  const replayBtn = document.createElement('button');
  replayBtn.textContent = 'Replay';
  replayBtn.style.cssText = `${WIN_BTN};background:${C_RECESSED};color:${C_TEXT};font-size:15px;padding:13px 0;`;

  nextBtn.addEventListener('click',   () => { hide(); onNextLevel(); });
  replayBtn.addEventListener('click', () => { hide(); onReplay();    });
  addPressFeedback(nextBtn);
  addPressFeedback(replayBtn);

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

/** Show the in-game overlay bars (top + bottom). Call when gameplay begins. */
export function showOverlay(): void {
  if (_topBarEl)    _topBarEl.style.display    = 'flex';
  if (_bottomBarEl) _bottomBarEl.style.display = 'flex';
}

/** Hide the in-game overlay bars. Call when returning to level select or menu. */
export function hideOverlay(): void {
  if (_topBarEl)    _topBarEl.style.display    = 'none';
  if (_bottomBarEl) _bottomBarEl.style.display = 'none';
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
    'padding-top:calc(env(safe-area-inset-top, 0px) + 12px)',
    'height:52px',
    'display:none', 'align-items:center', 'justify-content:space-between',
    'padding-left:16px', 'padding-right:16px',
    'background:#ffedcd',
    'z-index:5',
    `font-family:${FONT}`,
    'box-sizing:content-box',
  ].join(';');
  _topBarEl = topBar;

  const LABEL_STYLE = [
    `color:${C_TEXT}`, 'font-size:14px', 'font-weight:600',
    'letter-spacing:0.02em', 'white-space:nowrap',
    'user-select:none', 'pointer-events:none',
    `font-family:${FONT_HEADING}`,
  ].join(';');

  // Left column — back button only.
  const leftCol = document.createElement('div');
  leftCol.style.cssText = 'flex:1;display:flex;align-items:center;';

  const backBtn = makeInlineBtn(LEVELS_ICON, 'Level select');
  backBtn.addEventListener('click', () => {
    playButtonTap();
    _onLevelSelect?.();
  });
  leftCol.appendChild(backBtn);

  // Center column — level name only (single row, no stacking).
  const centerCol = document.createElement('div');
  centerCol.style.cssText = 'flex:0;display:flex;align-items:center;';

  const levelLabelWrap = document.createElement('div');
  levelLabelWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;';

  levelIndicatorEl = document.createElement('div');
  levelIndicatorEl.style.cssText = `${LABEL_STYLE}`;
  levelIndicatorEl.textContent = '';

  levelNameEl = document.createElement('div');
  levelNameEl.style.cssText = [
    `font-family:${FONT}`, 'font-size:12px', 'font-weight:400',
    `color:${C_TEXT_SEC}`, 'user-select:none', 'pointer-events:none',
    'white-space:nowrap', 'line-height:1',
  ].join(';');

  levelLabelWrap.appendChild(levelIndicatorEl);
  levelLabelWrap.appendChild(levelNameEl);
  centerCol.appendChild(levelLabelWrap);

  // Right column — hint + reset buttons, right-aligned inside its flex:1 container.
  const rightCol = document.createElement('div');
  rightCol.style.cssText = 'flex:1;display:flex;justify-content:flex-end;align-items:center;gap:8px;';

  // Hint (lightbulb) button — wrapped so we can position a badge over it.
  const hintWrap = document.createElement('div');
  hintWrap.style.cssText = 'position:relative;display:flex;align-items:center;';
  const hintBtn = makeInlineBtn(LIGHTBULB_ICON, 'Hints');
  hintBtn.addEventListener('click', () => {
    playButtonTap();
    const level = getCurrentLevel(_levelIndex);
    if (level) showHintPopup(level);
  });
  hintBadgeEl = document.createElement('div');
  hintBadgeEl.style.cssText = [
    'position:absolute', 'top:-4px', 'right:-4px',
    'min-width:18px', 'height:18px', 'box-sizing:border-box',
    'padding:0 5px', 'border-radius:9px',
    'background:#3a86ff', 'color:#ffffff',
    `font-family:${FONT}`, 'font-size:10px', 'font-weight:700',
    'display:flex', 'align-items:center', 'justify-content:center',
    'pointer-events:none', 'line-height:1',
  ].join(';');
  hintBadgeEl.textContent = String(getSparkCount());
  hintWrap.appendChild(hintBtn);
  hintWrap.appendChild(hintBadgeEl);

  const showResetDialog = buildResetDialog(ui, callbacks.onReset);
  const resetBtn = makeInlineBtn(RESET_ICON, 'Reset puzzle');
  resetBtn.addEventListener('click', () => { playButtonTap(); showResetDialog(); });
  rightCol.appendChild(hintWrap);
  rightCol.appendChild(resetBtn);

  topBar.appendChild(leftCol);
  topBar.appendChild(centerCol);
  topBar.appendChild(rightCol);
  ui.appendChild(topBar);

  // ── Bottom bar: undo | move counter (+ reduce indicator) | redo ──────────
  const bottomBar = document.createElement('div');
  bottomBar.style.cssText = [
    'position:fixed', 'bottom:0', 'left:0', 'right:0',
    'padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 16px)',
    'height:48px',
    'display:none', 'align-items:center', 'justify-content:space-between',
    'padding-left:24px', 'padding-right:24px',
    'background:#ffedcd',
    `font-family:${FONT}`,
    'box-sizing:content-box',
  ].join(';');
  _bottomBarEl = bottomBar;

  undoBtnEl = makeInlineBtn(UNDO_ICON, 'Undo');
  undoBtnEl.addEventListener('click', () => { playButtonTap(); callbacks.onUndo(); });

  redoBtnEl = makeInlineBtn(REDO_ICON, 'Redo');
  redoBtnEl.addEventListener('click', () => { playButtonTap(); callbacks.onRedo(); playUndo(); });

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
    `color:${C_TEXT_SEC}`, 'transition:color 0.15s ease',
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

  if (levelIndicatorEl !== null) {
    levelIndicatorEl.textContent = `Level ${getDisplayNumber(levelIndex)}`;
  }

  if (levelNameEl !== null) {
    const name = getCurrentLevel(levelIndex)?.name ?? '';
    levelNameEl.textContent = name || '';
    levelNameEl.style.display = name ? 'block' : 'none';
  }

  if (moveCounterEl !== null) {
    moveCounterEl.textContent = `Moves: ${state.moveCount}`;
  }

  if (hintBadgeEl !== null) {
    hintBadgeEl.textContent = String(getSparkCount());
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
        remainingIndicatorEl.style.color      = '#fb5607';
        setTimeout(() => {
          if (remainingIndicatorEl) {
            remainingIndicatorEl.style.transition = 'color 0.5s ease';
            remainingIndicatorEl.style.color      = goalMet
              ? '#fb5607'
              : C_TEXT_SEC;
          }
        }, 400);
      } else if (!goalMet) {
        remainingIndicatorEl.style.transition = 'color 0.3s ease';
        remainingIndicatorEl.style.color      = C_TEXT_SEC;
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
