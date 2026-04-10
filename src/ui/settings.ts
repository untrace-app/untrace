// Settings modal: accessible from the level select screen.
// Handles sound volume/mute, accessibility toggles, progress reset, about info.

import { playButtonTap, playBgMusic, stopBgMusic, getDestinationNode } from '../audio/audio.ts';
import { addPressFeedback } from './overlay.ts';
import { FONT, FONT_HEADING, C_TEXT, C_TEXT_SEC, C_RECESSED, C_PRIMARY } from '../constants.ts';

// ─── Style constants ──────────────────────────────────────────────────────────

// Placeholder link until a real privacy policy URL exists.
const PRIVACY_URL  = 'https://untrace.game/privacy';

// ─── localStorage keys ────────────────────────────────────────────────────────

const LS_VOLUME     = 'untrace_volume';     // 0–100 (integer, snapped to 20)
const LS_MUTED      = 'untrace_muted';      // '1' muted | '0' unmuted
const LS_COLORBLIND = 'untrace_colorblind'; // 'true' | 'false'
const LS_VIBRATION  = 'untrace_vibration';  // '1' on | '0' off

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
    '  width: 24px; height: 24px; border-radius: 50%;',
    `  background: ${C_PRIMARY}; border: none; cursor: pointer;`,
    '  box-shadow: 0 2px 4px rgba(0,0,0,0.18);',
    '}',
    '.untrace-volume::-moz-range-thumb {',
    '  width: 24px; height: 24px; border-radius: 50%;',
    `  background: ${C_PRIMARY}; border: none; cursor: pointer;`,
    '  box-shadow: 0 2px 4px rgba(0,0,0,0.18);',
    '}',
    '.untrace-volume::-moz-range-track { background: transparent; border: none; }',
  ].join('\n');
  document.head.appendChild(style);
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const DEFAULT_VOLUME = 60; // snapped to 20 (0,20,40,60,80,100)

function snapVolume(v: number): number {
  const clamped = Math.max(0, Math.min(100, v));
  return Math.round(clamped / 20) * 20;
}

function getSavedVolume(): number {
  const raw = localStorage.getItem(LS_VOLUME);
  if (raw === null) return DEFAULT_VOLUME;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return DEFAULT_VOLUME;
  return snapVolume(n);
}

function saveVolume(v: number): void {
  localStorage.setItem(LS_VOLUME, String(snapVolume(v)));
}

function getSavedMuted(): boolean {
  const raw = localStorage.getItem(LS_MUTED);
  return raw === '1' || raw === 'true';
}

function saveMuted(m: boolean): void {
  localStorage.setItem(LS_MUTED, m ? '1' : '0');
}

function getSavedColorblind(): boolean {
  return localStorage.getItem(LS_COLORBLIND) === 'true';
}

function saveColorblind(c: boolean): void {
  localStorage.setItem(LS_COLORBLIND, c ? 'true' : 'false');
}

function getSavedVibration(): boolean {
  const raw = localStorage.getItem(LS_VIBRATION);
  if (raw === null) return true;
  return raw === '1';
}

function saveVibration(v: boolean): void {
  localStorage.setItem(LS_VIBRATION, v ? '1' : '0');
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
  localStorage.setItem('untrace_sparks', '5');
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
  'background:#feffe5', 'border-radius:24px',
  'padding:28px 24px 24px', 'max-width:280px', 'width:calc(100% - 48px)',
  'text-align:center', `font-family:${FONT}`,
  'box-shadow:0 8px 32px rgba(46,47,44,0.08)',
].join(';');

const DIALOG_BTN = [
  'flex:1', 'padding:13px 0', 'border:none', 'border-radius:9999px',
  'font-size:15px', 'font-weight:600', 'cursor:pointer',
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
  confirmBtn.style.cssText = `${DIALOG_BTN};background:${C_PRIMARY};color:#ffffff;font-size:16px;padding:14px 0;`;
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

/** Build a pill toggle matching the colorblind/vibration/sound style. */
function createPillToggle(
  ariaLabel: string,
  initialOn: boolean,
  onChange: (on: boolean) => void,
): HTMLButtonElement {
  const toggle = document.createElement('button');
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-label', ariaLabel);
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

  let on = initialOn;
  function render(): void {
    toggle.style.background = on ? C_PRIMARY : C_RECESSED;
    knob.style.transform    = on ? 'translateX(20px)' : 'translateX(0)';
    toggle.setAttribute('aria-checked', on ? 'true' : 'false');
  }
  render();

  toggle.addEventListener('click', () => {
    playButtonTap();
    on = !on;
    render();
    onChange(on);
  });

  return toggle;
}

const TOGGLE_LABEL_TEXT_STYLE = [
  `color:${C_TEXT}`, 'font-size:14px', 'font-weight:500',
  `font-family:${FONT}`, 'user-select:none',
  'flex:1', 'min-width:0',
].join(';');

const TOGGLE_ROW_STYLE = [
  'display:flex', 'align-items:center', 'justify-content:space-between',
  'gap:12px', 'margin-bottom:12px',
].join(';');

function buildSoundSection(): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = 'margin:0 0 20px;';

  const label = document.createElement('p');
  label.textContent = 'Sound';
  label.style.cssText = SECTION_LABEL_STYLE;
  section.appendChild(label);

  // ── Sound on/off toggle row ──────────────────────────────────────────────
  const toggleRow = document.createElement('div');
  toggleRow.style.cssText = TOGGLE_ROW_STYLE;

  const toggleText = document.createElement('span');
  toggleText.textContent = 'Sound';
  toggleText.style.cssText = TOGGLE_LABEL_TEXT_STYLE;

  const soundToggle = createPillToggle('Sound', !getSavedMuted(), (on) => {
    saveMuted(!on);
    applyAudioSettings();
    if (on) { playBgMusic(); } else { stopBgMusic(); }
  });

  toggleRow.appendChild(toggleText);
  toggleRow.appendChild(soundToggle);
  section.appendChild(toggleRow);

  // ── Volume slider row ────────────────────────────────────────────────────
  const sliderRow = document.createElement('div');
  sliderRow.style.cssText = 'display:flex;align-items:center;padding:4px 0;';

  const slider = document.createElement('input');
  slider.type  = 'range';
  slider.className = 'untrace-volume';
  slider.min   = '0';
  slider.max   = '100';
  slider.step  = '20';
  slider.value = String(getSavedVolume());
  slider.style.cssText = [
    'flex:1', 'appearance:none', '-webkit-appearance:none',
    'height:10px', 'border-radius:9999px',
    'outline:none', 'cursor:pointer',
    'margin:0', 'padding:0', 'min-width:0',
    'touch-action:manipulation',
    `background:linear-gradient(to right, ${C_PRIMARY} 0%, ${C_PRIMARY} ${getSavedVolume()}%, ${C_RECESSED} ${getSavedVolume()}%, ${C_RECESSED} 100%)`,
  ].join(';');

  function applyVolumeToTrack(): void {
    const v = parseInt(slider.value, 10);
    slider.style.background =
      `linear-gradient(to right, ${C_PRIMARY} 0%, ${C_PRIMARY} ${v}%, ${C_RECESSED} ${v}%, ${C_RECESSED} 100%)`;
  }
  slider.addEventListener('input', () => {
    const v = snapVolume(parseInt(slider.value, 10));
    slider.value = String(v);
    saveVolume(v);
    applyVolumeToTrack();
    applyAudioSettings();
  });

  sliderRow.appendChild(slider);
  section.appendChild(sliderRow);

  return section;
}

function buildVibrationSection(): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = 'margin:0 0 20px;';

  const label = document.createElement('p');
  label.textContent = 'Vibration';
  label.style.cssText = SECTION_LABEL_STYLE;

  const row = document.createElement('div');
  row.style.cssText = TOGGLE_ROW_STYLE + ';margin-bottom:0;';

  const text = document.createElement('span');
  text.textContent = 'Vibration';
  text.style.cssText = TOGGLE_LABEL_TEXT_STYLE;

  const toggle = createPillToggle('Vibration', getSavedVibration(), (on) => {
    saveVibration(on);
  });

  row.appendChild(text);
  row.appendChild(toggle);
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
  row.style.cssText = TOGGLE_ROW_STYLE + ';margin-bottom:0;';

  const text = document.createElement('span');
  text.textContent = 'Colorblind patterns';
  text.style.cssText = TOGGLE_LABEL_TEXT_STYLE;

  const toggle = createPillToggle('Colorblind patterns', getSavedColorblind(), (on) => {
    saveColorblind(on);
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
    'display:block', 'width:100%', 'box-sizing:border-box',
    `background:${C_RECESSED}`, `color:${C_TEXT}`,
    'border:none', 'border-radius:9999px',
    'padding:12px 24px',
    `font-family:${FONT_HEADING}`, 'font-size:14px', 'font-weight:600',
    'cursor:pointer', 'text-align:center',
    '-webkit-tap-highlight-color:transparent', 'touch-action:manipulation', 'outline:none',
    'transition:transform 0.15s ease-out, filter 0.15s ease-out',
  ].join(';');
  addPressFeedback(btn);

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
  version.style.cssText = aboutBase + ';cursor:default;-webkit-tap-highlight-color:transparent;';

  // Hidden dev mode trigger: 7 taps within 3 seconds
  let _devTaps = 0;
  let _devTimer = 0;
  version.addEventListener('click', () => {
    _devTaps++;
    clearTimeout(_devTimer);
    _devTimer = window.setTimeout(() => { _devTaps = 0; }, 3000);
    if (_devTaps >= 7) {
      _devTaps = 0;
      clearTimeout(_devTimer);
      const key = 'untrace_dev_mode';
      const isOn = localStorage.getItem(key) === '1';
      if (isOn) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, '1');
      }
      // Toast
      const toast = document.createElement('div');
      toast.textContent = isOn ? 'Dev mode OFF' : 'Dev mode ON';
      toast.style.cssText = [
        'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
        `font-family:${FONT}`, 'font-size:13px', 'font-weight:600',
        'color:#ffffff', 'background:#8338ec',
        'border-radius:20px', 'padding:6px 16px',
        'pointer-events:none', 'z-index:300',
        'transition:opacity 0.4s ease',
      ].join(';');
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = '0'; }, 1500);
      setTimeout(() => { toast.remove(); }, 1900);
    }
  });

  const studio = document.createElement('p');
  studio.textContent = 'Myntell Games';
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
    'background:#feffe5', 'border-radius:24px',
    'padding:28px 24px 24px', 'max-width:320px', 'width:calc(100% - 48px)',
    `font-family:${FONT}`,
    'box-shadow:0 8px 32px rgba(46,47,44,0.08)',
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
  cardEl.appendChild(buildVibrationSection());
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
