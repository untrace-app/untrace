// All tunable numbers: colors, sizes, timing values, radius thresholds, animation durations, audio pitches

// ─── Colors ───────────────────────────────────────────────────────────────────

export const COLOR_BACKGROUND = '#0A0A0F';

// Dots
export const COLOR_DOT_INACTIVE = '#2A2A35';
export const COLOR_DOT_ACTIVE   = '#FFFFFF';

// Layer colors (index 1–5 maps to red–white)
export const COLOR_LAYER_RED    = '#FF6B6B';
export const COLOR_LAYER_AMBER  = '#FFB347';
export const COLOR_LAYER_TEAL   = '#4ECDC4';
export const COLOR_LAYER_VIOLET = '#9B6BFF';
export const COLOR_LAYER_WHITE  = '#E8E8F0';

// Ordered array: index 0 unused (0 = empty), indices 1–5 match layer numbers
export const LAYER_COLORS: readonly string[] = [
  '',           // 0 — empty, no color
  COLOR_LAYER_RED,
  COLOR_LAYER_AMBER,
  COLOR_LAYER_TEAL,
  COLOR_LAYER_VIOLET,
  COLOR_LAYER_WHITE,
];

// Feedback
export const COLOR_ACCIDENTAL_FLASH = '#FF4444';

// UI text
export const COLOR_UI_TEXT           = '#FFFFFF';
export const COLOR_UI_TEXT_SECONDARY = '#8888AA';

// ─── Sizes ────────────────────────────────────────────────────────────────────

export const DOT_RADIUS      = 12; // px — rendered dot circle radius
export const LINE_WIDTH_BASE =  6; // px — single-layer line width
export const SNAP_RADIUS     = 40; // px — max distance from touch to snap to a dot

// ─── Grid Layout ──────────────────────────────────────────────────────────────

/** Fraction of the smaller screen dimension used by the grid (0–1). */
export const GRID_FILL_RATIO = 0.70;

// ─── Animation Durations (ms) ─────────────────────────────────────────────────

export const ANIM_ERASE_MS           = 200; // layer dissolve on erase
export const ANIM_SHIMMER_MS         = 100; // layer-beneath reveal shimmer
export const ANIM_GHOST_TRAIL_MS     = 300; // final-layer ghost trail fade
export const ANIM_ACCIDENTAL_FLASH_MS = 100; // accidental-draw red flash
export const ANIM_DOT_ACTIVATION_MS  = 150; // dot glow on touch

// ─── Input ────────────────────────────────────────────────────────────────────

export const INPUT_DEBOUNCE_MS = 50; // pointermove buffer debounce interval

// ─── Audio Pitch Map ──────────────────────────────────────────────────────────

export const AUDIO_PITCH_RED    = 'C5';
export const AUDIO_PITCH_AMBER  = 'A4';
export const AUDIO_PITCH_TEAL   = 'F4';
export const AUDIO_PITCH_VIOLET = 'D4';
export const AUDIO_PITCH_WHITE  = 'B3';

/** Ordered array: index 1–5 matches layer numbers (index 0 unused). */
export const LAYER_PITCHES: readonly string[] = [
  '',                // 0 — empty
  AUDIO_PITCH_RED,
  AUDIO_PITCH_AMBER,
  AUDIO_PITCH_TEAL,
  AUDIO_PITCH_VIOLET,
  AUDIO_PITCH_WHITE,
];
