import type { IonosphericLayerId } from './types.ts';

/** Canonical inner→outer order — explode offsets and visibility toggles use this, not filtered array index. */
export const IONOSPHERIC_LAYER_IDS: readonly IonosphericLayerId[] = ['D', 'E', 'F1', 'F2'];

const LAYER_COLORS: Record<IonosphericLayerId, string> = {
  // Inner→outer warm→cool so D contrasts against the blue-marble globe.
  D: '#ff6b6b',
  E: '#f5c451',
  F1: '#3ddc97',
  F2: '#5ec8ff',
};

/** Shared D/E/F1/F2 shell colours for the globe, top-down, and vertical-slice views. */
export function colorForLayer(id: IonosphericLayerId): string {
  return LAYER_COLORS[id];
}
