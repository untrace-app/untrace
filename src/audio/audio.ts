// Tone.js setup, all sound event triggers

import * as Tone from 'tone';
import { LAYER_PITCHES } from '../constants.ts';

let audioReady = false;

// ─── Master volume ────────────────────────────────────────────────────────────

Tone.getDestination().volume.value = -6; // ~70% perceived loudness

// ─── Dot touch ────────────────────────────────────────────────────────────────
// Short high-frequency sine ping.

const dotSynth = new Tone.Synth({
  oscillator: { type: 'sine' },
  envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
}).toDestination();

// ─── Line erase ───────────────────────────────────────────────────────────────
// Filtered pink-noise burst + pitched sine tone, ~150ms total.

const eraseSine = new Tone.Synth({
  oscillator: { type: 'sine' },
  envelope: { attack: 0.005, decay: 0.09, sustain: 0, release: 0.04 },
}).toDestination();

const eraseNoise = new Tone.NoiseSynth({
  noise: { type: 'pink' },
  envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.03 },
});
const eraseFilter = new Tone.Filter({ frequency: 2200, type: 'bandpass' }).toDestination();
eraseNoise.connect(eraseFilter);

// ─── Final layer erase ────────────────────────────────────────────────────────
// Distinct sine chime with a longer release (~400ms).

const finalSine = new Tone.Synth({
  oscillator: { type: 'sine' },
  envelope: { attack: 0.01, decay: 0.15, sustain: 0.15, release: 0.4 },
}).toDestination();

// ─── Accidental draw ──────────────────────────────────────────────────────────
// Low muted membrane thud, ~100ms — communicates "oops" without punishing.

const drawSynth = new Tone.MembraneSynth({
  pitchDecay: 0.04,
  octaves: 3,
  envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.02 },
}).toDestination();

// ─── Puzzle complete ──────────────────────────────────────────────────────────
// Cascading ascending sine chimes, one every 100ms → ~800ms total.

const completePoly = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'sine' },
  envelope: { attack: 0.01, decay: 0.25, sustain: 0, release: 0.12 },
}).toDestination();

const COMPLETE_NOTES: readonly string[] = [
  'C4', 'E4', 'G4', 'B4', 'D5', 'F#5', 'A5', 'C6',
];
const COMPLETE_STEP = 0.1; // seconds between each chime

// ─── Undo ─────────────────────────────────────────────────────────────────────
// White noise with a lowpass filter sweeping high-to-low over ~200ms.

const undoNoise = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.05 },
});
const undoFilter = new Tone.Filter({ frequency: 3000, type: 'lowpass' }).toDestination();
undoNoise.connect(undoFilter);

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Call once from a user-gesture handler (pointerdown, click, keydown).
 * Resumes the AudioContext — browsers block audio until a gesture fires.
 */
export function initAudio(): void {
  void Tone.start().then(() => {
    audioReady = true;
  });
}

// ─── Trigger functions ────────────────────────────────────────────────────────

export function playDotTouch(): void {
  if (!audioReady) return;
  dotSynth.triggerAttackRelease('C6', 0.05);
}

/** @param layer The layer number being erased (1–5), used to select pitch. */
export function playErase(layer: number): void {
  if (!audioReady) return;
  const pitch = LAYER_PITCHES[layer] || 'C4';
  eraseSine.triggerAttackRelease(pitch, 0.15);
  eraseNoise.triggerAttackRelease(0.1);
}

export function playFinalErase(): void {
  if (!audioReady) return;
  finalSine.triggerAttackRelease('E5', 0.4);
}

export function playAccidentalDraw(): void {
  if (!audioReady) return;
  drawSynth.triggerAttackRelease('C2', 0.1);
}

export function playPuzzleComplete(): void {
  if (!audioReady) return;
  const now = Tone.now();
  COMPLETE_NOTES.forEach((note, i) => {
    completePoly.triggerAttackRelease(note, 0.25, now + i * COMPLETE_STEP);
  });
}

export function playUndo(): void {
  if (!audioReady) return;
  const now = Tone.now();
  undoFilter.frequency.cancelScheduledValues(now);
  undoFilter.frequency.setValueAtTime(3000, now);
  undoFilter.frequency.linearRampToValueAtTime(150, now + 0.2);
  undoNoise.triggerAttackRelease(0.15, now);
}
