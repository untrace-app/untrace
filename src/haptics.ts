import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export function hapticSnap(): void {
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
