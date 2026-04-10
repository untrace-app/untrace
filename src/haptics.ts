import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

function vibrationEnabled(): boolean {
  try {
    const raw = localStorage.getItem('untrace_vibration');
    if (raw === null) return true;
    return raw === '1';
  } catch {
    return true;
  }
}

export function hapticSnap(): void {
  if (!vibrationEnabled()) return;
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') {
    Haptics.selectionChanged().catch(() => {
      Haptics.vibrate().catch(() => {});
    });
  } else {
    Haptics.vibrate({ duration: 3 }).catch(() => {});
  }
}

void ImpactStyle;
