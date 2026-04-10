import { Haptics, ImpactStyle } from '@capacitor/haptics';

export function hapticLight(): void {
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

export function hapticMedium(): void {
  Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
}

export function hapticHeavy(): void {
  Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
}
