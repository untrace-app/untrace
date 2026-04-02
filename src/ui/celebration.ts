// Win celebration screen (Phase 3)

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

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

let backdropEl: HTMLDivElement | null = null;
let cardEl:     HTMLDivElement | null = null;

// ─── Build ────────────────────────────────────────────────────────────────────

export function initCelebration(): void {
  const ui = document.getElementById('ui')!;

  backdropEl = document.createElement('div');
  backdropEl.style.cssText = [
    'position:fixed', 'inset:0',
    'display:none',
    'align-items:center', 'justify-content:center',
    'z-index:30',
    'background:rgba(10,10,15,0.85)',
  ].join(';');

  cardEl = document.createElement('div');
  cardEl.style.cssText = [
    'background:rgba(16,16,28,0.98)',
    'border:1px solid rgba(255,255,255,0.08)',
    'border-radius:24px',
    'padding:32px 28px 24px',
    'max-width:320px',
    'width:calc(100% - 48px)',
    'text-align:center',
    `font-family:${FONT}`,
    'box-shadow:0 24px 64px rgba(0,0,0,0.75)',
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
    'background:rgba(78,205,196,0.12)',
    'border:1.5px solid rgba(78,205,196,0.35)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'margin:0 auto 14px',
  ].join(';');
  checkEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" '
    + 'stroke="#4ECDC4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
    + '<polyline points="20 6 9 17 4 12"/></svg>';

  // Level name
  const nameEl = document.createElement('p');
  nameEl.textContent = params.levelName;
  nameEl.style.cssText = [
    'color:rgba(255,255,255,0.4)',
    'font-size:11px', 'font-weight:600', 'letter-spacing:0.1em',
    'text-transform:uppercase', 'margin:0 0 4px', 'user-select:none',
  ].join(';');

  // Title
  const titleEl = document.createElement('p');
  titleEl.textContent = 'Level Cleared';
  titleEl.style.cssText = [
    'color:#FFFFFF',
    'font-size:26px', 'font-weight:700', 'letter-spacing:-0.02em',
    'margin:0 0 18px', 'user-select:none',
  ].join(';');

  // Stars row
  const starsRow = document.createElement('div');
  starsRow.style.cssText = 'display:flex;gap:8px;justify-content:center;margin:0 0 18px;';
  const starEls: HTMLElement[] = [];
  for (let i = 0; i < 3; i++) {
    const filled = i < params.stars;
    const star = document.createElement('div');
    star.style.cssText = [
      'flex-shrink:0',
      `opacity:${filled ? '0' : '1'}`,
      `transform:${filled ? 'scale(0)' : 'scale(1)'}`,
      'transition:transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
    ].join(';');
    star.innerHTML = filled
      ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="#FFD700" stroke="#FFD700" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
      : '<svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    starsRow.appendChild(star);
    starEls.push(star);
  }

  // Stats pill
  const statsEl = document.createElement('div');
  statsEl.style.cssText = [
    'background:rgba(255,255,255,0.04)',
    'border-radius:12px', 'padding:12px 16px',
    'margin:0 0 22px',
    'display:flex', 'justify-content:space-around',
  ].join(';');

  function statCell(label: string, value: string): HTMLElement {
    const cell = document.createElement('div');
    cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;';
    const v = document.createElement('span');
    v.textContent = value;
    v.style.cssText = 'color:#FFFFFF;font-size:22px;font-weight:700;line-height:1;user-select:none;';
    const l = document.createElement('span');
    l.textContent = label;
    l.style.cssText = [
      'color:rgba(255,255,255,0.38)', 'font-size:10px', 'font-weight:600',
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
  if (params.targetLayers !== undefined && params.targetLayers > 0) {
    statsEl.appendChild(statCell('Remaining', String(params.remainingLayers ?? 0)));
    statsEl.appendChild(statCell('Target', String(params.targetLayers)));
  }

  // ── Buttons ───────────────────────────────────────────────────────────────
  const BTN_BASE = [
    'width:100%', 'padding:14px 0',
    'border:none', 'border-radius:12px',
    'font-size:15px', 'font-weight:600', 'cursor:pointer',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'display:block', 'box-sizing:border-box',
    `font-family:${FONT}`,
    'transition:opacity 0.1s ease',
    'outline:none',
  ].join(';');

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next Level';
  nextBtn.style.cssText = `${BTN_BASE};background:#4ECDC4;color:#0A0A14;margin-bottom:10px;`;
  nextBtn.addEventListener('click', () => dismiss(onNextLevel));

  const replayBtn = document.createElement('button');
  replayBtn.textContent = 'Replay';
  replayBtn.style.cssText = `${BTN_BASE};background:rgba(255,255,255,0.1);color:#FFFFFF;margin-bottom:10px;`;
  replayBtn.addEventListener('click', () => dismiss(onReplay));

  const selectBtn = document.createElement('button');
  selectBtn.textContent = 'Level Select';
  selectBtn.style.cssText = `${BTN_BASE};background:transparent;color:rgba(255,255,255,0.42);margin-bottom:0;`;
  selectBtn.addEventListener('click', () => dismiss(onLevelSelect));

  cardEl.appendChild(checkEl);
  cardEl.appendChild(nameEl);
  cardEl.appendChild(titleEl);
  cardEl.appendChild(starsRow);
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
      // Stagger filled star reveals after card entrance, 200ms between each.
      for (let i = 0; i < params.stars; i++) {
        const star = starEls[i];
        if (star) setTimeout(() => {
          star.style.transform = 'scale(1)';
          star.style.opacity   = '1';
        }, 220 + i * 200);
      }
    });
  });
}

export function hideCelebration(): void {
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
