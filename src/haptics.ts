import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export function hapticSnap(): void {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') {
    Haptics.notification({ type: NotificationType.Success })
      .then(() => console.log('HAPTIC: ios notification success'))
      .catch(() => {
        Haptics.vibrate()
          .then(() => console.log('HAPTIC: ios vibrate fallback'))
          .catch((e) => console.log('HAPTIC: ios failed', e));
      });
  } else {
    Haptics.selectionChanged()
      .then(() => console.log(`HAPTIC: ${platform} selectionChanged`))
      .catch((e) => console.log(`HAPTIC: ${platform} failed`, e));
  }
}

// Reference to satisfy TS if ImpactStyle becomes unused; kept for future tuning.
void ImpactStyle;
