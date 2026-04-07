// Win celebration screen (Phase 3)

import { playButtonTap } from '../audio/audio.ts';
import { addPressFeedback } from './overlay.ts';
import { getLevelCount, getCurrentLevel } from '../levels/levels.ts';
import { WORLD_GATES, FONT, FONT_HEADING, C_TEXT, C_TEXT_SEC, C_RECESSED, GRAD_PRIMARY } from '../constants.ts';

// ─── Star keyframe animations ─────────────────────────────────────────────────

let _celStylesInjected = false;
function injectCelStyles(): void {
  if (_celStylesInjected) return;
  _celStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = [
    '@keyframes cel-star-earn {',
    '  0%   { transform: scale(0); }',
    '  65%  { transform: scale(1.15); }',
    '  100% { transform: scale(1.0); }',
    '}',
    '@keyframes cel-star-pop {',
    '  0%   { transform: scale(0); }',
    '  75%  { transform: scale(1.05); }',
    '  100% { transform: scale(1.0); }',
    '}',
  ].join('\n');
  document.head.appendChild(s);
}

const FA_STAR_PATH = 'M309.5-18.9c-4.1-8-12.4-13.1-21.4-13.1s-17.3 5.1-21.4 13.1L193.1 125.3 33.2 150.7c-8.9 1.4-16.3 7.7-19.1 16.3s-.5 18 5.8 24.4l114.4 114.5-25.2 159.9c-1.4 8.9 2.3 17.9 9.6 23.2s16.9 6.1 25 2L288.1 417.6 432.4 491c8 4.1 17.7 3.3 25-2s11-14.2 9.6-23.2L441.7 305.9 556.1 191.4c6.4-6.4 8.6-15.8 5.8-24.4s-10.1-14.9-19.1-16.3L383 125.3 309.5-18.9z';

function celebStarSVG(index: number, earned: boolean): string {
  if (earned) {
    return `<svg width="32" height="32" viewBox="-3 -21 582 536" overflow="visible">`
      + `<defs><radialGradient id="celstar-${index}" cx="50%" cy="30%" r="65%">`
      + `<stop offset="0%" stop-color="#ffbe0b"/><stop offset="100%" stop-color="#f59e0b"/>`
      + `</radialGradient></defs>`
      + `<path d="${FA_STAR_PATH}" fill="url(#celstar-${index})" stroke="#b17025" stroke-width="3" vector-effect="non-scaling-stroke"/>`
      + `</svg>`;
  }
  return `<svg width="32" height="32" viewBox="-3 -21 582 536" overflow="visible">`
    + `<path d="${FA_STAR_PATH}" fill="#d3d1c7" stroke="#b17025" stroke-width="3" vector-effect="non-scaling-stroke"/>`
    + `</svg>`;
}

const TITLES_3_STAR: readonly string[] = ['Perfect!', 'Flawless!', 'Brilliant!'];
const TITLES_2_STAR: readonly string[] = ['Well done!', 'Nice work!', 'Solid!'];
const TITLES_1_STAR: readonly string[] = ['Cleared!', 'Done!', 'Onward!'];

function pickTitle(stars: number): string {
  const arr = stars >= 3 ? TITLES_3_STAR : stars === 2 ? TITLES_2_STAR : TITLES_1_STAR;
  return arr[Math.floor(Math.random() * arr.length)]!;
}

const LS_STARS = 'untrace_stars';

function getTotalStars(): number {
  try {
    const raw = localStorage.getItem(LS_STARS);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) || parsed === null || typeof parsed !== 'object') return 0;
    return Object.values(parsed as Record<string, number>)
      .reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0);
  } catch {
    return 0;
  }
}

/** True if any loaded level belongs to the given world. */
function isWorldAvailable(world: number): boolean {
  const count = getLevelCount();
  for (let i = 0; i < count; i++) {
    if (getCurrentLevel(i).world === world) return true;
  }
  return false;
}

// Snapshot of total stars captured at module-import time (before any win of
// this session). Each call to getNewlyUnlockedWorld advances this to the
// current total, so the next call's "before" is the prior call's "after".
let _prevTotalStars = getTotalStars();

/**
 * Returns the world whose star-gate was crossed on THIS level completion
 * (before < gate && after >= gate), or null. Worlds that are not present
 * in the loaded level data are skipped. The internal snapshot is advanced
 * on every call so subsequent wins compare against the latest total.
 */
function getNewlyUnlockedWorld(): number | null {
  const afterTotal  = getTotalStars();
  const beforeTotal = _prevTotalStars;
  _prevTotalStars   = afterTotal;

  const worlds = Object.keys(WORLD_GATES).map(Number).sort((a, b) => a - b);
  for (const world of worlds) {
    const required = WORLD_GATES[world]!;
    if (beforeTotal < required && afterTotal >= required && isWorldAvailable(world)) {
      return world;
    }
  }
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CelebrationParams {
  levelName:        string;
  levelNumber:      number;
  moveCount:        number;
  minMoves:         number | null;
  stars:            number;           // 1 | 2 | 3
  remainingLayers?: number;           // for reduce levels (targetLayers > 0)
  targetLayers?:    number;
  onNextLevel:      () => void;
  onReplay:         () => void;
  onLevelSelect:    () => void;
}

// ─── Module state ─────────────────────────────────────────────────────────────

let backdropEl:  HTMLDivElement | null = null;
let cardEl:      HTMLDivElement | null = null;
let _isShowing = false;

// ─── Build ────────────────────────────────────────────────────────────────────

export function initCelebration(): void {
  injectCelStyles();
  const ui = document.getElementById('ui')!;

  backdropEl = document.createElement('div');
  backdropEl.style.cssText = [
    'position:fixed', 'inset:0',
    'display:none',
    'align-items:center', 'justify-content:center',
    'z-index:30',
    'background:rgba(255,237,205,0.85)',
    'backdrop-filter:blur(20px)',
    '-webkit-backdrop-filter:blur(20px)',
  ].join(';');

  cardEl = document.createElement('div');
  cardEl.style.cssText = [
    'background:#feffe5',
    'border-radius:24px',
    'padding:32px 28px 24px',
    'max-width:320px',
    'width:calc(100% - 48px)',
    'text-align:center',
    `font-family:${FONT}`,
    'box-shadow:0 8px 32px rgba(46,47,44,0.08)',
    'will-change:opacity,transform',
    'opacity:0',
    'transform:scale(0.88)',
    'transition:none',
  ].join(';');

  backdropEl.appendChild(cardEl);
  ui.appendChild(backdropEl);
}

// ─── Show / hide ──────────────────────────────────────────────────────────────

export function showCelebration(params: CelebrationParams): void {
  if (!backdropEl || !cardEl) return;
  _isShowing = true;

  // Snapshot callbacks so closures don't reference a stale params object.
  const { onNextLevel, onReplay, onLevelSelect } = params;

  // Helper: animate card out then invoke a callback.
  function dismiss(then: () => void): void {
    if (!cardEl) return;
    cardEl.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
    cardEl.style.opacity    = '0';
    cardEl.style.transform  = 'scale(0.92)';
    setTimeout(() => {
      if (backdropEl) backdropEl.style.display = 'none';
      if (cardEl) {
        cardEl.style.transition = 'none';
        cardEl.style.opacity    = '0';
        cardEl.style.transform  = 'scale(0.88)';
      }
      then();
    }, 200);
  }

  // ── Build card contents ───────────────────────────────────────────────────
  cardEl.innerHTML = '';

  // Check icon
  const checkEl = document.createElement('div');
  checkEl.style.cssText = [
    'width:48px', 'height:48px', 'border-radius:50%',
    'background:#ffedcd',
    'display:flex', 'align-items:center', 'justify-content:center',
    'margin:0 auto 14px',
  ].join(';');
  checkEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" '
    + 'stroke="#fb5607" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'
    + '<polyline points="20 6 9 17 4 12"/></svg>';

  // "LEVEL X COMPLETE" headline
  const titleEl = document.createElement('p');
  titleEl.textContent = `Level ${params.levelNumber} Complete`;
  titleEl.style.cssText = [
    `color:${C_TEXT}`,
    'font-size:13px', 'font-weight:700', 'letter-spacing:0.12em',
    'text-transform:uppercase', 'margin:0 0 4px', 'user-select:none',
    `font-family:${FONT_HEADING}`,
  ].join(';');

  // Varied message below
  const variedEl = document.createElement('p');
  variedEl.textContent = pickTitle(params.stars);
  variedEl.style.cssText = [
    `color:${C_TEXT}`,
    'font-size:24px', 'font-weight:700', 'letter-spacing:-0.02em',
    'margin:0 0 18px', 'user-select:none',
    `font-family:${FONT_HEADING}`,
  ].join(';');

  // Stars row — always 3 slots, all start gray at scale(0)
  const starsRow = document.createElement('div');
  starsRow.style.cssText = 'display:flex;gap:10px;justify-content:center;margin:0 0 18px;';
  const starEls: HTMLElement[] = [];
  for (let i = 0; i < 3; i++) {
    const starWrap = document.createElement('div');
    starWrap.style.cssText = 'flex-shrink:0;display:inline-flex;transform:scale(0);';
    starWrap.innerHTML = celebStarSVG(i, false); // start gray
    starsRow.appendChild(starWrap);
    starEls.push(starWrap);
  }

  // World unlock notification (shown only once per crossed star-gate)
  const unlockedWorld = getNewlyUnlockedWorld();
  let unlockEl: HTMLDivElement | null = null;
  if (unlockedWorld !== null) {
    unlockEl = document.createElement('div');
    unlockEl.style.cssText = [
      'margin:0 0 18px', 'user-select:none',
      'opacity:0', 'transform:scale(0.8)',
      'transition:opacity 0.3s ease-out, transform 0.3s ease-out',
      'will-change:opacity,transform',
    ].join(';');

    const unlockTitle = document.createElement('p');
    unlockTitle.textContent = `World ${unlockedWorld} Unlocked!`;
    unlockTitle.style.cssText = [
      'color:#fb5607',
      'font-size:20px', 'font-weight:700',
      'margin:0 0 4px', 'line-height:1.1',
      `font-family:${FONT_HEADING}`,
    ].join(';');

    const unlockSub = document.createElement('p');
    unlockSub.textContent = 'New puzzles await';
    unlockSub.style.cssText = [
      'color:#7f7c6c',
      'font-size:13px', 'font-weight:500',
      'margin:0', 'line-height:1.2',
      `font-family:${FONT}`,
    ].join(';');

    unlockEl.appendChild(unlockTitle);
    unlockEl.appendChild(unlockSub);
  }

  // Stats pill
  const statsEl = document.createElement('div');
  statsEl.style.cssText = [
    'background:#ffedcd',
    'border-radius:16px', 'padding:14px 16px',
    'margin:0 0 22px',
    'display:flex', 'justify-content:space-around',
  ].join(';');

  function statCell(label: string, value: string): HTMLElement {
    const cell = document.createElement('div');
    cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;';
    const v = document.createElement('span');
    v.textContent = value;
    v.style.cssText = `color:${C_TEXT};font-size:22px;font-weight:700;line-height:1;user-select:none;font-family:${FONT_HEADING};`;
    const l = document.createElement('span');
    l.textContent = label;
    l.style.cssText = [
      `color:${C_TEXT_SEC}`, 'font-size:10px', 'font-weight:500',
      'letter-spacing:0.08em', 'text-transform:uppercase', 'user-select:none',
    ].join(';');
    cell.appendChild(v);
    cell.appendChild(l);
    return cell;
  }

  statsEl.appendChild(statCell('Moves', String(params.moveCount)));
  if (params.minMoves !== null) {
    statsEl.appendChild(statCell('Best', String(params.minMoves)));
  }

  // ── Buttons ───────────────────────────────────────────────────────────────
  const BTN_BASE = [
    'width:100%', 'padding:14px 0',
    'border:none', 'border-radius:9999px',
    'font-size:15px', 'font-weight:600', 'cursor:pointer',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'display:block', 'box-sizing:border-box',
    `font-family:${FONT}`,
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
    'outline:none',
  ].join(';');

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next Level';
  nextBtn.style.cssText = `${BTN_BASE};background:${GRAD_PRIMARY};color:#ffffff;margin-bottom:10px;`;
  nextBtn.addEventListener('click', () => { playButtonTap(); onNextLevel(); });
  addPressFeedback(nextBtn);

  const replayBtn = document.createElement('button');
  replayBtn.textContent = 'Replay';
  replayBtn.style.cssText = `${BTN_BASE};background:${C_RECESSED};color:${C_TEXT};margin-bottom:10px;`;
  replayBtn.addEventListener('click', () => { playButtonTap(); dismiss(onReplay); });
  addPressFeedback(replayBtn);

  const selectBtn = document.createElement('button');
  selectBtn.textContent = 'Back to Levels';
  selectBtn.style.cssText = `${BTN_BASE};background:transparent;color:${C_TEXT};margin-bottom:0;text-decoration:underline;`;
  selectBtn.addEventListener('click', () => { playButtonTap(); dismiss(onLevelSelect); });
  addPressFeedback(selectBtn);

  cardEl.appendChild(checkEl);
  cardEl.appendChild(titleEl);
  cardEl.appendChild(variedEl);
  cardEl.appendChild(starsRow);
  if (unlockEl) cardEl.appendChild(unlockEl);
  cardEl.appendChild(statsEl);
  cardEl.appendChild(nextBtn);
  cardEl.appendChild(replayBtn);
  cardEl.appendChild(selectBtn);

  // ── Show and animate in ───────────────────────────────────────────────────
  backdropEl.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (cardEl) {
        cardEl.style.transition = 'opacity 0.28s ease, transform 0.28s cubic-bezier(0.34,1.56,0.64,1)';
        cardEl.style.opacity    = '1';
        cardEl.style.transform  = 'scale(1)';
      }
      // Stagger all 3 star reveals, 200ms apart. Earned = gold bounce, unearned = gray pop.
      for (let i = 0; i < 3; i++) {
        const star = starEls[i]!;
        const earned = i < params.stars;
        setTimeout(() => {
          if (earned) {
            star.innerHTML = celebStarSVG(i, true);
            star.style.animation = 'cel-star-earn 0.4s ease-out forwards';
          } else {
            star.style.animation = 'cel-star-pop 0.35s ease-out forwards';
          }
        }, 220 + i * 200);
      }
      // World unlock popup: animate in after the last star finishes.
      if (unlockEl) {
        const lastStarFinish = 220 + Math.max(0, params.stars - 1) * 200 + 280;
        setTimeout(() => {
          if (unlockEl) {
            unlockEl.style.opacity   = '1';
            unlockEl.style.transform = 'scale(1)';
          }
        }, lastStarFinish + 120);
      }
    });
  });
}

export function hideCelebration(): void {
  _isShowing = false;
  if (!backdropEl || !cardEl) return;
  cardEl.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
  cardEl.style.opacity    = '0';
  cardEl.style.transform  = 'scale(0.92)';
  setTimeout(() => {
    if (backdropEl) backdropEl.style.display = 'none';
    if (cardEl) {
      cardEl.style.transition = 'none';
      cardEl.style.opacity    = '0';
      cardEl.style.transform  = 'scale(0.88)';
    }
  }, 200);
}

/**
 * Force the celebration card to its fully-visible end state after page suspension.
 * Suspended setTimeout/rAF may have left stars or the unlock badge un-animated.
 */
export function recoverCelebration(): void {
  if (!_isShowing || !backdropEl || !cardEl) return;
  cardEl.style.transition = 'none';
  cardEl.style.opacity    = '1';
  cardEl.style.transform  = 'scale(1)';
  cardEl.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.style.opacity === '0' || el.style.transform.includes('scale(0)')) {
      el.style.transition = 'none';
      el.style.opacity    = '1';
      el.style.transform  = 'scale(1)';
    }
  });
}
