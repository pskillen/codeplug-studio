import type { ScanInclusion } from '@core/models/library.ts';
import type { EffectiveScanInclusion } from './resolve.ts';

/** CHIRP `Skip` column: `S` = skip; empty = participate in scan. */
export function formatChirpSkipColumn(effective: EffectiveScanInclusion): string {
  return effective === 'skip' ? 'S' : '';
}

export function parseChirpSkipColumn(wire: string): ScanInclusion {
  return wire.trim().toUpperCase() === 'S' ? 'skip' : 'default';
}

/** OpenGD77 `All Skip` column: Yes = skip; No = participate. */
export function formatOpenGd77AllSkip(effective: EffectiveScanInclusion): boolean {
  return effective === 'skip';
}

export function parseOpenGd77AllSkip(wire: string): ScanInclusion {
  const normalized = wire.trim().toLowerCase();
  if (normalized === 'yes' || normalized === 'y' || normalized === 'true' || normalized === '1') {
    return 'skip';
  }
  if (normalized === 'no' || normalized === 'n' || normalized === 'false' || normalized === '0') {
    return 'default';
  }
  return 'default';
}
