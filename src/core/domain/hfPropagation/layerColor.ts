import type { IonosphericLayerId } from './types.ts';

const LAYER_COLORS: Record<IonosphericLayerId, string> = {
  D: '#4d7cff',
  E: '#3ddc97',
  F1: '#f5c451',
  F2: '#ff6b6b',
};

/** Shared D/E/F1/F2 shell colours for the globe, top-down, and vertical-slice views. */
export function colorForLayer(id: IonosphericLayerId): string {
  return LAYER_COLORS[id];
}
