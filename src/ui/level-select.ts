// Level select screen — winding path map layout

import { getLevelCount, getCurrentLevel } from '../levels/levels.ts';
import { playButtonTap } from '../audio/audio.ts';
import { addPressFeedback } from './overlay.ts';
import { getSparkCount as sparksGetSparkCount } from '../sparks.ts';
import { initSettings, showSettings } from './settings.ts';
import { showShop } from './shop.ts';
import { FONT, FONT_HEADING, C_TEXT } from '../constants.ts';

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_UNLOCKED = 'untrace_unlocked';
const LS_STARS    = 'untrace_stars';
const LS_SPARKS   = 'untrace_sparks';
const LS_STARS_OVERRIDE = 'untrace_stars_override';

// Node dimensions
const NODE_SIZE    = 64;  // px diameter, standard
const NODE_CURRENT = 78;  // px diameter, active level
const V_SPACING    = 110; // px between node centers vertically
const TOP_PAD      = 140; // px above first node center (room for World chip)

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
  const override = localStorage.getItem(LS_STARS_OVERRIDE);
  if (override !== null) {
    const n = parseInt(override, 10);
    if (!isNaN(n)) return n;
  }
  const map = loadStars();
  return Object.values(map).reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0);
}

function getSparkCount(): number {
  return sparksGetSparkCount();
}

// ─── Module state ─────────────────────────────────────────────────────────────

let overlayEl:      HTMLDivElement | null = null;
let pathEl:         HTMLDivElement | null = null;
let starCountTextEl: HTMLSpanElement | null = null;
let sparkCountTextEl: HTMLSpanElement | null = null;
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

// Lightning bolt (Font Awesome bolt, viewBox 0 0 448 512)
const FA_BOLT_PATH = 'M338.8-9.9c11.9 8.6 16.3 24.2 10.9 37.8L271.3 224 416 224c13.5 0 25.5 8.4 30.1 21.1s.7 26.9-9.6 35.5l-288 240c-11.3 9.4-27.4 9.9-39.3 1.3s-16.3-24.2-10.9-37.8L176.7 288 32 288c-13.5 0-25.5-8.4-30.1-21.1s-.7-26.9 9.6-35.5l288-240c11.3-9.4 27.4-9.9 39.3-1.3z';

function sparkSVG(size: number, strokeW: number, strokeColor: string, gradId: string): string {
  return `<svg width="${size}" height="${size}" viewBox="-3 -13 454 528" overflow="visible">`
    + `<defs><linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">`
    + `<stop offset="0%" stop-color="#00bcd4"/>`
    + `<stop offset="100%" stop-color="#2196f3"/>`
    + `</linearGradient></defs>`
    + `<path d="${FA_BOLT_PATH}" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="${strokeW}" vector-effect="non-scaling-stroke"/>`
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

  const totalCount = getLevelCount();
  const starsMap   = loadStars();

  // Find where World 1 ends (first level with world !== 1)
  let w1Count = totalCount;
  for (let i = 0; i < totalCount; i++) {
    if (getCurrentLevel(i).world !== 1) { w1Count = i; break; }
  }

  // World 2 is only visible once the last World 1 level is completed
  const w1LastCompleted = w1Count > 0 && (starsMap[getCurrentLevel(w1Count - 1).id] ?? 0) > 0;
  const count = w1LastCompleted ? totalCount : w1Count;

  function isUnlocked(i: number): boolean {
    if (i === 0) return true;
    // World boundary: first World 2 level requires star-gate
    if (i === w1Count) {
      return w1LastCompleted && getTotalStars() >= 30;
    }
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

  // Compute center positions for every node (add vertical gap for world chips)
  const W_CHIP_GAP = 142; // extra vertical space for a world divider chip
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const isCurrent = i === currentIdx;
    const radius    = (isCurrent ? NODE_CURRENT : NODE_SIZE) / 2;
    const worldOffset = i >= w1Count ? W_CHIP_GAP : 0;
    positions.push({
      x: getNodeX(i, pathWidth, radius),
      y: TOP_PAD + nodeRadius + i * V_SPACING + worldOffset,
    });
  }

  // Total height: last node + space for stars + World 2 chip + bottom padding
  const lastNodeY = positions.length > 0 ? positions[positions.length - 1]!.y : 0;
  const totalHeight = lastNodeY + 200;
  pathEl.style.minHeight = `${totalHeight}px`;

  // ── SVG connecting lines (z-index:1, behind nodes) ────────────────────────
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg   = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width',  String(pathWidth));
  svg.setAttribute('height', String(totalHeight));
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
    // No line between the last World 1 level and the first World 2 level
    if (i === w1Count - 1 && i + 1 === w1Count) continue;

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
      const aLocked = !isUnlocked(i);
      const bLocked = !isUnlocked(i + 1);
      const line = document.createElementNS(svgNS, 'path');
      line.setAttribute('d',              `M ${a.x} ${a.y} L ${b.x} ${b.y}`);
      line.setAttribute('stroke',         '#f0d2a8');
      line.setAttribute('stroke-width',   String(thick));
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('fill',           'none');
      if (aLocked && bLocked) line.setAttribute('opacity', '0.5');
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
      borderColor = '#e8d8c2';
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
      num.textContent = String(i >= w1Count ? i - w1Count + 1 : i + 1);
      num.style.cssText = [
        `color:${textColor}`,
        `font-size:${isCurrent ? '31px' : '29px'}`, 'font-weight:700',
        "font-family:'Lexend'",
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

  // ── World 1 chip (decorative, centered above level 1) ──────────────────────
  const worldNum = count > 0 ? getCurrentLevel(0).world : 1;
  const w1Chip = document.createElement('div');
  w1Chip.style.cssText = [
    'position:absolute', 'top:30px', 'left:50%', 'transform:translateX(-50%)',
    'background:rgba(255,255,255,0.25)',
    '-webkit-backdrop-filter:blur(8px)', 'backdrop-filter:blur(8px)',
    'border-radius:20px', 'padding:12px 32px',
    'border:2.5px solid rgba(255,255,255,0.7)',
    'box-shadow:0 4px 12px rgba(0,0,0,0.08)',
    'z-index:4', 'pointer-events:none', 'user-select:none',
    'white-space:nowrap',
  ].join(';');
  const w1Text = document.createElement('span');
  w1Text.textContent = `World ${worldNum}`;
  w1Text.style.cssText = [
    `font-family:${FONT_HEADING}`, 'font-size:22px', 'font-weight:700',
    `color:${C_TEXT}`, 'line-height:1',
  ].join(';');
  w1Chip.appendChild(w1Text);
  pathEl.appendChild(w1Chip);

  // ── World 2 chip (between World 1 and World 2 levels) ──────────────────────
  if (w1Count < totalCount) {
    const w2StarGateOk = w1LastCompleted && getTotalStars() >= 30;
    const w1LastY = positions.length > 0 && w1Count > 0 ? positions[w1Count - 1]!.y : lastNodeY;
    const w2FirstY = w1Count < count ? positions[w1Count]!.y : w1LastY + V_SPACING + W_CHIP_GAP;
    // Match the W1 chip-to-first-level gap: W1 chip top is 30px, first W1 level center is
    // TOP_PAD + nodeRadius = 172px, so the gap is 142px. Place W2 chip 142px above first W2 level.
    const w2ChipY = w2FirstY - (TOP_PAD + nodeRadius - 30);

    const w2Chip = document.createElement('div');
    w2Chip.style.cssText = [
      'position:absolute',
      `top:${w2ChipY}px`,
      'left:50%', 'transform:translateX(-50%)',
      'background:rgba(255,255,255,0.25)',
      '-webkit-backdrop-filter:blur(8px)', 'backdrop-filter:blur(8px)',
      'border-radius:20px', 'padding:12px 32px',
      'border:2.5px solid rgba(255,255,255,0.7)',
      'box-shadow:0 4px 12px rgba(0,0,0,0.08)',
      'z-index:4', 'pointer-events:none', 'user-select:none',
      'white-space:nowrap',
      `opacity:${w2StarGateOk ? '1' : '0.4'}`,
    ].join(';');
    const w2Text = document.createElement('span');
    w2Text.textContent = 'World 2';
    w2Text.style.cssText = [
      `font-family:${FONT_HEADING}`, 'font-size:22px', 'font-weight:700',
      `color:${C_TEXT}`, 'line-height:1',
    ].join(';');
    w2Chip.appendChild(w2Text);
    pathEl.appendChild(w2Chip);
  }

  // ── World 3 chip (always locked, after last visible level) ────────────────
  if (w1LastCompleted && count > w1Count) {
    const w3ChipY = lastNodeY + 80;
    const w3Chip = document.createElement('div');
    w3Chip.style.cssText = [
      'position:absolute',
      `top:${w3ChipY}px`,
      'left:50%', 'transform:translateX(-50%)',
      'background:rgba(255,255,255,0.25)',
      '-webkit-backdrop-filter:blur(8px)', 'backdrop-filter:blur(8px)',
      'border-radius:20px', 'padding:12px 32px',
      'border:2.5px solid rgba(255,255,255,0.7)',
      'box-shadow:0 4px 12px rgba(0,0,0,0.08)',
      'z-index:4', 'pointer-events:none', 'user-select:none',
      'white-space:nowrap',
      'opacity:0.4',
    ].join(';');
    const w3Text = document.createElement('span');
    w3Text.textContent = 'World 3';
    w3Text.style.cssText = [
      `font-family:${FONT_HEADING}`, 'font-size:22px', 'font-weight:700',
      `color:${C_TEXT}`, 'line-height:1',
    ].join(';');
    w3Chip.appendChild(w3Text);
    pathEl.appendChild(w3Chip);
  }

  // ── "More worlds coming soon!" chip ────────────────────────────────────────
  // Only show when the last world in the path has its level nodes actually
  // rendered in the DOM. If a placeholder world chip (e.g. W3, which has no
  // level data) is sitting below the final level as the last thing on the
  // path, do not render this chip — the last world is effectively "locked"
  // from the player's perspective because no level nodes exist below it.
  const w3PlaceholderShown = w1LastCompleted && count > w1Count;
  if (count === totalCount && !w3PlaceholderShown) {
    // Position directly below the final level
    const mwChipY = lastNodeY + 80;
    const mwChip = document.createElement('div');
    mwChip.style.cssText = [
      'position:absolute',
      `top:${mwChipY}px`,
      'left:50%', 'transform:translateX(-50%)',
      'background:rgba(255,255,255,0.25)',
      '-webkit-backdrop-filter:blur(8px)', 'backdrop-filter:blur(8px)',
      'border-radius:20px', 'padding:10px 24px',
      'border:2.5px solid rgba(255,255,255,0.7)',
      'box-shadow:0 4px 12px rgba(0,0,0,0.08)',
      'z-index:4', 'pointer-events:none', 'user-select:none',
      'white-space:nowrap', 'opacity:0.4',
      'display:flex', 'align-items:center', 'gap:6px',
    ].join(';');
    const mwStar = document.createElement('div');
    mwStar.style.cssText = 'display:inline-flex;flex-shrink:0;';
    mwStar.innerHTML = starSVG(14, 2, '#b17025', 'ls-mw-star');
    const mwText = document.createElement('span');
    mwText.textContent = 'More worlds coming soon!';
    mwText.style.cssText = [
      `font-family:${FONT_HEADING}`, 'font-size:15px', 'font-weight:600',
      `color:${C_TEXT}`, 'line-height:1',
    ].join(';');
    mwChip.appendChild(mwStar);
    mwChip.appendChild(mwText);
    pathEl.appendChild(mwChip);

    // Extend the scrollable area if needed so the chip is fully visible
    if (mwChipY + 60 > totalHeight) {
      pathEl.style.minHeight = `${mwChipY + 60}px`;
    }
  }
}

// ─── Build overlay ────────────────────────────────────────────────────────────

function buildOverlay(ui: HTMLElement): void {
  injectStyles();

  overlayEl = document.createElement('div');
  overlayEl.style.cssText = [
    'position:fixed', 'inset:0',
    'background:#e8a8a0',
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

  // Star counter (left, flex:1) — frosted pill chip
  const starCounter = document.createElement('div');
  starCounter.style.cssText = 'flex:1;display:flex;align-items:center;';
  const starChip = document.createElement('div');
  starChip.style.cssText = [
    'display:flex', 'align-items:center', 'gap:5px',
    'height:40px', 'box-sizing:border-box',
    'background:rgba(255,255,255,0.55)',
    '-webkit-backdrop-filter:blur(8px)', 'backdrop-filter:blur(8px)',
    'border-radius:20px', 'padding:0 14px',
    'border:1px solid rgba(255,255,255,0.3)',
  ].join(';');
  const starIconEl = document.createElement('div');
  starIconEl.style.cssText = 'display:inline-flex;flex-shrink:0;';
  starIconEl.innerHTML = starSVG(20, 2, '#b17025', 'ls-topstar');
  starCountTextEl = document.createElement('span');
  starCountTextEl.style.cssText = [
    `color:${C_TEXT}`, 'font-size:15px', 'font-weight:600',
    `font-family:${FONT}`, 'user-select:none', 'line-height:1',
  ].join(';');
  starCountTextEl.textContent = `\u00D7\u00A0${getTotalStars()}`;
  starChip.appendChild(starIconEl);
  starChip.appendChild(starCountTextEl);
  starCounter.appendChild(starChip);

  // Spark counter chip
  const sparkChip = document.createElement('div');
  sparkChip.style.cssText = [
    'display:flex', 'align-items:center', 'gap:5px',
    'height:40px', 'box-sizing:border-box',
    'background:rgba(255,255,255,0.55)',
    '-webkit-backdrop-filter:blur(8px)', 'backdrop-filter:blur(8px)',
    'border-radius:20px', 'padding:0 14px',
    'border:1px solid rgba(255,255,255,0.3)',
    'margin-left:12px',
    'cursor:pointer', '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  ].join(';');
  sparkChip.addEventListener('click', () => { playButtonTap(); showShop('sparks'); });
  addPressFeedback(sparkChip);
  const sparkIconEl = document.createElement('div');
  sparkIconEl.style.cssText = 'display:inline-flex;flex-shrink:0;';
  sparkIconEl.innerHTML = sparkSVG(20, 2, '#b17025', 'ls-topspark');
  sparkCountTextEl = document.createElement('span');
  sparkCountTextEl.style.cssText = [
    `color:${C_TEXT}`, 'font-size:15px', 'font-weight:600',
    `font-family:${FONT}`, 'user-select:none', 'line-height:1',
  ].join(';');
  sparkCountTextEl.textContent = `\u00D7\u00A0${getSparkCount()}`;
  sparkChip.appendChild(sparkIconEl);
  sparkChip.appendChild(sparkCountTextEl);

  // Wrap spark chip in a relative container for the "+" button overlay
  const sparkWrap = document.createElement('div');
  sparkWrap.style.cssText = 'position:relative;display:flex;align-items:center;margin-left:12px;';
  sparkWrap.appendChild(sparkChip);
  sparkChip.style.marginLeft = '0'; // margin now on wrapper

  const plusBtn = document.createElement('button');
  plusBtn.textContent = '+';
  plusBtn.style.cssText = [
    'position:absolute', 'right:-6px', 'bottom:-6px',
    'width:22px', 'height:22px',
    'border-radius:50%',
    'background:linear-gradient(180deg, #00bcd4, #2196f3)',
    'border:1.5px solid #1976d2',
    'color:#ffffff',
    `font-family:${FONT}`, 'font-size:15px', 'font-weight:700',
    'line-height:1',
    'display:flex', 'align-items:center', 'justify-content:center',
    'padding:0', 'cursor:pointer', 'outline:none',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'transition:transform 0.15s ease-out',
  ].join(';');
  addPressFeedback(plusBtn);
  plusBtn.addEventListener('click', (e) => { e.stopPropagation(); playButtonTap(); showShop('sparks'); });
  sparkWrap.appendChild(plusBtn);
  starCounter.appendChild(sparkWrap);

  // Gear button (right, flex:1 end-aligned)
  const rightCol = document.createElement('div');
  rightCol.style.cssText = 'flex:1;display:flex;justify-content:flex-end;align-items:center;gap:8px;';

  const gearBtn = document.createElement('button');
  gearBtn.setAttribute('aria-label', 'Open settings');
  gearBtn.style.cssText = [
    'width:40px', 'height:40px',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:rgba(255,255,255,0.45)',
    '-webkit-backdrop-filter:blur(8px)', 'backdrop-filter:blur(8px)',
    'border:1.5px solid rgba(255,255,255,0.3)', 'border-radius:9999px',
    'padding:0', 'cursor:pointer', 'outline:none',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  ].join(';');
  gearBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20">'
    + '<path fill="#b17025" d="M195.1 9.5C198.1-5.3 211.2-16 226.4-16l59.8 0c15.2 0 28.3 10.7 31.3 25.5L332 79.5c14.1 6 27.3 13.7 39.3 22.8l67.8-22.5c14.4-4.8 30.2 1.2 37.8 14.4l29.9 51.8c7.6 13.2 4.9 29.8-6.5 39.9L447 233.3c.9 7.4 1.3 15 1.3 22.7s-.5 15.3-1.3 22.7l53.4 47.5c11.4 10.1 14 26.8 6.5 39.9l-29.9 51.8c-7.6 13.1-23.4 19.2-37.8 14.4l-67.8-22.5c-12.1 9.1-25.3 16.7-39.3 22.8l-14.4 69.9c-3.1 14.9-16.2 25.5-31.3 25.5l-59.8 0c-15.2 0-28.3-10.7-31.3-25.5l-14.4-69.9c-14.1-6-27.2-13.7-39.3-22.8L73.5 432.3c-14.4 4.8-30.2-1.2-37.8-14.4L5.8 366.1c-7.6-13.2-4.9-29.8 6.5-39.9l53.4-47.5c-.9-7.4-1.3-15-1.3-22.7s.5-15.3 1.3-22.7L12.3 185.8c-11.4-10.1-14-26.8-6.5-39.9L35.7 94.1c7.6-13.2 23.4-19.2 37.8-14.4l67.8 22.5c12.1-9.1 25.3-16.7 39.3-22.8L195.1 9.5zM256.3 336a80 80 0 1 0 -.6-160 80 80 0 1 0 .6 160z"/>'
    + '</svg>';
  addPressFeedback(gearBtn);
  gearBtn.addEventListener('click', () => { playButtonTap(); showSettings(); });

  const shopBtn = document.createElement('button');
  shopBtn.setAttribute('aria-label', 'Open shop');
  shopBtn.style.cssText = [
    'width:40px', 'height:40px',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:linear-gradient(180deg, #00bcd4, #2196f3)',
    'border:1.5px solid #1976d2', 'border-radius:9999px',
    'padding:0', 'cursor:pointer', 'outline:none',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  ].join(';');
  shopBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="22" height="22">'
    + '<path fill="#ffffff" d="M547.6 103.8L490.3 13.1C485.2 5 476.1 0 466.4 0L109.6 0C99.9 0 90.8 5 85.7 13.1L28.3 103.8c-29.6 46.8-3.4 111.9 51.9 119.4c4 .5 8.1 .8 12.1 .8c26.1 0 49.3-11.4 65.2-29c15.9 17.6 39.1 29 65.2 29c26.1 0 49.3-11.4 65.2-29c15.9 17.6 39.1 29 65.2 29c26.2 0 49.3-11.4 65.2-29c16 17.6 39.1 29 65.2 29c4.1 0 8.1-.3 12.1-.8c55.5-7.4 81.8-72.5 52.1-119.4zM499.7 254.9c0 0 0 0-.1 0c-5.3 .7-10.7 1.1-16.2 1.1c-12.4 0-24.3-1.9-35.4-5.3L448 384l-320 0 0-133.4c-11.2 3.5-23.2 5.4-35.6 5.4c-5.5 0-11-.4-16.3-1.1l-.1 0c-4.1-.6-8.1-1.3-12-2.3L64 384l0 64c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-64 0-131.4c-4 1-8 1.8-12.3 2.3z"/>'
    + '</svg>';
  addPressFeedback(shopBtn);
  shopBtn.addEventListener('click', () => { playButtonTap(); showShop(); });
  rightCol.appendChild(shopBtn);
  rightCol.appendChild(gearBtn);

  topBar.appendChild(starCounter);
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
    'background-image:repeating-linear-gradient(0deg, rgba(161,129,104,0.12) 0px, rgba(161,129,104,0.12) 1px, transparent 1px, transparent 30px), repeating-linear-gradient(90deg, rgba(161,129,104,0.12) 0px, rgba(161,129,104,0.12) 1px, transparent 1px, transparent 30px), linear-gradient(180deg, #f5d0c0 0%, #f0b8b0 50%, #e8a8a0 100%)',
    'background-size:auto, auto, 100% 100%',
    'background-repeat:repeat, repeat, no-repeat',
  ].join(';');

  pathEl = document.createElement('div');
  pathEl.style.cssText = 'position:relative;width:100%;';

  // Vignette: fixed overlay covering the viewport, draws eye toward center.
  // position:fixed keeps it out of the scroll flow so it can't affect scrollHeight.
  const vignette = document.createElement('div');
  vignette.style.cssText = [
    'position:fixed', 'inset:0',
    'pointer-events:none',
    'z-index:1',
    'background:radial-gradient(ellipse at 50% 50%, transparent 42%, rgba(240,210,168,0.30) 100%)',
  ].join(';');

  scroll.appendChild(pathEl);
  overlayEl.appendChild(topBar);
  overlayEl.appendChild(scroll);
  overlayEl.appendChild(vignette);
  ui.appendChild(overlayEl);
}

// ─── Dev mode ─────────────────────────────────────────────────────────────────

function _isDevMode(): boolean {
  return localStorage.getItem('untrace_dev_mode') === '1';
}

let _devBtnEl: HTMLButtonElement | null = null;
let _devPanelEl: HTMLDivElement | null = null;
let _dailyBtnWrapEl: HTMLDivElement | null = null;
let _dailyStyleEl: HTMLStyleElement | null = null;

const LS_DAILY_LAST_PLAYED = 'untrace_daily_last_played';

function _todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _dailyPlayedToday(): boolean {
  return localStorage.getItem(LS_DAILY_LAST_PLAYED) === _todayKey();
}

function _renderDailyButton(): void {
  if (_dailyBtnWrapEl) { _dailyBtnWrapEl.remove(); _dailyBtnWrapEl = null; }

  if (!_dailyStyleEl) {
    _dailyStyleEl = document.createElement('style');
    _dailyStyleEl.textContent =
      '@keyframes daily-float { from { transform:translateY(0); } to { transform:translateY(-4px); } }';
    document.head.appendChild(_dailyStyleEl);
  }

  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'position:fixed',
    'bottom:calc(env(safe-area-inset-bottom, 0px) + 24px)',
    'right:20px',
    'display:flex', 'flex-direction:column', 'align-items:center', 'gap:4px',
    'z-index:55',
    'pointer-events:none',
  ].join(';');

  const btn = document.createElement('button');
  btn.setAttribute('aria-label', 'Daily puzzle');
  btn.style.cssText = [
    'position:relative',
    'width:52px', 'height:52px', 'border-radius:50%',
    'background:linear-gradient(135deg, #fb5607, #e04e05)',
    'border:2px solid rgba(255,255,255,0.3)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'cursor:pointer', 'padding:0',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation', 'outline:none',
    'box-shadow:0 4px 12px rgba(0,0,0,0.15)',
    'animation:daily-float 2s ease-in-out infinite alternate',
    'transition:transform 0.15s ease-out',
    'pointer-events:auto',
  ].join(';');

  btn.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 512 512" fill="#ffffff">'
    + '<path d="M192 104.8c0-9.2-5.8-17.3-13.2-22.8C167.2 73.3 160 61.3 160 48c0-26.5 28.7-48 64-48s64 21.5 64 48c0 13.3-7.2 25.3-18.8 34c-7.4 5.5-13.2 13.6-13.2 22.8c0 12.8 10.4 23.2 23.2 23.2l56.8 0c26.5 0 48 21.5 48 48l0 56.8c0 12.8 10.4 23.2 23.2 23.2c9.2 0 17.3-5.8 22.8-13.2c8.7-11.6 20.7-18.8 34-18.8c26.5 0 48 28.7 48 64s-21.5 64-48 64c-13.3 0-25.3-7.2-34-18.8c-5.5-7.4-13.6-13.2-22.8-13.2c-12.8 0-23.2 10.4-23.2 23.2L384 464c0 26.5-21.5 48-48 48l-56.8 0c-12.8 0-23.2-10.4-23.2-23.2c0-9.2 5.8-17.3 13.2-22.8c11.6-8.7 18.8-20.7 18.8-34c0-26.5-28.7-48-64-48s-64 21.5-64 48c0 13.3 7.2 25.3 18.8 34c7.4 5.5 13.2 13.6 13.2 22.8c0 12.8-10.4 23.2-23.2 23.2L48 512c-26.5 0-48-21.5-48-48L0 343.2C0 330.4 10.4 320 23.2 320c9.2 0 17.3 5.8 22.8 13.2C54.7 344.8 66.7 352 80 352c26.5 0 48-28.7 48-64s-21.5-64-48-64c-13.3 0-25.3 7.2-34 18.8C40.5 250.2 32.4 256 23.2 256C10.4 256 0 245.6 0 232.8L0 176c0-26.5 21.5-48 48-48l120.8 0c12.8 0 23.2-10.4 23.2-23.2z"/>'
    + '</svg>';

  if (!_dailyPlayedToday()) {
    const badge = document.createElement('div');
    badge.style.cssText = [
      'position:absolute', 'top:2px', 'right:2px',
      'width:10px', 'height:10px', 'border-radius:50%',
      'background:#ff006e',
      'box-shadow:0 0 0 2px #ffedcd',
      'pointer-events:none',
    ].join(';');
    btn.appendChild(badge);
  }

  btn.addEventListener('pointerdown', () => { btn.style.transform = 'scale(0.92)'; });
  btn.addEventListener('pointerup',     () => { btn.style.transform = ''; });
  btn.addEventListener('pointercancel', () => { btn.style.transform = ''; });
  btn.addEventListener('pointerleave',  () => { btn.style.transform = ''; });
  btn.addEventListener('click', () => {
    playButtonTap();
    console.log('DAILY PUZZLE: tapped');
  });

  const label = document.createElement('div');
  label.textContent = 'Daily';
  label.style.cssText = [
    `font-family:${FONT_HEADING}`,
    'font-size:10px', 'font-weight:600',
    `color:${C_TEXT}`,
    'user-select:none', 'pointer-events:none',
  ].join(';');

  wrap.appendChild(btn);
  wrap.appendChild(label);
  document.body.appendChild(wrap);
  _dailyBtnWrapEl = wrap;
}

function _renderDevButton(): void {
  // Clean up previous
  if (_devBtnEl) { _devBtnEl.remove(); _devBtnEl = null; }
  if (_devPanelEl) { _devPanelEl.remove(); _devPanelEl = null; }
  console.log('DEV MODE: ' + localStorage.getItem('untrace_dev_mode'));
  if (!_isDevMode()) return;

  _devBtnEl = document.createElement('button');
  _devBtnEl.setAttribute('aria-label', 'Developer tools');
  _devBtnEl.style.cssText = [
    'position:fixed',
    'bottom:calc(env(safe-area-inset-bottom, 0px) + 24px)',
    'left:24px',
    'width:36px', 'height:36px', 'border-radius:50%',
    'background:#8338ec', 'border:none',
    'display:flex', 'align-items:center', 'justify-content:center',
    'cursor:pointer', 'z-index:55',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'box-shadow:0 2px 8px rgba(131,56,236,0.4)',
    'transition:transform 0.15s ease-out',
  ].join(';');
  _devBtnEl.innerHTML = '<svg width="18" height="18" viewBox="0 0 512 512" fill="#ffffff">'
    + '<path d="M352 320c88.4 0 160-71.6 160-160c0-15.3-2.2-30.1-6.2-44.2c-3.1-10.8-16.4-13.2-24.3-5.3l-76.8 76.8c-3 3-7.1 4.7-11.3 4.7L336 192c-8.8 0-16-7.2-16-16l0-57.4c0-4.2 1.7-8.3 4.7-11.3l76.8-76.8c7.9-7.9 5.4-21.2-5.3-24.3C382.1 2.2 367.3 0 352 0C263.6 0 192 71.6 192 160c0 19.1 3.4 37.5 9.5 54.5L19.9 396.1C7.2 408.8 0 426.1 0 444.1C0 481.6 30.4 512 67.9 512c18 0 35.3-7.2 48-19.9l181.6-181.6c17 6.2 35.4 9.5 54.5 9.5zM80 456a24 24 0 1 1 -48 0 24 24 0 1 1 48 0z"/>'
    + '</svg>';
  addPressFeedback(_devBtnEl);
  _devBtnEl.addEventListener('click', () => { playButtonTap(); _showDevPanel(); });
  // Append to document.body (not overlayEl) because overlayEl has transform +
  // overflow:hidden which clips position:fixed children.
  document.body.appendChild(_devBtnEl);
}

function _showDevPanel(): void {
  if (_devPanelEl) { _devPanelEl.remove(); _devPanelEl = null; }
  if (!overlayEl) return;

  _devPanelEl = document.createElement('div');
  _devPanelEl.style.cssText = [
    'position:fixed', 'inset:0',
    'background:rgba(255,237,205,0.85)',
    'backdrop-filter:blur(20px)', '-webkit-backdrop-filter:blur(20px)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'z-index:200',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'background:#feffe5', 'border-radius:24px',
    'padding:28px 24px 24px', 'max-width:300px', 'width:calc(100% - 48px)',
    `font-family:${FONT}`,
    'box-shadow:0 8px 32px rgba(46,47,44,0.08)',
  ].join(';');

  const title = document.createElement('p');
  title.textContent = 'Developer Tools';
  title.style.cssText = [
    `font-family:${FONT_HEADING}`, 'font-size:18px', 'font-weight:700',
    `color:${C_TEXT}`, 'margin:0 0 20px', 'text-align:center',
  ].join(';');
  card.appendChild(title);

  const btnStyle = [
    'width:100%', 'padding:12px 0', 'border:none', 'border-radius:9999px',
    'font-size:14px', 'font-weight:600', 'cursor:pointer',
    `font-family:${FONT}`,
    'touch-action:manipulation', '-webkit-tap-highlight-color:transparent',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
    'margin-bottom:10px',
  ].join(';');

  // Complete W1 button
  const completeBtn = document.createElement('button');
  completeBtn.textContent = 'Complete W1 Levels 1–29 (3★)';
  completeBtn.style.cssText = btnStyle + ';background:#8338ec;color:#ffffff;';
  addPressFeedback(completeBtn);
  completeBtn.addEventListener('click', () => {
    playButtonTap();
    const stars = loadStars();
    for (let i = 0; i < 29; i++) {
      const lvl = getCurrentLevel(i);
      stars[lvl.id] = 3;
    }
    localStorage.setItem(LS_STARS, JSON.stringify(stars));
    saveUnlockedUpTo(28);
    _devPanelEl?.remove();
    _devPanelEl = null;
    renderPath();
    _renderDevButton();
  });
  card.appendChild(completeBtn);

  // Set 2000 stars button
  const stars2000Btn = document.createElement('button');
  stars2000Btn.textContent = 'Set 2000 stars';
  stars2000Btn.style.cssText = btnStyle + ';background:#ffbe0b;color:#ffffff;';
  addPressFeedback(stars2000Btn);
  stars2000Btn.addEventListener('click', () => {
    playButtonTap();
    const stars = loadStars();
    const total = getLevelCount();
    for (let i = 0; i < total; i++) {
      const lvl = getCurrentLevel(i);
      stars[lvl.id] = 3;
    }
    localStorage.setItem(LS_STARS, JSON.stringify(stars));
    localStorage.setItem(LS_STARS_OVERRIDE, '2000');
    if (starCountTextEl) starCountTextEl.textContent = `\u00D7\u00A0${getTotalStars()}`;
    _devPanelEl?.remove();
    _devPanelEl = null;
    renderPath();
    _renderDevButton();
  });
  card.appendChild(stars2000Btn);

  // Set 2000 sparks button
  const sparks2000Btn = document.createElement('button');
  sparks2000Btn.textContent = 'Set 2000 sparks';
  sparks2000Btn.style.cssText = btnStyle + ';background:#3a86ff;color:#ffffff;';
  addPressFeedback(sparks2000Btn);
  sparks2000Btn.addEventListener('click', () => {
    playButtonTap();
    localStorage.setItem(LS_SPARKS, '2000');
    if (sparkCountTextEl) sparkCountTextEl.textContent = `\u00D7\u00A0${getSparkCount()}`;
    _devPanelEl?.remove();
    _devPanelEl = null;
    renderPath();
    _renderDevButton();
  });
  card.appendChild(sparks2000Btn);

  // Reset all button
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset all dev data';
  resetBtn.style.cssText = btnStyle + ';background:#d4726a;color:#ffffff;';
  addPressFeedback(resetBtn);
  resetBtn.addEventListener('click', () => {
    playButtonTap();
    localStorage.clear();
    window.location.reload();
  });
  card.appendChild(resetBtn);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = btnStyle + `;background:${C_TEXT};color:#ffffff;margin-bottom:0;`;
  addPressFeedback(closeBtn);
  closeBtn.addEventListener('click', () => {
    playButtonTap();
    _devPanelEl?.remove();
    _devPanelEl = null;
  });
  card.appendChild(closeBtn);

  _devPanelEl.appendChild(card);

  // Tap backdrop to close
  _devPanelEl.addEventListener('click', (e) => {
    if (e.target === _devPanelEl) {
      _devPanelEl?.remove();
      _devPanelEl = null;
    }
  });

  // Append to document.body (not overlayEl) because overlayEl has transform +
  // overflow:hidden which clips position:fixed children.
  document.body.appendChild(_devPanelEl);
}

// ─── Show / hide ──────────────────────────────────────────────────────────────

export function showLevelSelect(): void {
  if (!overlayEl) return;
  // Refresh top-bar counters from localStorage so the latest stars earned
  // from a just-completed level are reflected immediately.
  if (starCountTextEl) {
    starCountTextEl.textContent = `\u00D7\u00A0${getTotalStars()}`;
  }
  if (sparkCountTextEl) {
    sparkCountTextEl.textContent = `\u00D7\u00A0${getSparkCount()}`;
  }
  renderPath();
  _renderDailyButton();
  _renderDevButton();
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
  // Clean up dev elements from document.body
  if (_devBtnEl) { _devBtnEl.remove(); _devBtnEl = null; }
  if (_devPanelEl) { _devPanelEl.remove(); _devPanelEl = null; }
  if (_dailyBtnWrapEl) { _dailyBtnWrapEl.remove(); _dailyBtnWrapEl = null; }
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
