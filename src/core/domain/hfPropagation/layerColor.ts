import type { IonosphericLayerId } from './types.ts';

/** Canonical inner→outer order — explode offsets and visibility toggles use this, not filtered array index. */
export const IONOSPHERIC_LAYER_IDS: readonly IonosphericLayerId[] = ['D', 'E', 'F1', 'F2'];

const LAYER_COLORS: Record<IonosphericLayerId, string> = {
  // Brighter cyan-blue so D does not vanish into the blue-marble oceans.
  D: '#5ec8ff',
  E: '#3ddc97',
  F1: '#f5c451',
  F2: '#ff6b6b',
};

/** Shared D/E/F1/F2 shell colours for the globe, top-down, and vertical-slice views. */
export function colorForLayer(id: IonosphericLayerId): string {
  return LAYER_COLORS[id];
}
