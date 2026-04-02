// In-game UI (undo, move counter, reset, win screen)

import type { GameState } from '../types.ts';
import { playUndo } from '../audio/audio.ts';
import { checkWin } from '../engine/logic.ts';

export interface OverlayCallbacks {
  onUndo:       () => void;
  onRedo:       () => void;
  onReset:      () => void;
  onNextLevel:  () => void;
}

// ─── Module-level refs updated by updateOverlay ───────────────────────────────

let undoBtnEl:         HTMLButtonElement | null = null;
let redoBtnEl:         HTMLButtonElement | null = null;
let moveCounterEl:     HTMLElement | null = null;
let targetIndicatorEl: HTMLElement | null = null;
let levelIndicatorEl:  HTMLElement | null = null;
let _levelIndex = 0;
let _levelTotal = 1;

interface WinOverlay { show: (moveCount: number) => void; hide: () => void; }
let winOverlay: WinOverlay | null = null;
let prevSolved = false;

// ─── SVG icons ────────────────────────────────────────────────────────────────

const SVG_OPEN  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">';
const SVG_CLOSE = '</svg>';

const UNDO_ICON  = `${SVG_OPEN}<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5.5"/>${SVG_CLOSE}`;
const REDO_ICON  = `${SVG_OPEN}<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-5.5"/>${SVG_CLOSE}`;
const RESET_ICON = `${SVG_OPEN}<polyline points="1 4 1 10 7 10"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>${SVG_CLOSE}`;

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

  // ── Top bar: true three-column flex row ─────────────────────────────────
  // Left (flex:1): level indicator — grows to fill left half.
  // Center (flex:0): move counter — natural width, stays centered.
  // Right (flex:1, end-aligned): reset button — grows to fill right half.
  // flex:1 on both sides means equal remaining space on each side of the
  // natural-width center item, achieving true centering at any screen width.
  // Fully opaque background covers any elements rendered behind it.

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

  // Left column — level indicator.
  levelIndicatorEl = document.createElement('div');
  levelIndicatorEl.style.cssText = `${LABEL_STYLE};flex:1;`;
  levelIndicatorEl.textContent = '';

  // Center column — move counter (top) + optional target indicator (below).
  const centerCol = document.createElement('div');
  centerCol.style.cssText = 'flex:0;display:flex;flex-direction:column;align-items:center;gap:2px;';

  moveCounterEl = document.createElement('div');
  moveCounterEl.style.cssText = `${LABEL_STYLE};flex:0;`;

  targetIndicatorEl = document.createElement('div');
  targetIndicatorEl.style.cssText = [
    'color:rgba(255,255,255,0.55)', 'font-size:11px', 'font-weight:500',
    'letter-spacing:0.04em', 'white-space:nowrap',
    'user-select:none', 'pointer-events:none', 'display:none',
  ].join(';');

  centerCol.appendChild(moveCounterEl);
  centerCol.appendChild(targetIndicatorEl);

  // Right column — reset button, right-aligned inside its flex:1 container.
  const rightCol = document.createElement('div');
  rightCol.style.cssText = 'flex:1;display:flex;justify-content:flex-end;align-items:center;';
  const showResetDialog = buildResetDialog(ui, callbacks.onReset);
  const resetBtn = makeInlineBtn(RESET_ICON, 'Reset puzzle');
  resetBtn.addEventListener('click', showResetDialog);
  rightCol.appendChild(resetBtn);

  topBar.appendChild(levelIndicatorEl);
  topBar.appendChild(centerCol);
  topBar.appendChild(rightCol);
  ui.appendChild(topBar);

  // ── Undo button (bottom-left) ────────────────────────────────────────────
  undoBtnEl = makeBtn(UNDO_ICON, 'Undo');
  undoBtnEl.style.bottom = '24px';
  undoBtnEl.style.left   = '24px';
  undoBtnEl.addEventListener('click', () => callbacks.onUndo());
  ui.appendChild(undoBtnEl);

  // ── Redo button (next to undo) ───────────────────────────────────────────
  redoBtnEl = makeBtn(REDO_ICON, 'Redo');
  redoBtnEl.style.bottom = '24px';
  redoBtnEl.style.left   = '80px';
  redoBtnEl.addEventListener('click', () => { callbacks.onRedo(); playUndo(); });
  ui.appendChild(redoBtnEl);

  // ── Win overlay ──────────────────────────────────────────────────────────
  winOverlay  = buildWinOverlay(ui, callbacks.onNextLevel, callbacks.onReset);
  prevSolved  = false;

  updateOverlay(state, _levelIndex, _levelTotal);
}

/** Call every frame to keep counter and button states current. */
export function updateOverlay(state: GameState, levelIndex: number, levelTotal: number): void {
  _levelIndex = levelIndex;
  _levelTotal = levelTotal;

  if (levelIndicatorEl !== null) {
    levelIndicatorEl.textContent = `Level ${levelIndex + 1}/${levelTotal}`;
  }

  if (moveCounterEl !== null) {
    moveCounterEl.textContent = `Moves: ${state.moveCount}`;
  }

  if (targetIndicatorEl !== null) {
    const t = state.targetLayers;
    if (t > 0) {
      targetIndicatorEl.textContent = `Target: ${t} line${t === 1 ? '' : 's'} left`;
      targetIndicatorEl.style.display = 'block';
    } else {
      targetIndicatorEl.style.display = 'none';
    }
  }

  const solved = checkWin(state);

  if (winOverlay !== null) {
    if (solved && !prevSolved) winOverlay.show(state.moveCount);
    if (!solved && prevSolved) winOverlay.hide();
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
