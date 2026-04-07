// Level select screen — winding path map layout

import { getLevelCount, getCurrentLevel } from '../levels/levels.ts';
import { playButtonTap } from '../audio/audio.ts';
import { addPressFeedback } from './overlay.ts';
import { initSettings, showSettings } from './settings.ts';
import { FONT, FONT_HEADING, C_TEXT, C_TEXT_SEC, C_RECESSED } from '../constants.ts';

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_UNLOCKED = 'untrace_unlocked';
const LS_STARS    = 'untrace_stars';

// Node dimensions
const NODE_SIZE    = 64;  // px diameter, standard
const NODE_CURRENT = 78;  // px diameter, active level
const V_SPACING    = 120; // px between node centers vertically
const TOP_PAD      = 28;  // px above first node center
const BOT_PAD      = 72;  // px below last node bottom

// X-positions per level, designed to create angular interest via straight connecting lines.
// Each group uses a distinct positional rhythm; no two adjacent groups share the same feel.
const X_PATTERN = [
  // Group 1 (1–5) — gradual diagonal drift, starting near center-left
  0.37, 0.48, 0.58, 0.68, 0.78,
  // Group 2 (6–8) — sharp zigzag, wide horizontal spacing
  0.12, 0.88, 0.14,
  // Group 3 (9–12) — clustered near center with small offsets
  0.42, 0.54, 0.44, 0.56,
  // Group 4 (13–16) — wide swings, far left ↔ far right
  0.10, 0.90, 0.10, 0.90,
  // Group 5 (17–20) — staircase: step right, then drop left
  0.25, 0.42, 0.60, 0.18,
  // Group 6 (21–24) — tight snake near center
  0.40, 0.56, 0.42, 0.58,
  // Group 7 (25–30) — wide sweeping diagonal then snap back left
  0.14, 0.32, 0.55, 0.74, 0.88, 0.20,
];

// ─── Persistence ──────────────────────────────────────────────────────────────

function loadUnlockedUpTo(): number {
  return Math.max(0, parseInt(localStorage.getItem(LS_UNLOCKED) ?? '0', 10) || 0);
}

function saveUnlockedUpTo(index: number): void {
  if (index > loadUnlockedUpTo()) {
    localStorage.setItem(LS_UNLOCKED, String(index));
  }
}

function loadStars(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_STARS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

function persistStars(levelIndex: number, stars: number): void {
  const level = getCurrentLevel(levelIndex);
  const map   = loadStars();
  if (stars > (map[level.id] ?? 0)) {
    map[level.id] = stars;
    localStorage.setItem(LS_STARS, JSON.stringify(map));
  }
}

function getTotalStars(): number {
  const map = loadStars();
  return Object.values(map).reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0);
}

// ─── Module state ─────────────────────────────────────────────────────────────

let overlayEl:  HTMLDivElement | null = null;
let pathEl:     HTMLDivElement | null = null;
let onSelectCb: ((index: number) => void) | null = null;

// ─── CSS injection ────────────────────────────────────────────────────────────

let _stylesInjected = false;
function injectStyles(): void {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = [
    '@keyframes ls-pulse {',
    '  0%,100% { transform:scale(1.0); }',
    '  50%      { transform:scale(1.08); }',
    '}',
  ].join('\n');
  document.head.appendChild(s);
}

// ─── Star SVG ─────────────────────────────────────────────────────────────────

// Font Awesome solid star path (viewBox 0 0 576 512). The top tip reaches y≈−19
// which is outside the original viewBox, so we expand it and use overflow="visible"
// + vector-effect="non-scaling-stroke" so the 3 px stroke is never clipped.
const FA_STAR_PATH = 'M309.5-18.9c-4.1-8-12.4-13.1-21.4-13.1s-17.3 5.1-21.4 13.1L193.1 125.3 33.2 150.7c-8.9 1.4-16.3 7.7-19.1 16.3s-.5 18 5.8 24.4l114.4 114.5-25.2 159.9c-1.4 8.9 2.3 17.9 9.6 23.2s16.9 6.1 25 2L288.1 417.6 432.4 491c8 4.1 17.7 3.3 25-2s11-14.2 9.6-23.2L441.7 305.9 556.1 191.4c6.4-6.4 8.6-15.8 5.8-24.4s-10.1-14.9-19.1-16.3L383 125.3 309.5-18.9z';

function starSVG(size: number, strokeW: number, strokeColor: string, gradId: string): string {
  return `<svg width="${size}" height="${size}" viewBox="-3 -21 582 536" overflow="visible">`
    + `<defs><radialGradient id="${gradId}" cx="50%" cy="30%" r="65%">`
    + `<stop offset="0%" stop-color="#ffbe0b"/>`
    + `<stop offset="100%" stop-color="#f59e0b"/>`
    + `</radialGradient></defs>`
    + `<path d="${FA_STAR_PATH}" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="${strokeW}" vector-effect="non-scaling-stroke"/>`
    + `</svg>`;
}

// ─── Path rendering ───────────────────────────────────────────────────────────

function getNodeX(index: number, pathWidth: number, radius: number): number {
  const frac    = X_PATTERN[index % X_PATTERN.length]!;
  const minEdge = radius + 24;
  return Math.max(minEdge, Math.min(pathWidth - minEdge, frac * pathWidth));
}

function renderPath(): void {
  if (!pathEl) return;

  const count    = getLevelCount();
  const starsMap = loadStars();

  function isUnlocked(i: number): boolean {
    if (i === 0) return true;
    return (starsMap[getCurrentLevel(i - 1).id] ?? 0) > 0;
  }

  // First unlocked-but-not-yet-completed level is "current"
  let currentIdx = -1;
  for (let i = 0; i < count; i++) {
    if (isUnlocked(i) && (starsMap[getCurrentLevel(i).id] ?? 0) === 0) {
      currentIdx = i;
      break;
    }
  }

  pathEl.innerHTML = '';

  const pathWidth  = pathEl.offsetWidth || 320;
  const nodeRadius = NODE_SIZE / 2;
  const minHeight  = TOP_PAD + nodeRadius + (count - 1) * V_SPACING + nodeRadius + 32 + BOT_PAD;
  pathEl.style.minHeight = `${minHeight}px`;

  // Compute center positions for every node
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const isCurrent = i === currentIdx;
    const radius    = (isCurrent ? NODE_CURRENT : NODE_SIZE) / 2;
    positions.push({
      x: getNodeX(i, pathWidth, radius),
      y: TOP_PAD + nodeRadius + i * V_SPACING,
    });
  }

  // ── SVG connecting lines (z-index:1, behind nodes) ────────────────────────
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg   = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width',  String(pathWidth));
  svg.setAttribute('height', String(minHeight));
  svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:1;overflow:visible;';

  // Gradient for completed segments using objectBoundingBox so it applies to a
  // rect fill rather than a path stroke. iOS Safari does not reliably render
  // linearGradient on strokes, but fill gradients work correctly.
  // objectBoundingBox: x1=0 maps to the rect's left edge (upper node after
  // rotation), x2=1 maps to right edge (lower node). Since a.y < b.y always,
  // gold is always at the earlier/higher node and orange at the lower node.
  const defs = document.createElementNS(svgNS, 'defs');
  const grad = document.createElementNS(svgNS, 'linearGradient');
  grad.setAttribute('id',            'ls-comp-grad');
  grad.setAttribute('gradientUnits', 'objectBoundingBox');
  grad.setAttribute('x1',           '0');
  grad.setAttribute('y1',           '0.5');
  grad.setAttribute('x2',           '1');
  grad.setAttribute('y2',           '0.5');
  const stop1 = document.createElementNS(svgNS, 'stop');
  stop1.setAttribute('offset',     '0%');
  stop1.setAttribute('stop-color', '#ffbe0b');
  const stop2 = document.createElementNS(svgNS, 'stop');
  stop2.setAttribute('offset',     '100%');
  stop2.setAttribute('stop-color', '#fb5607');
  grad.appendChild(stop1);
  grad.appendChild(stop2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  for (let i = 0; i < count - 1; i++) {
    const a         = positions[i]!;
    const b         = positions[i + 1]!;
    const aStars    = starsMap[getCurrentLevel(i).id] ?? 0;
    const bStars    = starsMap[getCurrentLevel(i + 1).id] ?? 0;
    const completed = aStars > 0 && bStars > 0;
    const thick     = 4; // px — visual line thickness

    if (completed) {
      // Rotated rect: centered at midpoint, width = segment length, height = thick.
      // The gradient runs along the rect's local x-axis; after rotation it aligns
      // with the line direction, so gold always appears at the upper node.
      const dx    = b.x - a.x;
      const dy    = b.y - a.y;
      const len   = Math.sqrt(dx * dx + dy * dy);
      const cx    = (a.x + b.x) / 2;
      const cy    = (a.y + b.y) / 2;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x',         String(cx - len / 2));
      rect.setAttribute('y',         String(cy - thick / 2));
      rect.setAttribute('width',     String(len));
      rect.setAttribute('height',    String(thick));
      rect.setAttribute('rx',        String(thick / 2));
      rect.setAttribute('transform', `rotate(${angle} ${cx} ${cy})`);
      rect.setAttribute('fill',      'url(#ls-comp-grad)');
      svg.appendChild(rect);
    } else {
      const line = document.createElementNS(svgNS, 'path');
      line.setAttribute('d',              `M ${a.x} ${a.y} L ${b.x} ${b.y}`);
      line.setAttribute('stroke',         '#f0d2a8');
      line.setAttribute('stroke-width',   String(thick));
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('fill',           'none');
      svg.appendChild(line);
    }
  }
  pathEl.appendChild(svg);

  // ── Level nodes ───────────────────────────────────────────────────────────
  for (let i = 0; i < count; i++) {
    const pos       = positions[i]!;
    const levelData = getCurrentLevel(i);
    const locked    = !isUnlocked(i);
    const stars     = starsMap[levelData.id] ?? 0;
    const completed = stars > 0;
    const isCurrent = i === currentIdx;
    const nodeSize  = isCurrent ? NODE_CURRENT : NODE_SIZE;
    const radius    = nodeSize / 2;

    // Visual state
    let bgGrad:      string;
    let borderColor: string;
    let borderWidth: string;
    let textColor:   string;
    let shadow:      string;

    // Depth overlay stacked above every base color: highlight top-left, shadow bottom-right
    const DEPTH = 'radial-gradient(ellipse at 30% 25%, rgba(255,255,255,0.30) 0%, transparent 65%),'
      + 'radial-gradient(ellipse at 72% 78%, rgba(0,0,0,0.05) 0%, transparent 60%),';

    if (locked) {
      bgGrad      = `${DEPTH}radial-gradient(circle at 35% 30%, #e8d8c2, #d8c4a0)`;
      borderColor = '#b8a5d4';
      borderWidth = '4px';
      textColor   = '#c4b49a';
      shadow      = '0 3px 6px rgba(0,0,0,0.1)';
    } else if (completed) {
      const bc = stars >= 3 ? '#ffbe0b' : '#fb5607';
      bgGrad      = `${DEPTH}radial-gradient(circle at 35% 30%, #fcecd8, #f0d2a8)`;
      borderColor = bc;
      borderWidth = '4px';
      textColor   = C_TEXT;
      shadow      = '0 3px 6px rgba(0,0,0,0.1)';
    } else if (isCurrent) {
      bgGrad      = `${DEPTH}radial-gradient(circle at 35% 30%, #ffffff, #ffe6f4)`;
      borderColor = '#ff006e';
      borderWidth = '4px';
      textColor   = '#ff006e';
      shadow      = '0 0 12px rgba(255,0,110,0.5), 0 3px 6px rgba(0,0,0,0.1)';
    } else {
      bgGrad      = `${DEPTH}radial-gradient(circle at 35% 30%, #fffff2, #f4f0da)`;
      borderColor = '#d3cfc4';
      borderWidth = '3px';
      textColor   = C_TEXT;
      shadow      = '0 3px 6px rgba(0,0,0,0.1)';
    }

    // Wrapper — absolute, centered at pos
    const wrapper = document.createElement('div');
    wrapper.style.cssText = [
      'position:absolute',
      `left:${pos.x}px`,
      `top:${pos.y}px`,
      'transform:translate(-50%,-50%)',
      'display:flex', 'flex-direction:column', 'align-items:center',
      `cursor:${locked ? 'default' : 'pointer'}`,
      '-webkit-tap-highlight-color:transparent',
      'touch-action:manipulation',
      'z-index:3',
    ].join(';');

    // Node circle
    const node = document.createElement('div');
    node.style.cssText = [
      `width:${nodeSize}px`, `height:${nodeSize}px`,
      'border-radius:50%',
      'flex-shrink:0',
      `background:${bgGrad}`,
      `border:${borderWidth} solid ${borderColor}`,
      'display:flex', 'align-items:center', 'justify-content:center',
      `box-shadow:${shadow}`,
      'position:relative', 'z-index:2',
      ...(isCurrent ? ['animation:ls-pulse 1s ease-in-out infinite'] : []),
    ].join(';');

    if (locked) {
      node.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" '
        + `stroke="${textColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">`
        + '<rect x="3" y="11" width="18" height="11" rx="2"/>'
        + '<path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
    } else {
      const num = document.createElement('span');
      num.textContent = String(i + 1);
      num.style.cssText = [
        `color:${textColor}`,
        `font-size:${isCurrent ? '24px' : '22px'}`, 'font-weight:700',
        `font-family:${FONT_HEADING}`,
        'line-height:1', 'user-select:none',
      ].join(';');
      node.appendChild(num);
    }

    wrapper.appendChild(node);

    // Earned stars — appended to pathEl (not wrapper) so they sit in the same
    // stacking context as the node circles. z-index:5 > circles' z-index:3 means
    // stars always render on top regardless of which circle they overlap.
    if (completed && stars > 0) {
      const starsRow = document.createElement('div');
      starsRow.style.cssText = [
        'position:absolute',
        `left:${pos.x}px`,
        `top:${pos.y + radius - Math.round(radius * 0.28)}px`,
        'transform:translateX(-50%)',
        'display:flex', 'gap:2px', 'align-items:center', 'justify-content:center',
        'z-index:5',
        'pointer-events:none',
      ].join(';');
      for (let s = 0; s < stars; s++) {
        const starEl = document.createElement('div');
        // For 3-star levels: arc the outer stars 3px above the center star
        const yOff = (stars === 3 && s !== 1) ? -3 : 0;
        starEl.style.cssText = `display:inline-flex;${yOff ? `transform:translateY(${yOff}px);` : ''}`;
        starEl.innerHTML = starSVG(22, 3, '#b17025', `lsstar-${i}-${s}`);
        starsRow.appendChild(starEl);
      }
      pathEl.appendChild(starsRow);
    }

    // Interaction (unlocked only)
    if (!locked) {
      addPressFeedback(node);
      wrapper.addEventListener('click', () => {
        if (onSelectCb) { playButtonTap(); hideLevelSelect(); onSelectCb(i); }
      });
    }

    pathEl.appendChild(wrapper);
  }
}

// ─── Build overlay ────────────────────────────────────────────────────────────

function buildOverlay(ui: HTMLElement): void {
  injectStyles();

  overlayEl = document.createElement('div');
  overlayEl.style.cssText = [
    'position:fixed', 'inset:0',
    'background:linear-gradient(180deg, #f5d0c0 0%, #f0b8b0 50%, #e8a8a0 100%)',
    'z-index:50',
    'display:flex', 'flex-direction:column',
    'overflow:hidden',
    'opacity:0',
    'transform:translateY(8px)',
    'pointer-events:none',
    'transition:opacity 0.22s ease, transform 0.22s ease',
    'will-change:opacity,transform',
  ].join(';');

  // ── Top bar ───────────────────────────────────────────────────────────────
  // Floats above the scroll area (position:absolute) so content slides beneath
  // it. A backdrop child transitions in when the user scrolls down.
  const topBar = document.createElement('div');
  topBar.style.cssText = [
    'position:absolute', 'top:0', 'left:0', 'right:0',
    'padding-top:calc(env(safe-area-inset-top,0px) + 14px)',
    'padding-bottom:14px',
    'padding-left:20px', 'padding-right:20px',
    'background:transparent',
    'display:flex', 'align-items:center',
    'z-index:11',
  ].join(';');

  // Frosted backdrop — fades in when scroll content reaches the bar
  const topBarBackdrop = document.createElement('div');
  topBarBackdrop.style.cssText = [
    'position:absolute', 'inset:0',
    'background:rgba(245,200,190,0.7)',
    '-webkit-backdrop-filter:blur(12px)',
    'backdrop-filter:blur(12px)',
    'opacity:0',
    'transition:opacity 0.2s ease',
    'pointer-events:none',
    'z-index:-1',
  ].join(';');
  topBar.appendChild(topBarBackdrop);

  // Star counter (left, flex:1) — frosted pill chip
  const starCounter = document.createElement('div');
  starCounter.style.cssText = 'flex:1;display:flex;align-items:center;';
  const starChip = document.createElement('div');
  starChip.style.cssText = [
    'display:flex', 'align-items:center', 'gap:5px',
    'background:rgba(255,255,255,0.55)',
    '-webkit-backdrop-filter:blur(8px)', 'backdrop-filter:blur(8px)',
    'border-radius:20px', 'padding:6px 14px',
    'border:1px solid rgba(255,255,255,0.3)',
  ].join(';');
  const starIconEl = document.createElement('div');
  starIconEl.style.cssText = 'display:inline-flex;flex-shrink:0;';
  starIconEl.innerHTML = starSVG(22, 3, '#b17025', 'ls-topstar');
  const starCountText = document.createElement('span');
  starCountText.style.cssText = [
    `color:${C_TEXT}`, 'font-size:16px', 'font-weight:700',
    `font-family:${FONT}`, 'user-select:none', 'line-height:1',
  ].join(';');
  starCountText.textContent = `\u00D7\u00A0${getTotalStars()}`;
  starChip.appendChild(starIconEl);
  starChip.appendChild(starCountText);
  starCounter.appendChild(starChip);

  // Title + world name (center, flex:0)
  const titleWrap = document.createElement('div');
  titleWrap.style.cssText = 'flex:0;text-align:center;';

  const titleEl = document.createElement('div');
  const levelCount = getLevelCount();
  let worldNum = 1;
  if (levelCount > 0) worldNum = getCurrentLevel(0).world;
  titleEl.style.cssText = [
    `color:${C_TEXT}`, 'font-size:18px', 'font-weight:700',
    `font-family:${FONT}`, 'user-select:none', 'line-height:1',
  ].join(';');

  titleEl.textContent = `World ${worldNum}`;

  titleWrap.appendChild(titleEl);

  // Gear button (right, flex:1 end-aligned)
  const rightCol = document.createElement('div');
  rightCol.style.cssText = 'flex:1;display:flex;justify-content:flex-end;align-items:center;';

  const gearBtn = document.createElement('button');
  gearBtn.setAttribute('aria-label', 'Open settings');
  gearBtn.style.cssText = [
    'width:40px', 'height:40px',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:rgba(255,255,255,0.45)',
    '-webkit-backdrop-filter:blur(8px)', 'backdrop-filter:blur(8px)',
    'border:1px solid rgba(255,255,255,0.3)', 'border-radius:50%',
    'padding:0', 'cursor:pointer', 'outline:none',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  ].join(';');
  gearBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20">'
    + '<path fill="#b17025" d="M195.1 9.5C198.1-5.3 211.2-16 226.4-16l59.8 0c15.2 0 28.3 10.7 31.3 25.5L332 79.5c14.1 6 27.3 13.7 39.3 22.8l67.8-22.5c14.4-4.8 30.2 1.2 37.8 14.4l29.9 51.8c7.6 13.2 4.9 29.8-6.5 39.9L447 233.3c.9 7.4 1.3 15 1.3 22.7s-.5 15.3-1.3 22.7l53.4 47.5c11.4 10.1 14 26.8 6.5 39.9l-29.9 51.8c-7.6 13.1-23.4 19.2-37.8 14.4l-67.8-22.5c-12.1 9.1-25.3 16.7-39.3 22.8l-14.4 69.9c-3.1 14.9-16.2 25.5-31.3 25.5l-59.8 0c-15.2 0-28.3-10.7-31.3-25.5l-14.4-69.9c-14.1-6-27.2-13.7-39.3-22.8L73.5 432.3c-14.4 4.8-30.2-1.2-37.8-14.4L5.8 366.1c-7.6-13.2-4.9-29.8 6.5-39.9l53.4-47.5c-.9-7.4-1.3-15-1.3-22.7s.5-15.3 1.3-22.7L12.3 185.8c-11.4-10.1-14-26.8-6.5-39.9L35.7 94.1c7.6-13.2 23.4-19.2 37.8-14.4l67.8 22.5c12.1-9.1 25.3-16.7 39.3-22.8L195.1 9.5zM256.3 336a80 80 0 1 0 -.6-160 80 80 0 1 0 .6 160z"/>'
    + '</svg>';
  addPressFeedback(gearBtn);
  gearBtn.addEventListener('click', () => { playButtonTap(); showSettings(); });
  rightCol.appendChild(gearBtn);

  topBar.appendChild(starCounter);
  topBar.appendChild(titleWrap);
  topBar.appendChild(rightCol);

  // ── Scroll area with dot-grid background ─────────────────────────────────
  // flex:1 fills the full overlay (topBar is position:absolute, out of flow).
  // padding-top pushes initial content below the floating topBar.
  const scroll = document.createElement('div');
  scroll.style.cssText = [
    'flex:1',
    'overflow-y:auto',
    '-webkit-overflow-scrolling:touch',
    'padding-top:calc(env(safe-area-inset-top,0px) + 72px)',
    'position:relative',
    'background-image:radial-gradient(circle, rgba(161,129,104,0.10) 2px, transparent 2px)',
    'background-size:30px 30px',
  ].join(';');

  // Trigger topBar frosted backdrop when scroll content slides under the bar
  scroll.addEventListener('scroll', () => {
    topBarBackdrop.style.opacity = scroll.scrollTop > 8 ? '1' : '0';
  }, { passive: true });

  pathEl = document.createElement('div');
  pathEl.style.cssText = 'position:relative;width:100%;';

  // Vignette: sticky at viewport top, overlays path, draws eye toward center
  const vignette = document.createElement('div');
  vignette.style.cssText = [
    'position:sticky', 'top:0', 'left:0',
    'width:100%', 'height:100vh',
    'margin-bottom:-100vh',
    'pointer-events:none',
    'z-index:10',
    'background:radial-gradient(ellipse at 50% 50%, transparent 42%, rgba(240,210,168,0.30) 100%)',
  ].join(';');

  scroll.appendChild(pathEl);
  scroll.appendChild(vignette);
  overlayEl.appendChild(topBar);
  overlayEl.appendChild(scroll);
  ui.appendChild(overlayEl);
}

// ─── Show / hide ──────────────────────────────────────────────────────────────

export function showLevelSelect(): void {
  if (!overlayEl) return;
  renderPath();
  overlayEl.style.pointerEvents = 'auto';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (overlayEl) {
        overlayEl.style.opacity   = '1';
        overlayEl.style.transform = 'translateY(0)';
      }
    });
  });
}

export function hideLevelSelect(): void {
  if (!overlayEl) return;
  overlayEl.style.opacity       = '0';
  overlayEl.style.transform     = 'translateY(8px)';
  overlayEl.style.pointerEvents = 'none';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function initLevelSelect(onSelect: (index: number) => void): void {
  const ui = document.getElementById('ui')!;
  onSelectCb = onSelect;
  buildOverlay(ui);
  initSettings();
}

export function setCurrentLevel(_index: number): void {
  // Derived from star data in renderPath(); no state needed here.
}

export function completedLevel(index: number, stars: number): void {
  persistStars(index, stars);
  saveUnlockedUpTo(index + 1);
}

export function getUnlockedLevel(): number {
  return loadUnlockedUpTo();
}
