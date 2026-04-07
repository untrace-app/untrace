// Full-screen level transition splash shown between levels on "Next Level".

let overlayEl:         HTMLDivElement | null = null;
let numberEl:          HTMLElement | null = null;
let nameEl:            HTMLElement | null = null;
let _pendingResolve:   (() => void) | null = null;
let _pendingOnCovered: (() => void) | null = null;
let _settled = true;

function ensureOverlay(): HTMLDivElement {
  if (overlayEl) return overlayEl;

  overlayEl = document.createElement('div');
  overlayEl.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:10000',
    'background:#ffedcd',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center',
    'opacity:0', 'pointer-events:none',
    'transition:opacity 0.3s ease',
  ].join(';');

  numberEl = document.createElement('div');
  numberEl.style.cssText = [
    "font-family:'Lexend',system-ui,sans-serif",
    'font-size:3rem', 'font-weight:700', 'color:#b17025',
    'margin:0', 'line-height:1.2',
  ].join(';');

  nameEl = document.createElement('div');
  nameEl.style.cssText = [
    "font-family:'Manrope',system-ui,sans-serif",
    'font-size:14px', 'font-weight:400', 'color:#7f7c6c',
    'letter-spacing:0.1em', 'text-transform:uppercase',
    'margin:8px 0 0',
  ].join(';');

  overlayEl.appendChild(numberEl);
  overlayEl.appendChild(nameEl);
  document.body.appendChild(overlayEl);
  return overlayEl;
}

/**
 * Show the level transition splash.
 * @param levelNumber  Display number (1-based).
 * @param levelName    Display name.
 * @param onCovered    Called once the splash is fully opaque — use this to
 *                     dismiss the celebration card and load new level data
 *                     behind the splash where the user can't see it.
 * @returns Promise that resolves after the splash has fully faded out.
 */
export function showLevelTransition(
  levelNumber: number,
  levelName: string,
  onCovered?: () => void,
): Promise<void> {
  _settled = false;
  _pendingOnCovered = onCovered ?? null;

  const el = ensureOverlay();
  numberEl!.textContent = `Level ${levelNumber}`;
  nameEl!.textContent   = levelName;

  // Reset to invisible, force reflow, then fade in.
  el.style.transition    = 'none';
  el.style.opacity       = '0';
  el.style.pointerEvents = 'auto';
  void el.offsetWidth;
  el.style.transition = 'opacity 0.3s ease';
  el.style.opacity    = '1';

  return new Promise((resolve) => {
    _pendingResolve = resolve;
    // After fade-in (300ms): splash is fully opaque.
    setTimeout(() => {
      if (_settled) return;
      // Safe to mutate the world behind the splash — user can't see it.
      onCovered?.();
      _pendingOnCovered = null;

      // Hold for 1s, then fade out.
      setTimeout(() => {
        if (_settled) return;
        el.style.opacity = '0';
        setTimeout(() => {
          if (_settled) return;
          _settled = true;
          el.style.pointerEvents = 'none';
          _pendingResolve = null;
          resolve();
        }, 300);
      }, 1000);
    }, 300);
  });
}

/** Skip transition to completion after page suspension. */
export function recoverLevelTransition(): void {
  if (!_pendingResolve) return;
  _settled = true;
  if (_pendingOnCovered) {
    _pendingOnCovered();
    _pendingOnCovered = null;
  }
  if (overlayEl) {
    overlayEl.style.transition    = 'none';
    overlayEl.style.opacity       = '0';
    overlayEl.style.pointerEvents = 'none';
  }
  const resolve = _pendingResolve;
  _pendingResolve = null;
  resolve();
}
