// Full-screen shop overlay. Entry points: level-select shop button, level-select
// spark chip, hint popup "get more", settings screen. Slides up from the bottom.
//
// This is a visual-only placeholder for future IAP. All purchase buttons log
// "SHOP: …" to console. No real store calls.

import {
  FONT, FONT_HEADING, C_TEXT, C_TEXT_SEC, C_PRIMARY, C_RECESSED,
} from '../constants.ts';
import { playButtonTap } from '../audio/audio.ts';
import { hapticSnap } from '../haptics.ts';
import { addPressFeedback } from './overlay.ts';
import { setDailyButtonVisible } from './level-select.ts';

// ─── Module state ──────────────────────────────────────────────────────────

let overlayEl:    HTMLDivElement | null = null;
let panelEl:      HTMLDivElement | null = null;
let scrollEl:     HTMLDivElement | null = null;
let sectionRefs: HTMLElement[] = [];

// ─── Icon helpers ──────────────────────────────────────────────────────────

const CLOSE_X_SVG = `
<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
  <path d="M6 6l12 12M18 6l-12 12"/>
</svg>`;

// Section-header bolt (small, palette-friendly). Uses the same FA bolt path as
// the level-select spark counter so the whole app shares one bolt silhouette.
const FA_BOLT_PATH = 'M338.8-9.9c11.9 8.6 16.3 24.2 10.9 37.8L271.3 224 416 224c13.5 0 25.5 8.4 30.1 21.1s.7 26.9-9.6 35.5l-288 240c-11.3 9.4-27.4 9.9-39.3 1.3s-16.3-24.2-10.9-37.8L176.7 288 32 288c-13.5 0-25.5-8.4-30.1-21.1s-.7-26.9 9.6-35.5l288-240c11.3-9.4 27.4-9.9 39.3-1.3z';

const SPARK_BOLT_SMALL = `
<svg viewBox="-3 -13 454 528" width="14" height="14" overflow="visible">
  <defs><linearGradient id="shop-bolt-small-grad" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#00bcd4"/>
    <stop offset="100%" stop-color="#2196f3"/>
  </linearGradient></defs>
  <path d="${FA_BOLT_PATH}" fill="url(#shop-bolt-small-grad)" stroke="#1e4fb8" stroke-width="2" vector-effect="non-scaling-stroke"/>
</svg>`;

// Large pack-card bolt — matches the level-select top-bar lightning bolt.
function sparkPackBolt(gradId: string): string {
  return `
<svg viewBox="-3 -13 454 528" width="40" height="40" overflow="visible">
  <defs><linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#00bcd4"/>
    <stop offset="100%" stop-color="#2196f3"/>
  </linearGradient></defs>
  <path d="${FA_BOLT_PATH}" fill="url(#${gradId})" stroke="#1e4fb8" stroke-width="2" vector-effect="non-scaling-stroke"/>
</svg>`;
}

// FA "ad slash" icon — crossed-out ad rectangle. viewBox 0 0 640 512.
const CROSSED_AD_SVG = `
<svg viewBox="0 0 640 512" width="32" height="32" fill="#b17025">
  <path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7l-86.4-67.7 13.8 9.2c9.8 6.5 22.4 7.2 32.9 1.6s16.9-16.4 16.9-28.2l0-256c0-11.8-6.5-22.6-16.9-28.2s-23-5-32.9 1.6l-96 64L448 174.9l0 17.1 0 128 0 5.8-32-25.1L416 128c0-35.3-28.7-64-64-64L113.9 64 38.8 5.1zM407 416.7L32.3 121.5c-.2 2.1-.3 4.3-.3 6.5l0 256c0 35.3 28.7 64 64 64l256 0c23.4 0 43.9-12.6 55-31.3z"/>
</svg>`;

// FA "palette/brush" icon — viewBox 0 0 384 512. Used for the Browse Themes
// card icon (32px). A small variant is kept for the section header.
const PALETTE_SVG = `
<svg viewBox="0 0 384 512" width="32" height="32" fill="#b17025">
  <path d="M162.4 6c-1.5-3.6-5-6-8.9-6l-19 0c-3.9 0-7.5 2.4-8.9 6L104.9 57.7c-3.2 8-14.6 8-17.8 0L66.4 6c-1.5-3.6-5-6-8.9-6L48 0C21.5 0 0 21.5 0 48L0 224l0 22.4L0 256l9.6 0 364.8 0 9.6 0 0-9.6 0-22.4 0-176c0-26.5-21.5-48-48-48L230.5 0c-3.9 0-7.5 2.4-8.9 6L200.9 57.7c-3.2 8-14.6 8-17.8 0L162.4 6zM0 288l0 32c0 35.3 28.7 64 64 64l64 0 0 64c0 35.3 28.7 64 64 64s64-28.7 64-64l0-64 64 0c35.3 0 64-28.7 64-64l0-32L0 288zM192 432a16 16 0 1 1 0 32 16 16 0 1 1 0-32z"/>
</svg>`;

const PALETTE_SVG_SMALL = `
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
  iconEl.style.cssText = 'flex-shrink:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;';

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

  // Icon row: 1/2/3 lightning bolts depending on pack size, each overlapping
  // the previous by -10px. The wrapper sits centered on the card.
  const icon = document.createElement('div');
  icon.style.cssText = [
    'display:flex', 'flex-direction:row', 'align-items:center', 'justify-content:center',
    'height:40px', 'width:100%',
  ].join(';');
  const boltCount = cfg.sparks === 5 ? 1 : cfg.sparks === 15 ? 2 : 3;
  for (let i = 0; i < boltCount; i++) {
    const bolt = document.createElement('div');
    bolt.style.cssText = [
      'display:flex', 'align-items:center', 'justify-content:center',
      'width:40px', 'height:40px', 'flex-shrink:0',
      i > 0 ? 'margin-left:-10px' : '',
    ].filter(Boolean).join(';');
    bolt.innerHTML = sparkPackBolt(`shop-bolt-${cfg.sparks}-${i}`);
    icon.appendChild(bolt);
  }

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
  header.innerHTML = `<span style="display:inline-flex;">${SPARK_BOLT_SMALL}</span><span>Spark Packs</span>`;

  const row = document.createElement('div');
  row.style.cssText = [
    'display:flex', 'flex-direction:row', 'gap:10px',
    'width:100%', 'box-sizing:border-box',
    'align-items:stretch',
  ].join(';');
  for (const pack of SPARK_PACKS) row.appendChild(buildSparkPackCard(pack));

  wrap.appendChild(header);
  wrap.appendChild(row);
  return wrap;
}

// ─── Section 3: Themes (coming soon — not tappable) ───────────────────────

const LOCK_SVG = `
<svg viewBox="0 0 448 512" width="11" height="11" fill="currentColor" style="margin-right:3px;opacity:0.7;">
  <path d="M144 144v48H304V144c0-44.2-35.8-80-80-80s-80 35.8-80 80zM80 192V144C80 64.5 144.5 0 224 0s144 64.5 144 144v48h16c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V256c0-35.3 28.7-64 64-64H80z"/>
</svg>`;

function buildThemesSection(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;';

  const header = document.createElement('div');
  header.style.cssText = SECTION_HEADER_STYLE;
  header.innerHTML = `<span style="display:inline-flex;">${PALETTE_SVG_SMALL}</span><span>Themes</span>`;

  const card = document.createElement('div');
  card.style.cssText = [
    `background:${CARD_BG}`, 'border-radius:16px', 'padding:20px',
    'display:flex', 'align-items:center', 'gap:14px',
    'box-shadow:0 2px 8px rgba(46,47,44,0.04)',
    'opacity:0.6',
  ].join(';');

  const iconEl = document.createElement('div');
  iconEl.style.cssText = 'flex-shrink:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;';
  iconEl.innerHTML = PALETTE_SVG;

  const textWrap = document.createElement('div');
  textWrap.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;';

  const title = document.createElement('div');
  title.textContent = 'Themes';
  title.style.cssText = `font-family:${FONT_HEADING};font-size:14px;font-weight:600;color:${C_TEXT};line-height:1.3;`;

  const sub = document.createElement('div');
  sub.style.cssText = [
    `font-family:${FONT_HEADING}`, 'font-size:12px', 'font-weight:500',
    `color:${C_TEXT_SEC}`,
    'display:flex', 'align-items:center',
  ].join(';');
  sub.innerHTML = `${LOCK_SVG}<span>Coming Soon</span>`;

  textWrap.appendChild(title);
  textWrap.appendChild(sub);

  card.appendChild(iconEl);
  card.appendChild(textWrap);

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

  // Top bar — single flex row that contains title (centered) and close button
  // (absolute). Same pattern as the in-game top bar: env+12 top padding,
  // 44px content height, padding-left/right:16. Because both children live in
  // this one relative flex container, vertical alignment is guaranteed.
  const topBar = document.createElement('div');
  topBar.style.cssText = [
    'position:relative',
    'display:flex', 'align-items:center', 'justify-content:center',
    'height:44px',
    'padding-top:calc(env(safe-area-inset-top, 0px) + 12px)',
    'padding-left:16px', 'padding-right:16px',
    'box-sizing:content-box',
    'flex-shrink:0',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'Shop';
  title.style.cssText = [
    `font-family:${FONT_HEADING}`, 'font-size:22px', 'font-weight:700',
    `color:${C_TEXT}`, 'letter-spacing:-0.01em',
  ].join(';');

  // Close button — matches the in-game Reset button: 40x40 recessed circle.
  // Absolute inside the row; top/bottom + margin:auto vertically centers it
  // in the 44px content area so no independent top offset is needed.
  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('aria-label', 'Close shop');
  closeBtn.innerHTML = CLOSE_X_SVG;
  closeBtn.style.cssText = [
    'position:absolute',
    'top:calc(env(safe-area-inset-top, 0px) + 12px)', 'bottom:0',
    'right:16px', 'margin:auto 0',
    'width:40px', 'height:40px',
    'display:flex', 'align-items:center', 'justify-content:center',
    `background:${C_RECESSED}`, 'border:none', 'padding:0',
    'border-radius:9999px',
    `color:${C_TEXT}`, 'cursor:pointer',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'outline:none',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  ].join(';');
  attachPress(closeBtn);
  closeBtn.addEventListener('click', () => { playButtonTap(); hideShop(); });

  topBar.appendChild(title);
  topBar.appendChild(closeBtn);

  // Scroll area — 28px top padding preserves the spacing under the title that
  // previously lived on the title's margin-bottom.
  scrollEl = document.createElement('div');
  scrollEl.style.cssText = [
    'flex:1', 'overflow-y:auto', '-webkit-overflow-scrolling:touch',
    'overscroll-behavior:contain',
    'padding:28px 20px calc(env(safe-area-inset-bottom, 0px) + 32px)',
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
