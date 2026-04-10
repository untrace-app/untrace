// Full-screen shop overlay. Entry points: level-select shop button, level-select
// spark chip, hint popup "get more", settings screen. Slides up from the bottom.
//
// This is a visual-only placeholder for future IAP. All purchase buttons log
// "SHOP: …" to console. No real store calls.

import {
  FONT, FONT_HEADING, C_TEXT, C_TEXT_SEC, C_PRIMARY,
} from '../constants.ts';
import { getSparkCount } from '../sparks.ts';
import { playButtonTap } from '../audio/audio.ts';
import { hapticSnap } from '../haptics.ts';
import { addPressFeedback } from './overlay.ts';
import { setDailyButtonVisible } from './level-select.ts';
import { showThemePreview } from './theme-preview.ts';

// ─── Module state ──────────────────────────────────────────────────────────

let overlayEl:    HTMLDivElement | null = null;
let panelEl:      HTMLDivElement | null = null;
let scrollEl:     HTMLDivElement | null = null;
let sparksHeaderBalanceEl: HTMLSpanElement | null = null;
let sectionRefs: HTMLElement[] = [];

// ─── Icon helpers ──────────────────────────────────────────────────────────

const CLOSE_X_SVG = `
<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
  <path d="M6 6l12 12M18 6l-12 12"/>
</svg>`;

const SPARK_BOLT_SMALL = `
<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
  <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
</svg>`;

function sparkPackSVG(): string {
  return `
<svg viewBox="0 0 44 64" width="40" height="56">
  <defs>
    <linearGradient id="shop-spark-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a86ff"/>
      <stop offset="1" stop-color="#00b4d8"/>
    </linearGradient>
  </defs>
  <path d="M26 2 L6 34 H20 L16 62 L38 28 H24 L28 2 Z"
        fill="url(#shop-spark-grad)" stroke="#1e4fb8" stroke-width="2" stroke-linejoin="round"/>
</svg>`;
}

const CROSSED_AD_SVG = `
<svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="#b17025" stroke-width="2.5" stroke-linecap="round">
  <rect x="4" y="7" width="24" height="18" rx="2"/>
  <line x1="6" y1="26" x2="26" y2="6"/>
</svg>`;

const PALETTE_SVG = `
<svg viewBox="0 0 24 24" width="16" height="16" fill="#b17025">
  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.3-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4c3.1 0 5.6-2.5 5.6-5.6C23 6.1 18.1 2 12 2zm-6.5 10a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3-4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm4.5 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
</svg>`;

const CHECK_SVG = `
<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#4caf50" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="4 12 10 18 20 6"/>
</svg>`;

// ─── Styling helpers ───────────────────────────────────────────────────────

const SECTION_HEADER_STYLE = [
  `font-family:${FONT_HEADING}`, 'font-size:16px', 'font-weight:700',
  `color:${C_TEXT}`, 'display:flex', 'align-items:center', 'gap:6px',
  'margin:0 0 12px', 'letter-spacing:-0.01em',
].join(';');

const CARD_BG = '#feffe5';

const PRIMARY_PILL_STYLE = [
  'border:none', 'border-radius:9999px',
  'padding:10px 20px',
  `background:${C_PRIMARY}`, 'color:#ffffff',
  `font-family:${FONT}`, 'font-size:14px', 'font-weight:700',
  'cursor:pointer', 'touch-action:manipulation',
  '-webkit-tap-highlight-color:transparent',
  'min-height:44px', 'box-sizing:border-box',
  'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  'white-space:nowrap',
].join(';');

function attachPress(btn: HTMLElement): void {
  addPressFeedback(btn);
  btn.addEventListener('pointerdown', () => { btn.style.transform = 'scale(0.95)'; });
}

function makePillButton(label: string, onTap: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = PRIMARY_PILL_STYLE;
  b.addEventListener('click', () => {
    playButtonTap();
    hapticSnap();
    onTap();
  });
  attachPress(b);
  return b;
}

// ─── Section 1: Remove Ads ─────────────────────────────────────────────────

function buildRemoveAdsSection(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;';

  const header = document.createElement('div');
  header.textContent = 'Remove Ads';
  header.style.cssText = SECTION_HEADER_STYLE;

  const card = document.createElement('div');
  card.style.cssText = [
    `background:${CARD_BG}`, 'border-radius:16px', 'padding:20px',
    'display:flex', 'align-items:center', 'gap:14px',
    'box-shadow:0 2px 8px rgba(46,47,44,0.04)',
  ].join(';');

  const iconEl = document.createElement('div');
  iconEl.innerHTML = CROSSED_AD_SVG;
  iconEl.style.cssText = 'flex-shrink:0;display:flex;align-items:center;justify-content:center;';

  const textWrap = document.createElement('div');
  textWrap.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;';
  const title = document.createElement('div');
  title.textContent = 'Remove all ads forever';
  title.style.cssText = `font-family:${FONT};font-size:14px;font-weight:500;color:${C_TEXT_SEC};line-height:1.3;`;
  const sub = document.createElement('div');
  sub.textContent = 'Enjoy uninterrupted gameplay';
  sub.style.cssText = `font-family:${FONT};font-size:12px;font-weight:400;color:${C_TEXT_SEC};opacity:0.8;`;
  textWrap.appendChild(title);
  textWrap.appendChild(sub);

  const isPurchased = localStorage.getItem('untrace_premium') === '1';

  card.appendChild(iconEl);
  card.appendChild(textWrap);

  if (isPurchased) {
    const owned = document.createElement('div');
    owned.style.cssText = 'flex-shrink:0;display:flex;align-items:center;gap:6px;color:#4caf50;font-weight:700;font-size:13px;';
    owned.innerHTML = `${CHECK_SVG}<span>Purchased</span>`;
    card.appendChild(owned);
  } else {
    const btn = makePillButton('$3.99', () => {
      console.log('SHOP: remove ads tapped');
    });
    card.appendChild(btn);
  }

  wrap.appendChild(header);
  wrap.appendChild(card);
  return wrap;
}

// ─── Section 2: Spark Packs ────────────────────────────────────────────────

interface SparkPackCfg {
  sparks: number;
  price:  string;
  badge?: { label: string; color: string };
}

const SPARK_PACKS: SparkPackCfg[] = [
  { sparks: 5,  price: '$0.99' },
  { sparks: 15, price: '$1.99', badge: { label: 'Popular',    color: '#ff006e' } },
  { sparks: 40, price: '$3.99', badge: { label: 'Best Value', color: '#8338ec' } },
];

function buildSparkPackCard(cfg: SparkPackCfg): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText = [
    'position:relative',
    `background:${CARD_BG}`, 'border-radius:16px',
    'padding:16px 12px', 'min-width:100px', 'flex:1',
    'display:flex', 'flex-direction:column', 'align-items:center', 'gap:8px',
    'box-shadow:0 2px 8px rgba(46,47,44,0.04)',
    'box-sizing:border-box',
  ].join(';');

  if (cfg.badge) {
    const badge = document.createElement('div');
    badge.textContent = cfg.badge.label;
    badge.style.cssText = [
      'position:absolute', 'top:-6px', 'right:8px',
      `background:${cfg.badge.color}`, 'color:#ffffff',
      `font-family:${FONT}`, 'font-size:9px', 'font-weight:700',
      'border-radius:8px', 'padding:2px 8px',
      'letter-spacing:0.04em', 'text-transform:uppercase',
      'white-space:nowrap',
    ].join(';');
    card.appendChild(badge);
  }

  const icon = document.createElement('div');
  icon.innerHTML = sparkPackSVG();
  icon.style.cssText = 'display:flex;align-items:center;justify-content:center;';

  const count = document.createElement('div');
  count.textContent = String(cfg.sparks);
  count.style.cssText = `font-family:${FONT_HEADING};font-size:24px;font-weight:800;color:${C_TEXT};line-height:1;`;

  const sub = document.createElement('div');
  sub.textContent = 'sparks';
  sub.style.cssText = `font-family:${FONT};font-size:11px;font-weight:400;color:${C_TEXT_SEC};margin-top:-2px;`;

  const btn = makePillButton(cfg.price, () => {
    console.log(`SHOP: buy ${cfg.sparks} sparks tapped`);
  });
  btn.style.marginTop = '6px';
  btn.style.padding   = '8px 16px';
  btn.style.fontSize  = '13px';

  card.appendChild(icon);
  card.appendChild(count);
  card.appendChild(sub);
  card.appendChild(btn);
  return card;
}

function buildSparkPacksSection(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.id = 'shop-sparks';
  wrap.style.cssText = 'display:flex;flex-direction:column;scroll-margin-top:80px;';

  const header = document.createElement('div');
  header.style.cssText = SECTION_HEADER_STYLE;
  header.innerHTML = `<span style="color:#3a86ff;display:inline-flex;">${SPARK_BOLT_SMALL}</span><span>Spark Packs</span>`;

  const balance = document.createElement('div');
  balance.style.cssText = [
    'display:flex', 'align-items:center', 'gap:5px',
    `font-family:${FONT}`, 'font-size:13px', 'font-weight:500',
    'color:#3a86ff', 'margin:0 0 12px',
  ].join(';');
  const balText = document.createElement('span');
  sparksHeaderBalanceEl = balText;
  balText.textContent = `You have ${getSparkCount()} sparks`;
  balance.innerHTML = `<span style="display:inline-flex;">${SPARK_BOLT_SMALL}</span>`;
  balance.appendChild(balText);

  const row = document.createElement('div');
  row.style.cssText = [
    'display:flex', 'flex-direction:row', 'gap:10px',
    'width:100%', 'box-sizing:border-box',
    'align-items:stretch',
  ].join(';');
  for (const pack of SPARK_PACKS) row.appendChild(buildSparkPackCard(pack));

  wrap.appendChild(header);
  wrap.appendChild(balance);
  wrap.appendChild(row);
  return wrap;
}

// ─── Section 3: Themes (entry card only) ──────────────────────────────────

function buildThemesSection(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;';

  const header = document.createElement('div');
  header.style.cssText = SECTION_HEADER_STYLE;
  header.innerHTML = `<span style="display:inline-flex;">${PALETTE_SVG}</span><span>Themes</span>`;

  const card = document.createElement('div');
  card.style.cssText = [
    `background:${CARD_BG}`, 'border-radius:16px', 'padding:20px',
    'display:flex', 'align-items:center', 'gap:14px',
    'cursor:pointer', '-webkit-tap-highlight-color:transparent',
    'touch-action:manipulation',
    'box-shadow:0 2px 8px rgba(46,47,44,0.04)',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  ].join(';');

  const iconEl = document.createElement('div');
  iconEl.style.cssText = 'flex-shrink:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;';
  // Larger palette icon (32px)
  iconEl.innerHTML = `
<svg viewBox="0 0 24 24" width="32" height="32" fill="#b17025">
  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.3-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4c3.1 0 5.6-2.5 5.6-5.6C23 6.1 18.1 2 12 2zm-6.5 10a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3-4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm4.5 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
</svg>`;

  const textWrap = document.createElement('div');
  textWrap.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;';
  const title = document.createElement('div');
  title.textContent = 'Browse Themes';
  title.style.cssText = `font-family:${FONT};font-size:14px;font-weight:600;color:${C_TEXT};line-height:1.3;`;
  const sub = document.createElement('div');
  sub.textContent = 'Customize your entire game';
  sub.style.cssText = `font-family:${FONT};font-size:12px;font-weight:400;color:${C_TEXT_SEC};`;
  textWrap.appendChild(title);
  textWrap.appendChild(sub);

  const chevron = document.createElement('div');
  chevron.style.cssText = `flex-shrink:0;color:${C_TEXT_SEC};display:flex;align-items:center;`;
  chevron.innerHTML = `
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="9 6 15 12 9 18"/>
</svg>`;

  card.appendChild(iconEl);
  card.appendChild(textWrap);
  card.appendChild(chevron);

  card.addEventListener('click', () => {
    playButtonTap();
    hapticSnap();
    showThemePreview();
  });
  attachPress(card);

  wrap.appendChild(header);
  wrap.appendChild(card);
  return wrap;
}

// ─── Overlay build ─────────────────────────────────────────────────────────

function buildOverlay(): void {
  const ui = document.getElementById('ui')!;

  overlayEl = document.createElement('div');
  overlayEl.style.cssText = [
    'position:fixed', 'inset:0',
    'z-index:60', 'display:none',
    `font-family:${FONT}`,
  ].join(';');

  panelEl = document.createElement('div');
  panelEl.style.cssText = [
    'position:absolute', 'inset:0',
    'background:#ffedcd',
    'display:flex', 'flex-direction:column',
    'transform:translateY(100%)',
    'transition:transform 0.3s ease-out',
    'will-change:transform',
  ].join(';');

  // Top bar
  const topBar = document.createElement('div');
  topBar.style.cssText = [
    'position:relative',
    'padding-top:calc(env(safe-area-inset-top, 0px) + 16px)',
    'padding-left:20px', 'padding-right:20px', 'padding-bottom:12px',
    'display:flex', 'align-items:center', 'justify-content:center',
    'flex-shrink:0',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'Shop';
  title.style.cssText = [
    `font-family:${FONT_HEADING}`, 'font-size:22px', 'font-weight:700',
    `color:${C_TEXT}`, 'letter-spacing:-0.01em',
  ].join(';');

  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('aria-label', 'Close shop');
  closeBtn.innerHTML = CLOSE_X_SVG;
  closeBtn.style.cssText = [
    'position:absolute',
    'top:calc(env(safe-area-inset-top, 0px) + 8px)', 'right:12px',
    'width:40px', 'height:40px',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:transparent', 'border:none', 'padding:0',
    `color:${C_TEXT_SEC}`, 'cursor:pointer',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'outline:none',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  ].join(';');
  attachPress(closeBtn);
  closeBtn.addEventListener('click', () => { playButtonTap(); hideShop(); });

  topBar.appendChild(title);
  topBar.appendChild(closeBtn);

  // Scroll area
  scrollEl = document.createElement('div');
  scrollEl.style.cssText = [
    'flex:1', 'overflow-y:auto', '-webkit-overflow-scrolling:touch',
    'overscroll-behavior:contain',
    'padding:4px 20px calc(env(safe-area-inset-bottom, 0px) + 32px)',
  ].join(';');

  // Sections + dividers
  const removeAds = buildRemoveAdsSection();
  const sparks    = buildSparkPacksSection();
  const themes    = buildThemesSection();

  sectionRefs = [removeAds, sparks, themes];
  for (const s of sectionRefs) {
    s.style.opacity    = '0';
    s.style.transform  = 'translateY(8px)';
    s.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
    s.style.willChange = 'opacity, transform';
  }

  const makeDivider = (): HTMLElement => {
    const d = document.createElement('div');
    d.style.cssText = 'height:1px;background:#f0d2a8;margin:24px 0;';
    return d;
  };

  scrollEl.appendChild(removeAds);
  scrollEl.appendChild(makeDivider());
  scrollEl.appendChild(sparks);
  scrollEl.appendChild(makeDivider());
  scrollEl.appendChild(themes);

  panelEl.appendChild(topBar);
  panelEl.appendChild(scrollEl);
  overlayEl.appendChild(panelEl);
  ui.appendChild(overlayEl);
}

// ─── Public API ────────────────────────────────────────────────────────────

export function showShop(scrollTo?: string): void {
  if (!overlayEl) buildOverlay();
  if (!overlayEl || !panelEl || !scrollEl) return;

  // Refresh live balance each open.
  if (sparksHeaderBalanceEl) {
    sparksHeaderBalanceEl.textContent = `You have ${getSparkCount()} sparks`;
  }

  setDailyButtonVisible(false);
  overlayEl.style.display = 'block';
  panelEl.style.transition = 'none';
  panelEl.style.transform  = 'translateY(100%)';
  for (const s of sectionRefs) {
    s.style.transition = 'none';
    s.style.opacity    = '0';
    s.style.transform  = 'translateY(8px)';
  }

  // Double rAF so transforms latch before the transition runs.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!panelEl) return;
      panelEl.style.transition = 'transform 0.3s ease-out';
      panelEl.style.transform  = 'translateY(0)';
      sectionRefs.forEach((s, i) => {
        s.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
        setTimeout(() => {
          s.style.opacity   = '1';
          s.style.transform = 'translateY(0)';
        }, 150 + i * 100);
      });
    });
  });

  if (scrollTo === 'sparks') {
    setTimeout(() => {
      const el = document.getElementById('shop-sparks');
      if (el && scrollEl) {
        scrollEl.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
      }
    }, 350);
  } else if (scrollEl) {
    scrollEl.scrollTop = 0;
  }
}

export function hideShop(): void {
  if (!overlayEl || !panelEl) return;
  panelEl.style.transition = 'transform 0.3s ease-out';
  panelEl.style.transform  = 'translateY(100%)';
  setTimeout(() => {
    if (overlayEl) overlayEl.style.display = 'none';
    setDailyButtonVisible(true);
  }, 310);
}
