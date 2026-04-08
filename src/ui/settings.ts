// Settings modal: accessible from the level select screen.
// Handles sound volume/mute, accessibility toggles, progress reset, about info.

import { playButtonTap, playBgMusic, stopBgMusic, getDestinationNode } from '../audio/audio.ts';
import { addPressFeedback } from './overlay.ts';
import { FONT, FONT_HEADING, C_TEXT, C_TEXT_SEC, C_RECESSED, C_PRIMARY } from '../constants.ts';

// ─── Style constants ──────────────────────────────────────────────────────────

const C_DANGER = '#d4726a';

// Placeholder link until a real privacy policy URL exists.
const PRIVACY_URL  = 'https://untrace.game/privacy';

// ─── localStorage keys ────────────────────────────────────────────────────────

const LS_VOLUME     = 'untrace_volume';     // 0–100 (integer)
const LS_MUTED      = 'untrace_muted';      // 'true' | 'false'
const LS_COLORBLIND = 'untrace_colorblind'; // 'true' | 'false'

// Keys (exact or prefixes) that represent game progress to clear on reset.
const GAME_DATA_KEYS: readonly string[] = [
  'tutorial-complete',
  'untrace_unlocked',
  'untrace_stars',
  'untrace_world_unlocks_shown',
];
const GAME_DATA_PREFIXES: readonly string[] = [
  'untrace-save-',
];

// ─── Module state ─────────────────────────────────────────────────────────────

let backdropEl: HTMLDivElement | null = null;
let cardEl:     HTMLDivElement | null = null;

// ─── One-time slider thumb styles (inline CSS can't reach pseudo-elements) ────

let _stylesInjected = false;
function injectSliderStyles(): void {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = [
    '.untrace-volume::-webkit-slider-thumb {',
    '  -webkit-appearance: none; appearance: none;',
    '  width: 18px; height: 18px; border-radius: 50%;',
    `  background: ${C_PRIMARY}; border: none; cursor: pointer;`,
    '  box-shadow: 0 1px 3px rgba(0,0,0,0.15);',
    '}',
    '.untrace-volume::-moz-range-thumb {',
    '  width: 18px; height: 18px; border-radius: 50%;',
    `  background: ${C_PRIMARY}; border: none; cursor: pointer;`,
    '  box-shadow: 0 1px 3px rgba(0,0,0,0.15);',
    '}',
    '.untrace-volume::-moz-range-track { background: transparent; border: none; }',
  ].join('\n');
  document.head.appendChild(style);
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const DEFAULT_VOLUME = 50; // 0–100, maps to ~-6 dB via the log curve

function getSavedVolume(): number {
  const raw = localStorage.getItem(LS_VOLUME);
  if (raw === null) return DEFAULT_VOLUME;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return DEFAULT_VOLUME;
  return Math.max(0, Math.min(100, n));
}

function saveVolume(v: number): void {
  localStorage.setItem(LS_VOLUME, String(Math.max(0, Math.min(100, Math.round(v)))));
}

function getSavedMuted(): boolean {
  return localStorage.getItem(LS_MUTED) === 'true';
}

function saveMuted(m: boolean): void {
  localStorage.setItem(LS_MUTED, m ? 'true' : 'false');
}

function getSavedColorblind(): boolean {
  return localStorage.getItem(LS_COLORBLIND) === 'true';
}

function saveColorblind(c: boolean): void {
  localStorage.setItem(LS_COLORBLIND, c ? 'true' : 'false');
}

// ─── Audio application ───────────────────────────────────────────────────────

/** Map a 0–100 slider value to a dB value using a log curve. */
function volumeToDb(v: number): number {
  if (v <= 0) return -60;
  return 20 * Math.log10(v / 100);
}

/** Apply the currently-saved volume and mute state to the Tone destination. */
function applyAudioSettings(): void {
  const dest = getDestinationNode();
  if (!dest) return;
  try {
    dest.volume.value = volumeToDb(getSavedVolume());
    dest.mute         = getSavedMuted();
  } catch { /* Tone context may not be ready yet — caller retries on gesture. */ }
}

// ─── Progress reset ───────────────────────────────────────────────────────────

function resetAllProgress(): void {
  // Collect keys first (mutating during iteration is unsafe in some browsers).
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (GAME_DATA_KEYS.includes(key)) { toRemove.push(key); continue; }
    for (const prefix of GAME_DATA_PREFIXES) {
      if (key.startsWith(prefix)) { toRemove.push(key); break; }
    }
  }
  for (const key of toRemove) localStorage.removeItem(key);
  window.location.reload();
}

// ─── Shared small styles ──────────────────────────────────────────────────────

const SECTION_LABEL_STYLE = [
  `color:${C_TEXT_SEC}`,
  'font-size:12px', 'font-weight:600',
  'letter-spacing:0.1em', 'text-transform:uppercase',
  `font-family:${FONT}`,
  'margin:0 0 10px', 'user-select:none',
].join(';');

const DIALOG_BACKDROP = [
  'position:fixed', 'inset:0',
  'background:rgba(255,237,205,0.85)',
  'backdrop-filter:blur(20px)', '-webkit-backdrop-filter:blur(20px)',
  'display:flex', 'align-items:center', 'justify-content:center',
  'z-index:70',
].join(';');

const DIALOG_CARD = [
  'background:#feffe5', 'border-radius:16px',
  'padding:24px', 'max-width:280px', 'width:calc(100% - 48px)',
  'text-align:center', `font-family:${FONT}`,
  'box-shadow:0 4px 16px rgba(0,0,0,0.08)',
].join(';');

const DIALOG_BTN = [
  'flex:1', 'padding:12px 0', 'border:none', 'border-radius:9999px',
  'font-size:14px', 'font-weight:600', 'cursor:pointer',
  `font-family:${FONT}`,
  'touch-action:manipulation', '-webkit-tap-highlight-color:transparent',
  'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  'outline:none',
].join(';');

// ─── Small confirmation dialog (used by reset flow) ───────────────────────────

function showConfirmDialog(
  text: string,
  cancelLabel: string,
  confirmLabel: string,
  onConfirm: () => void,
): void {
  const backdrop = document.createElement('div');
  backdrop.style.cssText = DIALOG_BACKDROP;
  const card = document.createElement('div');
  card.style.cssText = DIALOG_CARD;

  const msg = document.createElement('p');
  msg.textContent = text;
  msg.style.cssText = [
    `color:${C_TEXT}`, 'font-size:15px', 'font-weight:600',
    'margin:0 0 20px', 'line-height:1.4',
    `font-family:${FONT_HEADING}`,
  ].join(';');

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = cancelLabel;
  cancelBtn.style.cssText = `${DIALOG_BTN};background:${C_RECESSED};color:${C_TEXT};`;
  addPressFeedback(cancelBtn);

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = confirmLabel;
  confirmBtn.style.cssText = `${DIALOG_BTN};background:${C_PRIMARY};color:#ffffff;`;
  addPressFeedback(confirmBtn);

  function dismiss(): void { backdrop.remove(); }
  cancelBtn.addEventListener('click', () => { playButtonTap(); dismiss(); });
  confirmBtn.addEventListener('click', () => { playButtonTap(); dismiss(); onConfirm(); });

  row.appendChild(cancelBtn);
  row.appendChild(confirmBtn);
  card.appendChild(msg);
  card.appendChild(row);
  backdrop.appendChild(card);
  document.getElementById('ui')!.appendChild(backdrop);
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function buildSoundSection(): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = 'margin:0 0 20px;';

  const label = document.createElement('p');
  label.textContent = 'Sound';
  label.style.cssText = SECTION_LABEL_STYLE;

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:12px;';

  // ── Volume slider ────────────────────────────────────────────────────────
  const slider = document.createElement('input');
  slider.type  = 'range';
  slider.className = 'untrace-volume';
  slider.min   = '0';
  slider.max   = '100';
  slider.step  = '1';
  slider.value = String(getSavedVolume());
  slider.style.cssText = [
    'flex:1', 'appearance:none', '-webkit-appearance:none',
    'height:6px', 'border-radius:9999px',
    'outline:none', 'cursor:pointer',
    'margin:0', 'padding:0',
    'touch-action:manipulation',
    // Filled portion of the track is drawn via a gradient that tracks the value.
    `background:linear-gradient(to right, ${C_PRIMARY} 0%, ${C_PRIMARY} ${getSavedVolume()}%, ${C_RECESSED} ${getSavedVolume()}%, ${C_RECESSED} 100%)`,
  ].join(';');

  // ── Mute toggle icon ─────────────────────────────────────────────────────
  const muteBtn = document.createElement('button');
  muteBtn.style.cssText = [
    'width:40px', 'height:40px', 'flex-shrink:0',
    'display:flex', 'align-items:center', 'justify-content:center',
    `background:${C_RECESSED}`, 'border:none', 'border-radius:9999px',
    `color:${C_TEXT}`, 'cursor:pointer', 'padding:0',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation', 'outline:none',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  ].join(';');
  muteBtn.setAttribute('aria-label', 'Mute toggle');
  addPressFeedback(muteBtn);

  const SPEAKER_ON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
    + '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>'
    + '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>'
    + '<path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
  const SPEAKER_MUTED = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
    + '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>'
    + '<line x1="23" y1="9" x2="17" y2="15"/>'
    + '<line x1="17" y1="9" x2="23" y2="15"/></svg>';

  function renderMuteIcon(): void {
    muteBtn.innerHTML = getSavedMuted() ? SPEAKER_MUTED : SPEAKER_ON;
  }
  renderMuteIcon();

  // ── Wiring ───────────────────────────────────────────────────────────────
  function applyVolumeToTrack(): void {
    const v = parseInt(slider.value, 10);
    slider.style.background =
      `linear-gradient(to right, ${C_PRIMARY} 0%, ${C_PRIMARY} ${v}%, ${C_RECESSED} ${v}%, ${C_RECESSED} 100%)`;
  }
  slider.addEventListener('input', () => {
    const v = parseInt(slider.value, 10);
    saveVolume(v);
    applyVolumeToTrack();
    applyAudioSettings();
  });

  muteBtn.addEventListener('click', () => {
    playButtonTap();
    saveMuted(!getSavedMuted());
    renderMuteIcon();
    applyAudioSettings();
    if (getSavedMuted()) { stopBgMusic(); } else { playBgMusic(); }
  });

  row.appendChild(slider);
  row.appendChild(muteBtn);
  section.appendChild(label);
  section.appendChild(row);
  return section;
}

function buildAccessibilitySection(): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = 'margin:0 0 20px;';

  const label = document.createElement('p');
  label.textContent = 'Accessibility';
  label.style.cssText = SECTION_LABEL_STYLE;

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;';

  const text = document.createElement('span');
  text.textContent = 'Colorblind patterns';
  text.style.cssText = [
    `color:${C_TEXT}`, 'font-size:14px', 'font-weight:500',
    `font-family:${FONT}`, 'user-select:none',
  ].join(';');

  // ── Pill toggle ──────────────────────────────────────────────────────────
  const toggle = document.createElement('button');
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-label', 'Colorblind patterns');
  toggle.style.cssText = [
    'position:relative', 'width:44px', 'height:24px', 'flex-shrink:0',
    'border:none', 'border-radius:9999px', 'cursor:pointer', 'padding:0',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation', 'outline:none',
    'transition:background-color 0.2s ease-out',
  ].join(';');

  const knob = document.createElement('div');
  knob.style.cssText = [
    'position:absolute', 'top:2px', 'left:2px',
    'width:20px', 'height:20px', 'border-radius:50%',
    'background:#ffffff',
    'box-shadow:0 1px 3px rgba(0,0,0,0.12)',
    'transition:transform 0.2s ease-out',
  ].join(';');
  toggle.appendChild(knob);

  function renderToggle(): void {
    const on = getSavedColorblind();
    toggle.style.background = on ? C_PRIMARY : C_RECESSED;
    knob.style.transform    = on ? 'translateX(20px)' : 'translateX(0)';
    toggle.setAttribute('aria-checked', on ? 'true' : 'false');
  }
  renderToggle();

  toggle.addEventListener('click', () => {
    playButtonTap();
    saveColorblind(!getSavedColorblind());
    renderToggle();
  });

  row.appendChild(text);
  row.appendChild(toggle);
  section.appendChild(label);
  section.appendChild(row);
  return section;
}

function buildProgressSection(): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = 'margin:0 0 20px;';

  const label = document.createElement('p');
  label.textContent = 'Progress';
  label.style.cssText = SECTION_LABEL_STYLE;

  const btn = document.createElement('button');
  btn.textContent = 'Reset all progress';
  btn.style.cssText = [
    'background:none', 'border:none', 'padding:4px 0',
    `color:${C_DANGER}`, `font-family:${FONT}`,
    'font-size:14px', 'font-weight:500',
    'cursor:pointer', 'text-align:left',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation', 'outline:none',
    'transition:opacity 0.15s ease-out',
  ].join(';');
  btn.addEventListener('pointerdown',   () => { btn.style.opacity = '0.6'; });
  btn.addEventListener('pointerup',     () => { btn.style.opacity = '1';   });
  btn.addEventListener('pointercancel', () => { btn.style.opacity = '1';   });
  btn.addEventListener('pointerleave',  () => { btn.style.opacity = '1';   });

  btn.addEventListener('click', () => {
    playButtonTap();
    showConfirmDialog('Reset all progress?', 'Cancel', 'Reset', () => {
      showConfirmDialog('This cannot be undone. Are you sure?', 'Cancel', 'Yes, reset', () => {
        resetAllProgress();
      });
    });
  });

  section.appendChild(label);
  section.appendChild(btn);
  return section;
}

function buildAboutSection(): HTMLElement {
  const about = document.createElement('div');
  about.style.cssText = 'text-align:center;';

  const aboutBase = [
    `color:${C_TEXT_SEC}`, 'font-size:12px', 'font-weight:500',
    `font-family:${FONT}`, 'margin:0', 'line-height:1.5', 'user-select:none',
  ].join(';');

  const version = document.createElement('p');
  version.textContent = 'v1.0.0';
  version.style.cssText = aboutBase;

  const studio = document.createElement('p');
  studio.textContent = 'Made by [Studio Name]';
  studio.style.cssText = aboutBase;

  const privacy = document.createElement('a');
  privacy.textContent = 'Privacy Policy';
  privacy.href = PRIVACY_URL;
  privacy.target = '_blank';
  privacy.rel = 'noopener noreferrer';
  privacy.style.cssText = [
    `color:${C_TEXT}`, 'font-size:12px', 'font-weight:500',
    `font-family:${FONT}`, 'margin:0', 'line-height:1.5',
    'text-decoration:none', 'display:inline-block', 'padding:4px 0',
    '-webkit-tap-highlight-color:transparent',
  ].join(';');

  about.appendChild(version);
  about.appendChild(studio);
  about.appendChild(privacy);
  return about;
}

// ─── Build modal ──────────────────────────────────────────────────────────────

function buildModal(ui: HTMLElement): void {
  backdropEl = document.createElement('div');
  backdropEl.style.cssText = [
    'position:fixed', 'inset:0',
    'background:rgba(255,237,205,0.85)',
    'backdrop-filter:blur(20px)', '-webkit-backdrop-filter:blur(20px)',
    'display:none',
    'align-items:center', 'justify-content:center',
    'z-index:60',
    'opacity:0',
    'transition:opacity 0.22s ease',
    'will-change:opacity',
  ].join(';');

  cardEl = document.createElement('div');
  cardEl.style.cssText = [
    'position:relative',
    'background:#feffe5', 'border-radius:16px',
    'padding:24px', 'max-width:320px', 'width:calc(100% - 48px)',
    `font-family:${FONT}`,
    'box-shadow:0 4px 16px rgba(0,0,0,0.08)',
    'opacity:0', 'transform:translateY(12px)',
    'transition:opacity 0.28s ease, transform 0.28s cubic-bezier(0.22,1,0.36,1)',
    'will-change:opacity,transform',
    'max-height:calc(100vh - 48px)',
    'overflow-y:auto', '-webkit-overflow-scrolling:touch',
  ].join(';');

  // ── Close X (top-right) ────────────────────────────────────────────────────
  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('aria-label', 'Close settings');
  closeBtn.textContent = '\u00D7';
  closeBtn.style.cssText = [
    'position:absolute', 'top:8px', 'right:8px',
    'width:40px', 'height:40px',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:transparent', 'border:none', 'padding:0',
    `color:${C_TEXT_SEC}`, `font-family:${FONT}`,
    'font-size:20px', 'font-weight:500', 'line-height:1',
    'cursor:pointer', 'outline:none',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  ].join(';');
  addPressFeedback(closeBtn);
  closeBtn.addEventListener('click', () => { playButtonTap(); hideSettings(); });

  // ── Title ─────────────────────────────────────────────────────────────────
  const title = document.createElement('h2');
  title.textContent = 'Settings';
  title.style.cssText = [
    `color:${C_TEXT}`,
    'font-size:20px', 'font-weight:700', 'letter-spacing:-0.01em',
    `font-family:${FONT_HEADING}`,
    'margin:0 0 20px', 'text-align:center', 'user-select:none',
  ].join(';');

  // ── Divider ───────────────────────────────────────────────────────────────
  const divider = document.createElement('div');
  divider.style.cssText = `height:1px;background:${C_RECESSED};margin:16px 0;`;

  cardEl.appendChild(closeBtn);
  cardEl.appendChild(title);
  cardEl.appendChild(buildSoundSection());
  cardEl.appendChild(buildAccessibilitySection());
  cardEl.appendChild(buildProgressSection());
  cardEl.appendChild(divider);
  cardEl.appendChild(buildAboutSection());

  backdropEl.appendChild(cardEl);
  ui.appendChild(backdropEl);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the settings modal and schedule saved audio settings to apply on the
 * first user gesture (after audio.ts has initialized its own Tone context).
 */
export function initSettings(): void {
  injectSliderStyles();
  const ui = document.getElementById('ui')!;
  buildModal(ui);

  // Audio context can only start on a user gesture (iOS). audio.ts registers
  // its own touchstart/click handler first; ours runs after it and uses a
  // microtask so it applies *after* audio.ts sets its default -6 dB.
  const apply = (): void => { setTimeout(applyAudioSettings, 0); };
  document.documentElement.addEventListener('touchstart', apply, { once: true });
  document.addEventListener('click', apply, { once: true });
}

/** Show the settings modal. */
export function showSettings(): void {
  if (!backdropEl || !cardEl) return;
  backdropEl.style.display = 'flex';
  // Double rAF to let display:flex settle before the transition starts.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (backdropEl) backdropEl.style.opacity = '1';
      if (cardEl) {
        cardEl.style.opacity   = '1';
        cardEl.style.transform = 'translateY(0)';
      }
    });
  });
}

/** Hide the settings modal. */
export function hideSettings(): void {
  if (!backdropEl || !cardEl) return;
  backdropEl.style.opacity = '0';
  cardEl.style.opacity     = '0';
  cardEl.style.transform   = 'translateY(12px)';
  setTimeout(() => {
    if (backdropEl) backdropEl.style.display = 'none';
  }, 220);
}
