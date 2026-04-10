// Hint popup UI: shows 3 tiered hint options, spark balance, and rewarded-ad slot.

import type { LevelData } from '../types.ts';
import { FONT, FONT_HEADING, C_TEXT, C_TEXT_SEC, C_RECESSED, C_PRIMARY } from '../constants.ts';
import { getSparkCount } from '../sparks.ts';
import {
  HINT_COSTS,
  hasHint,
  purchaseHint,
  getSolutionForLevel,
  startHintAnim,
  stepMsForSolution,
} from '../hints.ts';
import { addPressFeedback } from './overlay.ts';
import { playButtonTap, playHintPurchase } from '../audio/audio.ts';
import { hapticSnap } from '../haptics.ts';
import { showShop } from './shop.ts';

// ─── Ad (rewarded video) state ─────────────────────────────────────────────
const LS_ADS_DAILY = 'untrace_hint_ads_daily';
const ADS_PER_DAY = 3;

interface AdsDaily { date: string; count: number; }

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function getAdsRemaining(): number {
  try {
    const raw = localStorage.getItem(LS_ADS_DAILY);
    if (!raw) return ADS_PER_DAY;
    const parsed = JSON.parse(raw) as AdsDaily;
    if (parsed.date !== todayStr()) return ADS_PER_DAY;
    return Math.max(0, ADS_PER_DAY - (parsed.count ?? 0));
  } catch { return ADS_PER_DAY; }
}

// ─── Icon builders ─────────────────────────────────────────────────────────

const SPARK_BOLT_SVG = `
<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
  <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
</svg>`;

const CLOSE_X_SVG = `
<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
  <path d="M6 6l12 12M18 6l-12 12"/>
</svg>`;

function hintIcon1(): string {
  return `
<svg viewBox="0 0 44 44" width="44" height="44">
  <circle cx="22" cy="22" r="14" fill="#3a86ff22"/>
  <circle cx="22" cy="22" r="8"  fill="#3a86ff">
    <animate attributeName="r" values="7;9;7" dur="1.2s" repeatCount="indefinite"/>
  </circle>
</svg>`;
}

function hintIcon2(): string {
  return `
<svg viewBox="0 0 44 44" width="44" height="44" fill="none" stroke="${C_PRIMARY}" stroke-width="3" stroke-linecap="round">
  <line x1="10" y1="14" x2="22" y2="14"/>
  <line x1="14" y1="22" x2="30" y2="22"/>
  <line x1="10" y1="30" x2="26" y2="30"/>
</svg>`;
}

function hintIcon3(): string {
  return `
<svg viewBox="0 0 44 44" width="44" height="44" fill="none" stroke="${C_PRIMARY}" stroke-width="2.5" stroke-linecap="round">
  <circle cx="12" cy="12" r="2" fill="${C_PRIMARY}"/>
  <circle cx="22" cy="12" r="2" fill="${C_PRIMARY}"/>
  <circle cx="32" cy="12" r="2" fill="${C_PRIMARY}"/>
  <circle cx="12" cy="22" r="2" fill="${C_PRIMARY}"/>
  <circle cx="22" cy="22" r="2" fill="${C_PRIMARY}"/>
  <circle cx="32" cy="22" r="2" fill="${C_PRIMARY}"/>
  <circle cx="12" cy="32" r="2" fill="${C_PRIMARY}"/>
  <circle cx="22" cy="32" r="2" fill="${C_PRIMARY}"/>
  <circle cx="32" cy="32" r="2" fill="${C_PRIMARY}"/>
  <path d="M12 12 L22 22 L32 12 L22 32 L12 22"/>
</svg>`;
}

// ─── Popup builder ─────────────────────────────────────────────────────────

export function showHintPopup(level: LevelData): void {
  const ui = document.getElementById('ui')!;

  const backdrop = document.createElement('div');
  backdrop.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:40',
    'background:rgba(255,237,205,0.85)',
    'backdrop-filter:blur(20px)',
    '-webkit-backdrop-filter:blur(20px)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'padding:24px',
    `font-family:${FONT}`,
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'background:#feffe5', 'border-radius:20px', 'padding:24px',
    'width:100%', 'max-width:340px', 'box-sizing:border-box',
    'box-shadow:0 8px 32px rgba(46,47,44,0.1)',
    'position:relative',
  ].join(';');

  // Close X
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = CLOSE_X_SVG;
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.style.cssText = [
    'position:absolute', 'top:12px', 'right:12px',
    'width:32px', 'height:32px', 'border-radius:9999px',
    'border:none', 'background:transparent',
    `color:${C_TEXT_SEC}`, 'cursor:pointer',
    'display:flex', 'align-items:center', 'justify-content:center',
    'padding:0', '-webkit-tap-highlight-color:transparent',
    'touch-action:manipulation',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  ].join(';');
  addPressFeedback(closeBtn);

  // Header row: title left, spark balance right
  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;padding-right:32px;';

  const title = document.createElement('div');
  title.textContent = 'Need a hint?';
  title.style.cssText = [
    `font-family:${FONT_HEADING}`, 'font-size:20px', 'font-weight:700',
    `color:${C_TEXT}`, 'letter-spacing:-0.01em',
  ].join(';');

  const sparkBadge = document.createElement('div');
  sparkBadge.style.cssText = [
    'display:flex', 'align-items:center', 'gap:4px',
    'font-size:14px', 'font-weight:600', 'color:#3a86ff',
    `font-family:${FONT}`,
  ].join(';');

  function renderSparkBadge(): void {
    sparkBadge.innerHTML = `${SPARK_BOLT_SVG}<span>${getSparkCount()} sparks</span>`;
  }
  renderSparkBadge();

  headerRow.appendChild(title);
  headerRow.appendChild(sparkBadge);

  // Hint option cards container
  const optionsWrap = document.createElement('div');
  optionsWrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

  interface HintConfig {
    tier: 1 | 2 | 3;
    iconHtml: string;
    description: string;
  }
  const HINT_CONFIGS: HintConfig[] = [
    { tier: 1, iconHtml: hintIcon1(), description: 'Show starting dot' },
    { tier: 2, iconHtml: hintIcon2(), description: 'Show first 3 moves' },
    { tier: 3, iconHtml: hintIcon3(), description: 'Show full solution' },
  ];

  const cardRefs: HTMLElement[] = [];

  function rerenderOptions(): void {
    for (const el of cardRefs) el.remove();
    cardRefs.length = 0;
    for (const cfg of HINT_CONFIGS) {
      cardRefs.push(buildOptionCard(cfg));
    }
    for (const el of cardRefs) optionsWrap.appendChild(el);
  }

  function buildOptionCard(cfg: HintConfig): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = [
      'display:flex', 'align-items:center', 'gap:14px',
      `background:${C_RECESSED}`, 'border-radius:14px',
      'padding:12px 14px',
    ].join(';');

    const iconEl = document.createElement('div');
    iconEl.style.cssText = 'flex-shrink:0;width:44px;height:44px;display:flex;align-items:center;justify-content:center;';
    iconEl.innerHTML = cfg.iconHtml;

    const desc = document.createElement('div');
    desc.textContent = cfg.description;
    desc.style.cssText = [
      'flex:1', 'min-width:0',
      `font-family:${FONT}`, 'font-size:14px', 'font-weight:500',
      `color:${C_TEXT_SEC}`, 'line-height:1.3',
    ].join(';');

    const actionBtn = document.createElement('button');
    actionBtn.style.cssText = [
      'flex-shrink:0',
      'border:none', 'border-radius:9999px',
      'padding:8px 16px',
      `font-family:${FONT}`, 'font-size:13px', 'font-weight:600',
      'cursor:pointer', 'touch-action:manipulation',
      '-webkit-tap-highlight-color:transparent',
      'display:flex', 'align-items:center', 'gap:4px',
      'transition:transform 0.15s ease-out, filter 0.15s ease-out',
    ].join(';');

    const owned = hasHint(level.id, cfg.tier);
    const cost = HINT_COSTS[cfg.tier]!;
    const canAfford = getSparkCount() >= cost;

    if (owned) {
      if (cfg.tier === 1) {
        actionBtn.textContent = 'Active';
        actionBtn.style.background = '#4caf50';
        actionBtn.style.color      = '#ffffff';
        actionBtn.disabled = true;
      } else {
        actionBtn.textContent = 'Replay';
        actionBtn.style.background = 'transparent';
        actionBtn.style.color      = C_PRIMARY;
        actionBtn.style.border     = `2px solid ${C_PRIMARY}`;
        actionBtn.addEventListener('click', () => {
          playButtonTap();
          triggerHintEffect(cfg.tier);
          closePopup();
        });
        addPressFeedback(actionBtn);
      }
    } else if (!canAfford) {
      actionBtn.textContent = 'Get more';
      actionBtn.style.background = 'transparent';
      actionBtn.style.color      = C_PRIMARY;
      actionBtn.style.border     = `2px solid ${C_PRIMARY}`;
      actionBtn.addEventListener('click', () => {
        playButtonTap();
        closePopup();
        showShop('sparks');
      });
      addPressFeedback(actionBtn);
    } else {
      actionBtn.textContent = `${cost} spark${cost > 1 ? 's' : ''}`;
      actionBtn.style.background = C_PRIMARY;
      actionBtn.style.color      = '#ffffff';
      actionBtn.addEventListener('click', () => {
        if (!purchaseHint(level.id, cfg.tier)) return;
        playHintPurchase();
        hapticSnap();
        renderSparkBadge();
        rerenderOptions();
        triggerHintEffect(cfg.tier);
        setTimeout(closePopup, 300);
      });
      addPressFeedback(actionBtn);
    }

    row.appendChild(iconEl);
    row.appendChild(desc);
    row.appendChild(actionBtn);
    return row;
  }

  for (const cfg of HINT_CONFIGS) {
    const el = buildOptionCard(cfg);
    cardRefs.push(el);
    optionsWrap.appendChild(el);
  }

  // Rewarded ad row
  const adRow = document.createElement('div');
  adRow.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:18px;';

  const adBtn = document.createElement('button');
  const adsRemaining = getAdsRemaining();
  const adDisabled   = adsRemaining === 0;
  adBtn.textContent = 'Watch ad for 1 spark';
  adBtn.style.cssText = [
    'width:100%', 'padding:12px 16px',
    'border-radius:9999px',
    `border:2px solid ${adDisabled ? '#d4c8b0' : C_PRIMARY}`,
    'background:transparent',
    `color:${adDisabled ? '#d4c8b0' : C_PRIMARY}`,
    `font-family:${FONT}`, 'font-size:14px', 'font-weight:600',
    'cursor:pointer', 'touch-action:manipulation',
    '-webkit-tap-highlight-color:transparent',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  ].join(';');
  if (adDisabled) adBtn.disabled = true;
  if (!adDisabled) addPressFeedback(adBtn);

  adBtn.addEventListener('click', () => {
    if (adDisabled) return;
    playButtonTap();
    console.log('AD: rewarded video requested');
  });

  const adCaption = document.createElement('div');
  adCaption.textContent = `(${adsRemaining} remaining today)`;
  adCaption.style.cssText = `font-size:11px;color:${C_TEXT_SEC};font-weight:500;`;

  adRow.appendChild(adBtn);
  adRow.appendChild(adCaption);

  // Assemble
  card.appendChild(closeBtn);
  card.appendChild(headerRow);
  card.appendChild(optionsWrap);
  card.appendChild(adRow);
  backdrop.appendChild(card);
  ui.appendChild(backdrop);

  // Close handlers
  let closed = false;
  function closePopup(): void {
    if (closed) return;
    closed = true;
    backdrop.remove();
  }
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closePopup();
  });
  card.addEventListener('click', (e) => e.stopPropagation());
  closeBtn.addEventListener('click', () => { playButtonTap(); closePopup(); });

  // Trigger hint effects (animation start).
  function triggerHintEffect(tier: number): void {
    if (tier === 1) return; // glow is handled by renderer reading hasHint
    const sol = getSolutionForLevel(level);
    if (!sol || sol.length === 0) return;
    if (tier === 2) {
      startHintAnim(level.id, sol.slice(0, Math.min(3, sol.length)), 600);
    } else if (tier === 3) {
      startHintAnim(level.id, sol, stepMsForSolution(sol.length));
    }
  }
}
