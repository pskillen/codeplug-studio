/**
 * RadioFoundry debug-link STORAGE command (0x0F), op 0 INFO — read-only layout state.
 */

export const RADIOFOUNDRY_STORAGE_COMMAND = 0x0f;

export type RadioFoundryStorageRegion = 'none' | 'ours' | 'foreign' | 'unknown';

export interface RadioFoundryStorageInfo {
  region: RadioFoundryStorageRegion;
  claimPending: boolean;
  settings: { address: number; size: number };
  journal: { address: number; size: number };
  calibration: { address: number; size: number };
}

function readU32Le(data: Uint8Array, offset: number): number {
  return (
    data[offset]! | (data[offset + 1]! << 8) | (data[offset + 2]! << 16) | (data[offset + 3]! << 24)
  );
}

/** Parse the 26 INFO bytes after a status-0 reply (region through calibration sizes). */
export function parseRadioFoundryStorageInfo(data: Uint8Array): RadioFoundryStorageInfo {
  const regionByte = data[0]!;
  let region: RadioFoundryStorageRegion;
  if (regionByte === 0) region = 'none';
  else if (regionByte === 1) region = 'ours';
  else if (regionByte === 2) region = 'foreign';
  else region = 'unknown';
  return {
    region,
    claimPending: data[1]! !== 0,
    settings: { address: readU32Le(data, 2), size: readU32Le(data, 6) },
    journal: { address: readU32Le(data, 10), size: readU32Le(data, 14) },
    calibration: { address: readU32Le(data, 18), size: readU32Le(data, 22) },
  };
}
