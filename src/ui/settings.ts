// Settings modal: accessible from the level select screen.
// Handles sound volume/mute, accessibility toggles, progress reset, about info.

import { playButtonTap, playBgMusic, stopBgMusic, getDestinationNode } from '../audio/audio.ts';
import { addPressFeedback } from './overlay.ts';
import { setDailyButtonVisible } from './level-select.ts';
import { FONT, FONT_HEADING, C_TEXT, C_TEXT_SEC, C_RECESSED, C_PRIMARY } from '../constants.ts';

// ─── Style constants ──────────────────────────────────────────────────────────

// Placeholder link until a real privacy policy URL exists.
const PRIVACY_URL  = 'https://untrace.game/privacy';

// ─── localStorage keys ────────────────────────────────────────────────────────

const LS_VOLUME     = 'untrace_volume';     // 0–100 (integer, snapped to 20)
const LS_MUTED      = 'untrace_muted';      // '1' muted | '0' unmuted
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

let overlayEl: HTMLDivElement | null = null;
let panelEl:   HTMLDivElement | null = null;
let scrollEl:  HTMLDivElement | null = null;
let volumeSliderEl: HTMLInputElement | null = null;

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
    '.untrace-volume.is-disabled::-webkit-slider-thumb { background: #d4c8b0; }',
    '.untrace-volume.is-disabled::-moz-range-thumb { background: #d4c8b0; }',
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

const SOUND_VIB_HEADER_STYLE = [
  `font-family:${FONT_HEADING}`, 'font-size:16px', 'font-weight:600',
  `color:${C_TEXT}`, 'letter-spacing:-0.01em',
  'margin:0 0 12px', 'user-select:none',
].join(';');

/** Combined Sound & Vibration section. Disabling sound greys the slider. */
function buildSoundAndVibrationSection(): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = 'margin:0 0 16px;';

  const label = document.createElement('p');
  label.textContent = 'Sound & Vibration';
  label.style.cssText = SOUND_VIB_HEADER_STYLE;
  section.appendChild(label);

  // ── Sound on/off toggle row — 16px bottom gap before the slider ─────────
  const soundRow = document.createElement('div');
  soundRow.style.cssText = TOGGLE_ROW_STYLE + ';margin-bottom:16px;';

  const soundText = document.createElement('span');
  soundText.textContent = 'Sound';
  soundText.style.cssText = TOGGLE_LABEL_TEXT_STYLE;

  const soundToggle = createPillToggle('Sound', !getSavedMuted(), (on) => {
    saveMuted(!on);
    applyAudioSettings();
    applySliderEnabledState(on);
    if (on) { playBgMusic(); } else { stopBgMusic(); }
  });

  soundRow.appendChild(soundText);
  soundRow.appendChild(soundToggle);
  section.appendChild(soundRow);

  // ── Volume slider row ────────────────────────────────────────────────────
  const sliderRow = document.createElement('div');
  sliderRow.style.cssText = 'display:flex;align-items:center;padding:4px 0;margin-bottom:16px;';

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
  volumeSliderEl = slider;

  slider.addEventListener('input', () => {
    const v = snapVolume(parseInt(slider.value, 10));
    slider.value = String(v);
    saveVolume(v);
    applyVolumeToTrack();
    applyAudioSettings();
  });

  sliderRow.appendChild(slider);
  section.appendChild(sliderRow);

  // ── Vibration toggle row ─────────────────────────────────────────────────
  const vibRow = document.createElement('div');
  vibRow.style.cssText = TOGGLE_ROW_STYLE + ';margin-bottom:0;';

  const vibText = document.createElement('span');
  vibText.textContent = 'Vibration';
  vibText.style.cssText = TOGGLE_LABEL_TEXT_STYLE;

  const vibToggle = createPillToggle('Vibration', getSavedVibration(), (on) => {
    saveVibration(on);
  });

  vibRow.appendChild(vibText);
  vibRow.appendChild(vibToggle);
  section.appendChild(vibRow);

  // Apply initial enabled state from current mute flag.
  applySliderEnabledState(!getSavedMuted());

  return section;
}

/** Paint the slider fill track with the current volume value. */
function applyVolumeToTrack(): void {
  if (!volumeSliderEl) return;
  const v = parseInt(volumeSliderEl.value, 10);
  const muted = getSavedMuted();
  const fill = muted ? '#d4c8b0' : C_PRIMARY;
  volumeSliderEl.style.background =
    `linear-gradient(to right, ${fill} 0%, ${fill} ${v}%, ${C_RECESSED} ${v}%, ${C_RECESSED} 100%)`;
}

/** Grey/disable the volume slider when sound is off. */
function applySliderEnabledState(on: boolean): void {
  if (!volumeSliderEl) return;
  if (on) {
    volumeSliderEl.classList.remove('is-disabled');
    volumeSliderEl.style.opacity       = '1';
    volumeSliderEl.style.pointerEvents = 'auto';
    volumeSliderEl.style.cursor        = 'pointer';
  } else {
    volumeSliderEl.classList.add('is-disabled');
    volumeSliderEl.style.opacity       = '0.4';
    volumeSliderEl.style.pointerEvents = 'none';
    volumeSliderEl.style.cursor        = 'default';
  }
  applyVolumeToTrack();
}

function buildProgressSection(): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = 'margin:0 0 16px;';

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

// ─── Close icon (matches the in-game Reset button) ───────────────────────────

const CLOSE_X_SVG = `
<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
  <path d="M6 6l12 12M18 6l-12 12"/>
</svg>`;

// ─── Build full-screen settings overlay ──────────────────────────────────────

function buildOverlay(ui: HTMLElement): void {
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

  // ── Top bar — single flex row containing title (centered) and close button
  // (absolute). Matches the in-game top bar: env+12 padding-top, 44px content
  // height, 16px side padding. Shared flex container guarantees alignment.
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
  title.textContent = 'Settings';
  title.style.cssText = [
    `font-family:${FONT_HEADING}`, 'font-size:22px', 'font-weight:700',
    `color:${C_TEXT}`, 'letter-spacing:-0.01em',
  ].join(';');

  // Close button — 40x40 recessed circle, absolute inside the row. top/bottom
  // + margin:auto vertically centers the button in the 44px content area
  // without a hand-tuned top offset.
  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('aria-label', 'Close settings');
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
  addPressFeedback(closeBtn);
  closeBtn.addEventListener('click', () => { playButtonTap(); hideSettings(); });

  topBar.appendChild(title);
  topBar.appendChild(closeBtn);

  // ── Scrollable content ───────────────────────────────────────────────────
  // Flex column so the about/footer can be pushed to the bottom when content
  // is shorter than the viewport. When content overflows the spacer collapses
  // to 0 and the footer sits naturally at the end of the scroll.
  scrollEl = document.createElement('div');
  scrollEl.style.cssText = [
    'flex:1', 'overflow-y:auto', '-webkit-overflow-scrolling:touch',
    'overscroll-behavior:contain',
    'padding:28px 20px calc(env(safe-area-inset-bottom, 0px) + 32px)',
    'display:flex', 'flex-direction:column',
  ].join(';');

  const divider = document.createElement('div');
  divider.style.cssText = `height:1px;background:${C_RECESSED};margin:16px 0;flex-shrink:0;`;

  const spacer = document.createElement('div');
  spacer.style.cssText = 'flex:1 1 auto;min-height:16px;';

  scrollEl.appendChild(buildSoundAndVibrationSection());
  scrollEl.appendChild(buildProgressSection());
  scrollEl.appendChild(spacer);
  scrollEl.appendChild(divider);
  scrollEl.appendChild(buildAboutSection());

  panelEl.appendChild(topBar);
  panelEl.appendChild(scrollEl);
  overlayEl.appendChild(panelEl);
  ui.appendChild(overlayEl);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the settings modal and schedule saved audio settings to apply on the
 * first user gesture (after audio.ts has initialized its own Tone context).
 */
export function initSettings(): void {
  injectSliderStyles();
  const ui = document.getElementById('ui')!;
  buildOverlay(ui);

  // Audio context can only start on a user gesture (iOS). audio.ts registers
  // its own touchstart/click handler first; ours runs after it and uses a
  // microtask so it applies *after* audio.ts sets its default -6 dB.
  const apply = (): void => { setTimeout(applyAudioSettings, 0); };
  document.documentElement.addEventListener('touchstart', apply, { once: true });
  document.addEventListener('click', apply, { once: true });
}

/** Show the full-screen settings panel (slides up). */
export function showSettings(): void {
  if (!overlayEl || !panelEl) return;
  setDailyButtonVisible(false);
  overlayEl.style.display = 'block';
  panelEl.style.transition = 'none';
  panelEl.style.transform  = 'translateY(100%)';
  if (scrollEl) scrollEl.scrollTop = 0;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!panelEl) return;
      panelEl.style.transition = 'transform 0.3s ease-out';
      panelEl.style.transform  = 'translateY(0)';
    });
  });
}

/** Hide the settings panel (slides back down). */
export function hideSettings(): void {
  if (!overlayEl || !panelEl) return;
  panelEl.style.transition = 'transform 0.3s ease-out';
  panelEl.style.transform  = 'translateY(100%)';
  setTimeout(() => {
    if (overlayEl) overlayEl.style.display = 'none';
    setDailyButtonVisible(true);
  }, 310);
}
