// Tone.js setup, all sound event triggers
// Tone.js is dynamically imported inside initAudio() to prevent AudioContext
// creation before a user gesture. No top-level import.

// ─── State ────────────────────────────────────────────────────────────────────

type ToneModule = typeof import('tone');
let Tone: ToneModule | null = null;

let isReady      = false;
let _initStarted = false;

// Synth references — assigned inside _doInit(), only accessed when isReady.
// Typed as `any` because Tone types aren't available until the dynamic import.
let buttonSynth:    any;
let dotSynth:       any;
let completePoly:   any;
let undoNoise:      any;
let undoFilter:     any;

// Marimba sampler (xylophone samples).
let marimbaSampler: any;
let isMarimbaLoaded  = false;

// Pop sound for dot intro animation.
let popPlayer:  any;
let isPopLoaded = false;

// Board appear sound for intro animation.
let boardPlayer:  any;
let isBoardLoaded = false;

// Background music (looping ambient track).
let bgPlayer:      any;
let isBgLoaded    = false;
let _bgShouldPlay = false; // tracks intent while file is still loading


// ─── White-key scale (no sharps/flats) ────────────────────────────────────────

const WHITE_KEYS: readonly string[] = [
  'C3','D3','E3','F3','G3','A3','B3',
  'C4','D4','E4','F4','G4','A4','B4',
  'C5','D5','E5','F5','G5','A5','B5',
];
const NOTE_INDEX_MAX = WHITE_KEYS.length - 1; // 20

// ─── Initialization ───────────────────────────────────────────────────────────

/**
 * Load an audio file as an ArrayBuffer, decode it, and wrap it in a Tone.Player.
 *
 * This bypasses Tone.js's internal XHR loader, which cannot handle the
 * `capacitor://localhost` scheme used by Capacitor native builds. fetch()
 * *can* load from capacitor:// URLs, so we fetch + decode manually and hand
 * the decoded AudioBuffer to the Player.
 *
 * NOTE: On Capacitor iOS, fetch() of local assets returns response.status === 0
 * even though the body is present. Do NOT check response.ok or status — just
 * read the body directly.
 */
async function loadPlayer(path: string, onReady: () => void): Promise<any> {
  if (!Tone) throw new Error('Tone not initialized');
  const response = await fetch(path);
  const arrayBuffer = await response.arrayBuffer();
  console.log(`[audio] ${path} fetched: ${arrayBuffer.byteLength} bytes`);
  const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
  const player = new Tone.Player(audioBuffer).toDestination();
  onReady();
  return player;
}

async function _doInit(): Promise<void> {
  if (_initStarted) return;
  _initStarted = true;

  Tone = await import('tone');

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

  try {
    // ── UI synths (direct to destination) ───────────────────────────────────
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

    // ── Marimba (xylophone samples) ─────────────────────────────────────────
    marimbaSampler = new Tone.Sampler({
      urls: { G4: 'G4.mp3', C5: 'C5.mp3', G5: 'G5.mp3', C6: 'C6.mp3', G6: 'G6.mp3', C7: 'C7.mp3' },
      baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/xylophone/',
      onload: () => {
        isMarimbaLoaded = true;
        console.log('[audio] marimba samples loaded from CDN');
      },
      onerror: (err: unknown) => {
        console.error('[audio] marimba samples FAILED to load:', err);
      },
    }).toDestination();

    // ── mp3 players: fetch → decode → Tone.Player ───────────────────────────
    // Uses relative paths. fetch() works with capacitor:// URLs even though
    // Tone.Player's built-in loader does not. Each loader is wrapped in its
    // own try/catch so one failure doesn't block the other audio.

    // ── Pop sound for intro animation ────────────────────────────────────────
    try {
      popPlayer = await loadPlayer('/pop.mp3', () => { isPopLoaded = true; });
      console.log('[audio] pop.mp3 loaded');
    } catch (err) {
      console.error('[audio] pop.mp3 FAILED to load:', err);
    }

    // ── Board appear sound for intro animation ───────────────────────────────
    try {
      boardPlayer = await loadPlayer('/board.mp3', () => { isBoardLoaded = true; });
      console.log('[audio] board.mp3 loaded');
    } catch (err) {
      console.error('[audio] board.mp3 FAILED to load:', err);
    }

    // ── Background music (looping ambient track) ─────────────────────────────
    try {
      bgPlayer = await loadPlayer('/bg-music.mp3', () => { isBgLoaded = true; });
      bgPlayer.loop        = true;
      bgPlayer.volume.value = -18;
      console.log('[audio] bg-music.mp3 loaded');
      if (_bgShouldPlay) bgPlayer.start();
    } catch (err) {
      console.error('[audio] bg-music.mp3 FAILED to load:', err);
    }

    // Set master volume after all nodes are connected to the destination.
    try { Tone.getDestination().volume.value = -6; } catch { /* destination not ready */ }
  } catch {
    return;
  }

  isReady = true;
}

// ─── Public init ──────────────────────────────────────────────────────────────

export async function initAudio(): Promise<void> {
  await _doInit();
}

// ─── Audio context helpers (for main.ts visibility/focus handlers) ────────────

export function resumeAudioContext(): void {
  if (!Tone) return;
  void Tone.context.resume();
}

export function getDestinationNode(): { volume: { value: number }; mute: boolean } | null {
  if (!Tone) return null;
  try { return Tone.getDestination(); } catch { return null; }
}

// ─── Progress note state ──────────────────────────────────────────────────────

let _noteCursor = 7; // starts at C4

export function resetProgressAudio(): void {
  _noteCursor = 7;
}

// ─── Trigger functions ────────────────────────────────────────────────────────

export function playButtonTap(): void {
  if (!Tone || !isReady) return;
  buttonSynth.triggerAttackRelease('A5', 0.05);
}

export function playDotTouch(): void {
  if (!Tone || !isReady) return;
  dotSynth.triggerAttackRelease('C6', 0.05);
}

export function playPop(): void {
  if (!Tone || !isReady || !isPopLoaded) return;
  popPlayer.stop();
  popPlayer.start();
}

export function playBoardAppear(): void {
  if (!Tone || !isReady || !isBoardLoaded) return;
  boardPlayer.stop();
  boardPlayer.start();
}

export function playProgressNote(erased: boolean): void {
  if (!Tone || !isReady) return;

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
  if (!Tone || !isReady) return;
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
  if (!Tone || !isReady) return;
  const now = Tone.now();
  undoFilter.frequency.cancelScheduledValues(now);
  undoFilter.frequency.setValueAtTime(3000, now);
  undoFilter.frequency.linearRampToValueAtTime(150, now + 0.2);
  undoNoise.triggerAttackRelease(0.15, now);
}

export function playBgMusic(): void {
  if (!Tone || !isReady) return;
  _bgShouldPlay = true;
  if (isBgLoaded && !bgPlayer.state.includes('started')) bgPlayer.start();
}

export function stopBgMusic(): void {
  _bgShouldPlay = false;
  if (!Tone || !isReady || !isBgLoaded) return;
  if (bgPlayer.state.includes('started')) bgPlayer.stop();
}

export function setBgVolume(vol: number): void {
  if (!Tone || !isReady) return;
  bgPlayer.volume.value = vol;
}
