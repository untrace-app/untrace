import { Haptics } from '@capacitor/haptics';

export function hapticMedium(): void {
  Haptics.selectionChanged().catch(() => {});
}
