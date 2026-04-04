// Tone.js setup, all sound event triggers
// Synths are NOT created at import time — iOS Safari requires AudioContext to
// be created and resumed inside a direct user-gesture handler.

import * as Tone from 'tone';

// ─── State ────────────────────────────────────────────────────────────────────

let isReady      = false;
let _initStarted = false;

// Synth references — assigned inside _doInit(), only accessed when isReady.
let buttonSynth!:  Tone.Synth;
let dotSynth!:     Tone.Synth;
let completePoly!: Tone.PolySynth;
let undoNoise!:    Tone.NoiseSynth;
let undoFilter!:   Tone.Filter;

// Marimba sampler (xylophone samples).
let marimbaSampler!: Tone.Sampler;
let isMarimbaLoaded  = false;

// ─── White-key scale (no sharps/flats) ────────────────────────────────────────

const WHITE_KEYS: readonly string[] = [
  'C3','D3','E3','F3','G3','A3','B3',
  'C4','D4','E4','F4','G4','A4','B4',
  'C5','D5','E5','F5','G5','A5','B5',
];
const NOTE_INDEX_MAX = WHITE_KEYS.length - 1; // 20

// ─── Initialization ───────────────────────────────────────────────────────────

function _doInit(): void {
  if (_initStarted) return;
  _initStarted = true;

  const RawAC = (window.AudioContext
    ?? (window as unknown as Record<string, unknown>).webkitAudioContext) as typeof AudioContext;
  let ctx: AudioContext;
  try {
    ctx = new RawAC();
  } catch {
    return;
  }

  ctx.resume();
  Tone.setContext(ctx);
  Tone.start();

  Tone.getDestination().volume.value = -6;

  // ── UI synths (direct to destination) ─────────────────────────────────────
  buttonSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
    volume: -18,
  }).toDestination();

  dotSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
  }).toDestination();

  completePoly = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.25, sustain: 0, release: 0.12 },
  }).toDestination();

  undoNoise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.05 },
  });
  undoFilter = new Tone.Filter({ frequency: 3000, type: 'lowpass' }).toDestination();
  undoNoise.connect(undoFilter);

  // ── Marimba (xylophone samples) ───────────────────────────────────────────
  marimbaSampler = new Tone.Sampler({
    urls: { G4: 'G4.mp3', C5: 'C5.mp3', G5: 'G5.mp3', C6: 'C6.mp3', G6: 'G6.mp3', C7: 'C7.mp3' },
    baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/xylophone/',
    onload: () => { isMarimbaLoaded = true; },
  }).toDestination();

  isReady = true;
}

// Primary trigger: touchstart on documentElement is more reliable on iOS Safari.
document.documentElement.addEventListener('touchstart', _doInit, { once: true });
document.addEventListener('click', _doInit, { once: true });

// ─── Public init ──────────────────────────────────────────────────────────────

export function initAudio(): void {
  _doInit();
}

// ─── Progress note state ──────────────────────────────────────────────────────

let _noteCursor = 7; // starts at C4

export function resetProgressAudio(): void {
  _noteCursor = 7;
}

// ─── Trigger functions ────────────────────────────────────────────────────────

export function playButtonTap(): void {
  if (!isReady) return;
  buttonSynth.triggerAttackRelease('A5', 0.05);
}

export function playDotTouch(): void {
  if (!isReady) return;
  dotSynth.triggerAttackRelease('C6', 0.05);
}

export function playProgressNote(erased: boolean): void {
  if (!isReady) return;

  if (erased) {
    _noteCursor += 1;
  } else {
    _noteCursor -= 1;
  }
  _noteCursor = Math.max(0, Math.min(NOTE_INDEX_MAX, _noteCursor));

  const note = WHITE_KEYS[_noteCursor]!;
  if (isMarimbaLoaded) {
    marimbaSampler.triggerAttackRelease(note, 0.4, Tone.now(), 0.4);
  } else {
    dotSynth.triggerAttackRelease(note, 0.08);
  }
}

const COMPLETE_NOTES_SYNTH: readonly string[] = [
  'C4', 'E4', 'G4', 'B4', 'D5', 'F#5', 'A5', 'C6',
];
const COMPLETE_STEP = 0.1;

const COMPLETE_WHITE_NOTES: readonly string[] = [
  WHITE_KEYS[NOTE_INDEX_MAX - 4]!,
  WHITE_KEYS[NOTE_INDEX_MAX - 3]!,
  WHITE_KEYS[NOTE_INDEX_MAX - 2]!,
  WHITE_KEYS[NOTE_INDEX_MAX - 1]!,
  WHITE_KEYS[NOTE_INDEX_MAX]!,
];

export function playPuzzleComplete(): void {
  if (!isReady) return;
  const now = Tone.now();
  if (isMarimbaLoaded) {
    COMPLETE_WHITE_NOTES.forEach((note, i) => {
      marimbaSampler.triggerAttackRelease(note, 0.5, now + i * COMPLETE_STEP, 0.55);
    });
  } else {
    COMPLETE_NOTES_SYNTH.forEach((note, i) => {
      completePoly.triggerAttackRelease(note, 0.25, now + i * COMPLETE_STEP);
    });
  }
}

export function playUndo(): void {
  if (!isReady) return;
  const now = Tone.now();
  undoFilter.frequency.cancelScheduledValues(now);
  undoFilter.frequency.setValueAtTime(3000, now);
  undoFilter.frequency.linearRampToValueAtTime(150, now + 0.2);
  undoNoise.triggerAttackRelease(0.15, now);
}
