// Daily puzzle system: landing overlay, results card, share, streak
// tracking, and post-solve celebration. Depends on main.ts only through
// registered callbacks to avoid a circular import.

import type { LevelData } from '../types.ts';
import { loadDailyLevels, getTodaysDailyLevel, getDailyNumber, getCachedDailyNumber, getTodayKey } from '../levels/daily-levels.ts';
import { playButtonTap } from '../audio/audio.ts';
import { addSparks } from '../sparks.ts';
import {
  FONT, FONT_HEADING, C_TEXT, C_TEXT_SEC, C_RECESSED, C_PRIMARY,
  COLOR_BACKGROUND,
} from '../constants.ts';

// ─── localStorage keys ────────────────────────────────────────────────────

const LS_DAILY_LAST_PLAYED = 'untrace_daily_last_played';
const LS_DAILY_RESULT      = 'untrace_daily_result';
const LS_DAILY_STREAK      = 'untrace_daily_streak';

interface DailyResult {
  date:  string;  // YYYY-MM-DD
  moves: number;
  stars: number;
  par:   number;
}

interface DailyStreak {
  streak:   number;
  lastDate: string; // YYYY-MM-DD
}

// ─── State helpers ────────────────────────────────────────────────────────

export function isDailyCompletedToday(): boolean {
  return localStorage.getItem(LS_DAILY_LAST_PLAYED) === getTodayKey();
}

function loadDailyResult(): DailyResult | null {
  try {
    const raw = localStorage.getItem(LS_DAILY_RESULT);
    if (!raw) return null;
    return JSON.parse(raw) as DailyResult;
  } catch {
    return null;
  }
}

function saveDailyResult(r: DailyResult): void {
  localStorage.setItem(LS_DAILY_RESULT, JSON.stringify(r));
}

function loadStreak(): DailyStreak {
  try {
    const raw = localStorage.getItem(LS_DAILY_STREAK);
    if (!raw) return { streak: 0, lastDate: '' };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        streak:   typeof parsed.streak === 'number' ? parsed.streak : 0,
        lastDate: typeof parsed.lastDate === 'string' ? parsed.lastDate : '',
      };
    }
  } catch {}
  return { streak: 0, lastDate: '' };
}

function saveStreak(s: DailyStreak): void {
  localStorage.setItem(LS_DAILY_STREAK, JSON.stringify(s));
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function advanceStreak(): number {
  const today = getTodayKey();
  const yesterday = yesterdayKey();
  const s = loadStreak();
  let next: number;
  if (s.lastDate === yesterday) next = s.streak + 1;
  else if (s.lastDate === today) next = s.streak;
  else next = 1;
  saveStreak({ streak: next, lastDate: today });
  return next;
}

// ─── Star SVG (matches celebration) ───────────────────────────────────────

const STAR_SVG_FILLED =
  '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#ffbe0b">'
  + '<path d="M12 2l2.6 6.3 6.8.5-5.2 4.5 1.6 6.7L12 16.8 6.2 20l1.6-6.7L2.6 8.8l6.8-.5L12 2z"/>'
  + '</svg>';
const STAR_SVG_EMPTY =
  '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#d3d1c7">'
  + '<path d="M12 2l2.6 6.3 6.8.5-5.2 4.5 1.6 6.7L12 16.8 6.2 20l1.6-6.7L2.6 8.8l6.8-.5L12 2z"/>'
  + '</svg>';

const FLAME_SVG =
  '<svg width="18" height="18" viewBox="0 0 448 512" fill="#fb5607">'
  + '<path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4z"/>'
  + '</svg>';

const CLOSE_X_SVG =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + C_TEXT + '" stroke-width="2.5" stroke-linecap="round">'
  + '<path d="M6 6 L18 18 M18 6 L6 18"/>'
  + '</svg>';

const SHARE_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/>'
  + '<polyline points="16 6 12 2 8 6"/>'
  + '<line x1="12" y1="2" x2="12" y2="15"/>'
  + '</svg>';

// ─── Callback registration ────────────────────────────────────────────────

let _startDailyFn: ((level: LevelData) => void) | null = null;
let _exitToLevelSelectFn: (() => void) | null = null;

interface InitConfig {
  startDaily:        (level: LevelData) => void;
  exitToLevelSelect: () => void;
}

export function initDailyPuzzle(config: InitConfig): void {
  _startDailyFn        = config.startDaily;
  _exitToLevelSelectFn = config.exitToLevelSelect;
  // Kick off daily pool fetch — non-blocking, result cached.
  loadDailyLevels().catch(() => {});
}

// ─── Results overlay (completed-today view) ───────────────────────────────

let _resultsOverlay: HTMLDivElement | null = null;

function buildResultsOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed', 'inset:0',
    `background:${COLOR_BACKGROUND}`,
    'display:flex', 'flex-direction:column',
    'z-index:200',
    `font-family:${FONT}`,
  ].join(';');

  // Top bar
  const topBar = document.createElement('div');
  topBar.style.cssText = [
    'position:relative',
    'display:flex', 'align-items:center', 'justify-content:center',
    'height:44px',
    'padding-top:calc(env(safe-area-inset-top, 0px) + 12px)',
    'padding-left:16px', 'padding-right:16px',
    'box-sizing:content-box',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'Daily Puzzle';
  title.style.cssText = [
    `font-family:${FONT_HEADING}`,
    'font-size:20px', 'font-weight:700',
    `color:${C_TEXT}`,
    'user-select:none',
  ].join(';');
  topBar.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = CLOSE_X_SVG;
  closeBtn.style.cssText = [
    'position:absolute',
    'top:calc(env(safe-area-inset-top, 0px) + 12px)', 'bottom:0',
    'right:16px', 'margin:auto 0',
    'width:40px', 'height:40px',
    `background:${C_RECESSED}`,
    'border:none', 'border-radius:50%',
    'display:flex', 'align-items:center', 'justify-content:center',
    'cursor:pointer', 'padding:0',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'transition:transform 0.15s ease-out',
  ].join(';');
  closeBtn.addEventListener('pointerdown', () => { closeBtn.style.transform = 'scale(0.92)'; });
  closeBtn.addEventListener('pointerup',     () => { closeBtn.style.transform = ''; });
  closeBtn.addEventListener('pointercancel', () => { closeBtn.style.transform = ''; });
  closeBtn.addEventListener('pointerleave',  () => { closeBtn.style.transform = ''; });
  closeBtn.addEventListener('click', () => {
    playButtonTap();
    hideDailyResults();
  });
  topBar.appendChild(closeBtn);

  overlay.appendChild(topBar);

  // Subtitle (Daily #N)
  const subtitle = document.createElement('div');
  subtitle.textContent = `Daily #${getDailyNumber()}`;
  subtitle.style.cssText = [
    `font-family:${FONT_HEADING}`,
    'font-size:14px', 'font-weight:500',
    `color:${C_TEXT_SEC}`,
    'text-align:center', 'margin-top:4px', 'user-select:none',
  ].join(';');
  overlay.appendChild(subtitle);

  // Body — scrollable content area hosts the results card
  const body = document.createElement('div');
  body.id = 'daily-results-body';
  body.style.cssText = [
    'flex:1 1 auto',
    'display:flex', 'align-items:center', 'justify-content:center',
    'padding:24px',
  ].join(';');
  overlay.appendChild(body);

  return overlay;
}

function renderResultsCard(): HTMLElement {
  const result = loadDailyResult();
  const streak = loadStreak();

  const card = document.createElement('div');
  card.style.cssText = [
    'background:#feffe5',
    'border-radius:16px',
    'padding:28px 24px 24px',
    'max-width:320px', 'width:100%',
    'box-shadow:0 4px 16px rgba(0,0,0,0.08)',
    'display:flex', 'flex-direction:column', 'align-items:center', 'gap:14px',
    `font-family:${FONT}`,
  ].join(';');

  const heading = document.createElement('div');
  heading.textContent = 'Completed!';
  heading.style.cssText = [
    `font-family:${FONT_HEADING}`,
    'font-size:22px', 'font-weight:700',
    `color:${C_PRIMARY}`,
    'margin:0',
  ].join(';');
  card.appendChild(heading);

  // Stars
  const stars = result ? result.stars : 0;
  const starsRow = buildStarsRow(stars, 40);
  card.appendChild(starsRow);

  // Moves
  if (result) {
    const moves = document.createElement('div');
    moves.textContent = `${result.moves} moves (best: ${result.par})`;
    moves.style.cssText = [
      `font-family:${FONT}`,
      'font-size:16px', 'font-weight:500',
      `color:${C_TEXT}`,
    ].join(';');
    card.appendChild(moves);
  }

  // Streak
  const streakRow = document.createElement('div');
  streakRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
  streakRow.innerHTML = FLAME_SVG;
  const streakText = document.createElement('span');
  streakText.textContent = `${streak.streak} day streak`;
  streakText.style.cssText = [
    `font-family:${FONT}`,
    'font-size:14px', 'font-weight:600',
    `color:${C_TEXT}`,
  ].join(';');
  streakRow.appendChild(streakText);
  card.appendChild(streakRow);

  // Next puzzle countdown
  const countdown = document.createElement('div');
  countdown.style.cssText = [
    `font-family:${FONT}`,
    'font-size:12px', 'font-weight:500',
    `color:${C_TEXT_SEC}`,
    'margin-top:4px',
  ].join(';');
  countdown.textContent = `Next puzzle in ${hoursUntilMidnight()} hours`;
  card.appendChild(countdown);

  // Share button
  const shareBtn = document.createElement('button');
  shareBtn.style.cssText = [
    'display:flex', 'align-items:center', 'justify-content:center', 'gap:8px',
    'background:' + C_PRIMARY, 'color:#ffffff',
    'border:none', 'border-radius:9999px',
    'padding:12px 24px',
    `font-family:${FONT}`, 'font-size:14px', 'font-weight:600',
    'cursor:pointer', 'margin-top:6px',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'transition:transform 0.15s ease-out',
  ].join(';');
  shareBtn.innerHTML = SHARE_SVG + '<span>Share Results</span>';
  shareBtn.addEventListener('pointerdown', () => { shareBtn.style.transform = 'scale(0.95)'; });
  shareBtn.addEventListener('pointerup',     () => { shareBtn.style.transform = ''; });
  shareBtn.addEventListener('pointercancel', () => { shareBtn.style.transform = ''; });
  shareBtn.addEventListener('pointerleave',  () => { shareBtn.style.transform = ''; });
  shareBtn.addEventListener('click', () => {
    playButtonTap();
    shareResults();
  });
  card.appendChild(shareBtn);

  return card;
}

function hoursUntilMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return Math.max(1, Math.ceil((tomorrow.getTime() - now.getTime()) / 3600000));
}

function buildStarsRow(stars: number, size: number): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;';
  for (let i = 0; i < 3; i++) {
    const star = document.createElement('div');
    star.style.cssText = [
      `width:${size}px`, `height:${size}px`,
      'transform:scale(0)',
      'transition:transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
    ].join(';');
    star.innerHTML = i < stars ? STAR_SVG_FILLED : STAR_SVG_EMPTY;
    row.appendChild(star);
    // Staggered pop-in
    setTimeout(() => { star.style.transform = 'scale(1)'; }, 120 + i * 180);
  }
  return row;
}

export function showDailyResults(): void {
  if (_resultsOverlay) _resultsOverlay.remove();
  _resultsOverlay = buildResultsOverlay();
  document.body.appendChild(_resultsOverlay);
  const body = _resultsOverlay.querySelector<HTMLDivElement>('#daily-results-body');
  if (body) body.appendChild(renderResultsCard());
  console.log('DAILY: overlay shown', _resultsOverlay.style.display, _resultsOverlay.style.zIndex);
}

export function hideDailyResults(): void {
  if (_resultsOverlay) {
    _resultsOverlay.remove();
    _resultsOverlay = null;
  }
}

// ─── Celebration (shown after solving the daily) ──────────────────────────

let _celebrationOverlay: HTMLDivElement | null = null;

function buildDailyCelebration(
  moves: number,
  stars: number,
  par: number,
  streak: number,
  sparkEarned: number,
  dailyNumber: number,
): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed', 'inset:0',
    'background:rgba(255,237,205,0.92)',
    'backdrop-filter:blur(20px)', '-webkit-backdrop-filter:blur(20px)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'z-index:300',
    `font-family:${FONT}`,
    'padding:24px',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'background:#feffe5',
    'border-radius:20px',
    'padding:32px 28px 24px',
    'max-width:340px', 'width:100%',
    'box-shadow:0 8px 32px rgba(46,47,44,0.12)',
    'display:flex', 'flex-direction:column', 'align-items:center', 'gap:16px',
  ].join(';');

  const heading = document.createElement('div');
  heading.textContent = `Daily #${dailyNumber} Complete!`;
  heading.style.cssText = [
    `font-family:${FONT_HEADING}`,
    'font-size:22px', 'font-weight:700',
    `color:${C_PRIMARY}`,
    'text-align:center', 'margin:0',
  ].join(';');
  card.appendChild(heading);

  card.appendChild(buildStarsRow(stars, 44));

  const movesLine = document.createElement('div');
  movesLine.textContent = `${moves} moves (best: ${par})`;
  movesLine.style.cssText = [
    `font-family:${FONT_HEADING}`,
    'font-size:14px', 'font-weight:500',
    `color:${C_TEXT}`,
  ].join(';');
  card.appendChild(movesLine);

  // Streak with count-up
  const streakRow = document.createElement('div');
  streakRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
  streakRow.innerHTML = FLAME_SVG;
  const streakText = document.createElement('span');
  streakText.style.cssText = [
    `font-family:${FONT}`,
    'font-size:15px', 'font-weight:600',
    `color:${C_TEXT}`,
  ].join(';');
  streakText.textContent = '0 day streak';
  streakRow.appendChild(streakText);
  card.appendChild(streakRow);
  animateCountUp(streakText, streak, 'day streak');

  // Spark badge
  if (sparkEarned > 0) {
    const sparkBadge = document.createElement('div');
    sparkBadge.style.cssText = [
      'display:flex', 'align-items:center', 'gap:6px',
      'background:rgba(58,134,255,0.12)',
      'color:#3a86ff',
      'padding:6px 12px', 'border-radius:9999px',
      `font-family:${FONT}`, 'font-size:13px', 'font-weight:600',
      'opacity:0', 'transform:translateY(8px)',
      'transition:opacity 0.35s ease-out, transform 0.35s ease-out',
    ].join(';');
    sparkBadge.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 320 512" fill="#3a86ff">'
      + '<path d="M296 160H180.6l42.6-129.8C227.2 15 215.7 0 200 0H56C44 0 33.8 8.9 32.2 20.8l-32 240C-1.7 275.2 9.5 288 24 288h118.7L96.6 482.5c-3.6 15.2 8 29.5 23.3 29.5 8.4 0 16.4-4.4 20.8-12l176-304c9.3-15.9-2.2-36-20.7-36z"/>'
      + '</svg><span>+' + sparkEarned + ' spark</span>';
    card.appendChild(sparkBadge);
    setTimeout(() => {
      sparkBadge.style.opacity = '1';
      sparkBadge.style.transform = 'translateY(0)';
    }, 500);
  }

  // Share button
  const shareBtn = document.createElement('button');
  shareBtn.style.cssText = [
    'display:flex', 'align-items:center', 'justify-content:center', 'gap:8px',
    `background:${C_PRIMARY}`, 'color:#ffffff',
    'border:none', 'border-radius:9999px',
    'padding:12px 24px', 'margin-top:8px',
    `font-family:${FONT}`, 'font-size:14px', 'font-weight:600',
    'cursor:pointer', 'width:100%',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'transition:transform 0.15s ease-out',
  ].join(';');
  shareBtn.innerHTML = SHARE_SVG + '<span>Share Results</span>';
  shareBtn.addEventListener('pointerdown', () => { shareBtn.style.transform = 'scale(0.96)'; });
  shareBtn.addEventListener('pointerup',     () => { shareBtn.style.transform = ''; });
  shareBtn.addEventListener('pointercancel', () => { shareBtn.style.transform = ''; });
  shareBtn.addEventListener('pointerleave',  () => { shareBtn.style.transform = ''; });
  shareBtn.addEventListener('click', () => {
    playButtonTap();
    shareResults();
  });
  card.appendChild(shareBtn);

  // Done button
  const doneBtn = document.createElement('button');
  doneBtn.textContent = 'Done';
  doneBtn.style.cssText = [
    `background:${C_RECESSED}`, `color:${C_TEXT}`,
    'border:none', 'border-radius:9999px',
    'padding:12px 24px',
    `font-family:${FONT}`, 'font-size:14px', 'font-weight:600',
    'cursor:pointer', 'width:100%',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'transition:transform 0.15s ease-out',
  ].join(';');
  doneBtn.addEventListener('pointerdown', () => { doneBtn.style.transform = 'scale(0.96)'; });
  doneBtn.addEventListener('pointerup',     () => { doneBtn.style.transform = ''; });
  doneBtn.addEventListener('pointercancel', () => { doneBtn.style.transform = ''; });
  doneBtn.addEventListener('pointerleave',  () => { doneBtn.style.transform = ''; });
  doneBtn.addEventListener('click', () => {
    playButtonTap();
    hideDailyCelebration();
    if (_exitToLevelSelectFn) _exitToLevelSelectFn();
  });
  card.appendChild(doneBtn);

  overlay.appendChild(card);
  return overlay;
}

function animateCountUp(el: HTMLElement, target: number, suffix: string): void {
  const duration = 800;
  const start = performance.now();
  const step = (now: number): void => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = Math.round(target * eased);
    el.textContent = `${val} ${suffix}`;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function hideDailyCelebration(): void {
  if (_celebrationOverlay) {
    _celebrationOverlay.remove();
    _celebrationOverlay = null;
  }
}

// ─── Completion flow (called by main.ts on daily win) ─────────────────────

/**
 * Record completion, award spark, update streak, and present the daily
 * celebration overlay. Idempotent for the current day.
 */
export function handleDailyWin(moves: number, par: number): void {
  const alreadyToday = isDailyCompletedToday();

  // Star rating (same formula as regular levels).
  let stars = 1;
  if (par > 0) {
    const twoStarThreshold = par + Math.max(2, Math.floor(par * 0.5));
    if (moves <= par)                  stars = 3;
    else if (moves <= twoStarThreshold) stars = 2;
  }

  let sparkEarned = 0;
  let streak = loadStreak().streak;

  if (!alreadyToday) {
    const today = getTodayKey();
    localStorage.setItem(LS_DAILY_LAST_PLAYED, today);
    saveDailyResult({ date: today, moves, stars, par });
    streak = advanceStreak();
    if (false) { addSparks(1); } // daily spark reward disabled while feature is hidden
    sparkEarned = 0;
  } else {
    // Shouldn't normally happen (game won't run if already completed), but
    // keep numbers coherent if it does.
    const existing = loadDailyResult();
    if (existing) {
      stars = existing.stars;
      moves = existing.moves;
      par   = existing.par;
    }
  }

  _celebrationOverlay = buildDailyCelebration(
    moves, stars, par, streak, sparkEarned, getCachedDailyNumber(),
  );
  document.body.appendChild(_celebrationOverlay);
}

// ─── Share ────────────────────────────────────────────────────────────────

function buildShareText(): string {
  const r = loadDailyResult();
  const streak = loadStreak().streak;
  const stars  = r ? r.stars : 0;
  const moves  = r ? r.moves : 0;
  const par    = r ? r.par   : 0;
  const starStr = '\u2B50'.repeat(Math.max(0, Math.min(3, stars)));
  return [
    `Untrace Daily #${getCachedDailyNumber()}`,
    `Moves: ${moves} (Best: ${par})`,
    `Rating: ${starStr}`,
    `Streak: ${streak} days`,
    'untrace.app',
  ].join('\n');
}

// Called SYNCHRONOUSLY from the button's click handler so the Web Share API
// still sees a valid user activation on Android/iOS. Nothing must await before
// the navigator.share() call — that would break the gesture requirement.
function shareResults(): void {
  const text: string = buildShareText();
  console.log('SHARE: text', text);
  console.log('SHARE: available?', !!navigator.share);

  const nav = navigator as Navigator & {
    share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  };

  if (typeof nav.share === 'function') {
    // IMPORTANT: call .then/.catch (no await) so we stay synchronous inside
    // the click handler and don't lose the transient user activation.
    try {
      nav.share({ title: 'Untrace Daily', text })
        .then(() => {
          console.log('SHARE: success');
        })
        .catch((err: Error) => {
          console.log('SHARE: error', err?.name, err?.message);
          // Only fall back for "NotSupportedError" / "AbortError"-style
          // failures where nothing actually got shared. For every failure we
          // still try clipboard as a best-effort so the user isn't stuck.
          if (err?.name !== 'AbortError') {
            copyToClipboardFallback(text);
          }
        });
      return;
    } catch (err) {
      console.log('SHARE: threw synchronously', err);
      // Fall through to clipboard below.
    }
  }

  copyToClipboardFallback(text);
}

function copyToClipboardFallback(text: string): void {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text)
        .then(() => {
          console.log('SHARE: clipboard ok');
          showToast('Copied to clipboard!');
        })
        .catch((err: Error) => {
          console.log('SHARE: clipboard error', err?.name, err?.message);
        });
    }
  } catch (err) {
    console.log('SHARE: clipboard threw', err);
  }
}

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = [
    'position:fixed',
    'bottom:calc(env(safe-area-inset-bottom, 0px) + 80px)',
    'left:50%', 'transform:translateX(-50%) translateY(8px)',
    `background:${C_TEXT}`, 'color:#ffffff',
    `font-family:${FONT}`, 'font-size:14px', 'font-weight:600',
    'padding:10px 18px', 'border-radius:9999px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.15)',
    'z-index:400',
    'opacity:0',
    'transition:opacity 0.2s ease-out, transform 0.2s ease-out',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(8px)';
    setTimeout(() => toast.remove(), 220);
  }, 2000);
}

// ─── Entry point for the daily button ─────────────────────────────────────

/**
 * Called by level-select when the daily button is tapped.
 * Completed → show results overlay. Not completed → start the daily game.
 */
export function handleDailyTap(): void {
  console.log('DAILY: handleDailyTap called', {
    completedToday: isDailyCompletedToday(),
    hasStartDailyFn: !!_startDailyFn,
    hasExitFn: !!_exitToLevelSelectFn,
  });
  if (isDailyCompletedToday()) {
    showDailyResults();
    return;
  }
  // Ensure pool is loaded, then start.
  loadDailyLevels().then(() => {
    const level = getTodaysDailyLevel();
    console.log('DAILY: pool loaded', { hasLevel: !!level, levelId: level?.id });
    if (!level || !_startDailyFn) {
      showToast('Daily puzzle unavailable');
      return;
    }
    _startDailyFn(level);
  }).catch((err) => {
    console.log('DAILY: load failed', err);
    showToast('Daily puzzle unavailable');
  });
}
