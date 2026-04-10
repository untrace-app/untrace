import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export function hapticSnap(): void {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') {
    Haptics.selectionChanged().catch(() => {
      Haptics.vibrate().catch(() => {});
    });
  } else {
    Haptics.selectionChanged().catch(() => {});
  }
}

void ImpactStyle;
