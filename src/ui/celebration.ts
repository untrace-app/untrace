// Win celebration screen (Phase 3)

import { playButtonTap, playSparkChime, playWorldUnlockChime } from '../audio/audio.ts';
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
    '@keyframes cel-spark-in {',
    '  0%   { transform: scale(0); }',
    '  60%  { transform: scale(1.3); }',
    '  100% { transform: scale(1.0); }',
    '}',
    '@keyframes cel-plus-float {',
    '  0%   { opacity: 0; transform: translateY(0); }',
    '  100% { opacity: 1; transform: translateY(-20px); }',
    '}',
    '@keyframes cel-plus-out {',
    '  0%   { opacity: 1; }',
    '  100% { opacity: 0; }',
    '}',
    '@keyframes cel-trail-fade {',
    '  0%   { opacity: 0.8; transform: scale(1); }',
    '  100% { opacity: 0;   transform: scale(0.4); }',
    '}',
    '@keyframes cel-world-bounce {',
    '  0%   { opacity: 0; transform: scale(0); }',
    '  60%  { opacity: 1; transform: scale(1.1); }',
    '  80%  { transform: scale(0.96); }',
    '  100% { opacity: 1; transform: scale(1); }',
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
  sparkEarned?:     number;           // 0 = no animation, 1 or 2 = animate
  worldUnlocked?:   number | null;    // new world number, or null for normal win
  onNextLevel:      () => void;
  onReplay:         () => void;
  onLevelSelect:    () => void;
}

// ─── Spark SVG (matches level-select lightning-bolt) ──────────────────────────

const SPARK_BLUE_GRAD_ID = 'cel-spark-grad';
function sparkSVG(size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" overflow="visible">`
    + `<defs><linearGradient id="${SPARK_BLUE_GRAD_ID}" x1="0%" y1="0%" x2="100%" y2="100%">`
    + `<stop offset="0%" stop-color="#3a86ff"/>`
    + `<stop offset="100%" stop-color="#00d4ff"/>`
    + `</linearGradient></defs>`
    + `<path d="M13 2 L3 14 L11 14 L11 22 L21 10 L13 10 Z" `
    + `fill="url(#${SPARK_BLUE_GRAD_ID})" stroke="#1e4fb8" stroke-width="1.2" stroke-linejoin="round"/>`
    + `</svg>`;
}

/**
 * Animate the spark icon flying from its current position to the top of the
 * screen (where the level-select spark counter will be), shrinking as it goes
 * and leaving a small trail of fading circles. The "+1" text fades out at the
 * same time.
 */
function flySparkUpward(iconEl: HTMLElement, plusEl: HTMLElement): void {
  const rect = iconEl.getBoundingClientRect();
  if (rect.width === 0) return;

  // Fade out the "+N" text.
  plusEl.style.animation = 'cel-plus-out 0.4s ease-out forwards';

  // Clone the icon into a fixed-position overlay so it can travel freely.
  const flyer = document.createElement('div');
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;
  const targetX = window.innerWidth - 40; // near top-right spark counter
  const targetY = 32;
  flyer.style.cssText = [
    'position:fixed',
    `left:${startX - 16}px`, `top:${startY - 16}px`,
    'width:32px', 'height:32px',
    'pointer-events:none',
    'z-index:100',
    'will-change:transform,opacity',
    'transition:transform 0.5s cubic-bezier(0.55,0.085,0.68,0.53), width 0.5s ease-in, height 0.5s ease-in, opacity 0.5s ease-in',
  ].join(';');
  flyer.innerHTML = sparkSVG(32);
  document.body.appendChild(flyer);

  // Hide the original in place.
  iconEl.style.opacity = '0';

  // Drop trail circles along a few points on the path.
  const steps = 4;
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1);
    const tx = startX + (targetX - startX) * t;
    const ty = startY + (targetY - startY) * t;
    setTimeout(() => {
      const dot = document.createElement('div');
      dot.style.cssText = [
        'position:fixed',
        `left:${tx - 4}px`, `top:${ty - 4}px`,
        'width:8px', 'height:8px', 'border-radius:50%',
        'background:radial-gradient(circle,#3a86ff,#00d4ff)',
        'pointer-events:none', 'z-index:99',
        'animation:cel-trail-fade 0.5s ease-out forwards',
      ].join(';');
      document.body.appendChild(dot);
      setTimeout(() => dot.remove(), 520);
    }, i * 60);
  }

  requestAnimationFrame(() => {
    flyer.style.transform = `translate(${targetX - startX}px, ${targetY - startY}px) scale(0.375)`;
    flyer.style.opacity   = '0';
  });
  setTimeout(() => flyer.remove(), 560);
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
  starsRow.style.cssText = 'display:flex;gap:10px;justify-content:center;margin:0 0 14px;';

  // Spark reward row (may stay empty if no spark earned)
  const sparkEarned = Math.max(0, params.sparkEarned ?? 0);
  const sparkRow = document.createElement('div');
  sparkRow.style.cssText = [
    'position:relative',
    'height:44px',
    'display:flex', 'align-items:center', 'justify-content:center',
    'gap:8px',
    'margin:0 0 4px',
    'user-select:none', 'pointer-events:none',
  ].join(';');
  const sparkIcon = document.createElement('div');
  sparkIcon.style.cssText = [
    'display:inline-flex', 'align-items:center', 'justify-content:center',
    'width:32px', 'height:32px',
    'transform:scale(0)',
    'will-change:transform',
  ].join(';');
  sparkIcon.innerHTML = sparkEarned > 0 ? sparkSVG(32) : '';
  const plusText = document.createElement('span');
  plusText.textContent = sparkEarned > 0 ? `+${sparkEarned}` : '';
  plusText.style.cssText = [
    'display:inline-block',
    `font-family:${FONT_HEADING}`,
    'font-size:18px', 'font-weight:700',
    'background:linear-gradient(135deg,#3a86ff,#00d4ff)',
    '-webkit-background-clip:text', 'background-clip:text',
    'color:transparent',
    '-webkit-text-fill-color:transparent',
    'opacity:0',
    'transform:translateY(0)',
    'will-change:opacity,transform',
  ].join(';');
  sparkRow.appendChild(sparkIcon);
  sparkRow.appendChild(plusText);
  const starEls: HTMLElement[] = [];
  for (let i = 0; i < 3; i++) {
    const starWrap = document.createElement('div');
    starWrap.style.cssText = 'flex-shrink:0;display:inline-flex;transform:scale(0);';
    starWrap.innerHTML = celebStarSVG(i, false); // start gray
    starsRow.appendChild(starWrap);
    starEls.push(starWrap);
  }

  // Big "World N Unlocked!" celebration (end-of-world): takes precedence over
  // the small star-gate notification below. When this is active, the primary
  // button becomes "Continue" and routes to onLevelSelect.
  const bigWorldUnlock = params.worldUnlocked ?? null;
  let bigUnlockEl: HTMLDivElement | null = null;
  let sparkleBurstEl: HTMLDivElement | null = null;
  if (bigWorldUnlock !== null) {
    bigUnlockEl = document.createElement('div');
    bigUnlockEl.style.cssText = [
      'position:relative',
      'margin:0 0 18px', 'user-select:none',
      'opacity:0', 'transform:scale(0)',
      'will-change:opacity,transform',
    ].join(';');

    const bigTitle = document.createElement('p');
    bigTitle.textContent = `World ${bigWorldUnlock} Unlocked!`;
    bigTitle.style.cssText = [
      'color:#fb5607',
      'font-size:24px', 'font-weight:800',
      'margin:0', 'line-height:1.1',
      'letter-spacing:-0.01em',
      `font-family:${FONT_HEADING}`,
    ].join(';');

    // Sparkle burst container — sits directly under the text and hosts 10 dots
    // that fly outward from the center over 800ms then fade out.
    sparkleBurstEl = document.createElement('div');
    sparkleBurstEl.style.cssText = [
      'position:relative', 'width:100%', 'height:40px',
      'pointer-events:none',
    ].join(';');

    bigUnlockEl.appendChild(bigTitle);
    bigUnlockEl.appendChild(sparkleBurstEl);
  }

  // Small star-gate unlock notification (shown only when the big celebration
  // is NOT active, to avoid duplicating the same message).
  const unlockedWorld = bigWorldUnlock === null ? getNewlyUnlockedWorld() : null;
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
    'font-size:16px', 'font-weight:600', 'cursor:pointer',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'display:block', 'box-sizing:border-box',
    `font-family:${FONT}`,
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
    'outline:none',
  ].join(';');

  const nextBtn = document.createElement('button');
  if (bigWorldUnlock !== null) {
    nextBtn.textContent = 'Continue';
    nextBtn.style.cssText =
      `${BTN_BASE};background:${GRAD_PRIMARY};color:#ffffff;margin-bottom:10px;` +
      `font-size:17px;font-weight:700;padding:14px 44px;`;
    nextBtn.addEventListener('click', () => { playButtonTap(); dismiss(onLevelSelect); });
  } else {
    nextBtn.textContent = 'Next Level';
    nextBtn.style.cssText = `${BTN_BASE};background:${GRAD_PRIMARY};color:#ffffff;margin-bottom:10px;`;
    nextBtn.addEventListener('click', () => { playButtonTap(); onNextLevel(); });
  }
  addPressFeedback(nextBtn);

  const replayBtn = document.createElement('button');
  replayBtn.textContent = 'Replay';
  replayBtn.style.cssText = `${BTN_BASE};background:${C_RECESSED};color:${C_TEXT};margin-bottom:10px;font-size:15px;padding:13px 0;`;
  replayBtn.addEventListener('click', () => { playButtonTap(); dismiss(onReplay); });
  addPressFeedback(replayBtn);

  const selectBtn = document.createElement('button');
  selectBtn.textContent = 'Back to Levels';
  selectBtn.style.cssText = `${BTN_BASE};background:transparent;color:${C_TEXT};margin-bottom:0;text-decoration:underline;font-size:15px;padding:13px 0;`;
  selectBtn.addEventListener('click', () => { playButtonTap(); dismiss(onLevelSelect); });
  addPressFeedback(selectBtn);

  cardEl.appendChild(checkEl);
  cardEl.appendChild(titleEl);
  cardEl.appendChild(variedEl);
  cardEl.appendChild(starsRow);
  if (sparkEarned > 0) cardEl.appendChild(sparkRow);
  if (bigUnlockEl) cardEl.appendChild(bigUnlockEl);
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
      // Spark reward animation — plays ~800ms after the card opens so it
      // lands after the last star finishes its bounce.
      if (sparkEarned > 0) {
        const sparkStart = 800;
        setTimeout(() => {
          sparkIcon.style.animation = 'cel-spark-in 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards';
          plusText.style.animation  = 'cel-plus-float 0.3s ease-out forwards';
          playSparkChime();
        }, sparkStart);

        // After 600ms visible, fly upward with a shrinking trail.
        setTimeout(() => {
          flySparkUpward(sparkIcon, plusText);
        }, sparkStart + 400 + 600);
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

      // Big end-of-world celebration: bounce-in text + sparkle burst + chime.
      if (bigUnlockEl) {
        const lastStarFinish = 220 + Math.max(0, params.stars - 1) * 200 + 280;
        const bigStart = lastStarFinish + 120;
        setTimeout(() => {
          if (bigUnlockEl) {
            bigUnlockEl.style.animation = 'cel-world-bounce 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards';
          }
          playWorldUnlockChime();
          if (sparkleBurstEl) spawnSparkleBurst(sparkleBurstEl);
        }, bigStart);
      }
    });
  });
}

// ─── Sparkle burst helper ─────────────────────────────────────────────────────

const SPARKLE_COLORS: readonly string[] = [
  '#ffbe0b', '#fb5607', '#ff006e', '#8338ec', '#3a86ff',
];

function spawnSparkleBurst(host: HTMLElement): void {
  const count = 10;
  const rect = host.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist  = 44 + Math.random() * 14;
    const dx    = Math.cos(angle) * dist;
    const dy    = Math.sin(angle) * dist;
    const color = SPARKLE_COLORS[i % SPARKLE_COLORS.length]!;

    const dot = document.createElement('div');
    dot.style.cssText = [
      'position:absolute',
      `left:${cx - 2}px`, `top:${cy - 2}px`,
      'width:4px', 'height:4px', 'border-radius:50%',
      `background:${color}`,
      `box-shadow:0 0 6px ${color}`,
      'opacity:1',
      'will-change:transform,opacity',
      'transition:transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.8s ease-out',
      'pointer-events:none',
    ].join(';');
    host.appendChild(dot);

    requestAnimationFrame(() => {
      dot.style.transform = `translate(${dx}px, ${dy}px) scale(0.6)`;
      dot.style.opacity   = '0';
    });
    setTimeout(() => dot.remove(), 900);
  }
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
