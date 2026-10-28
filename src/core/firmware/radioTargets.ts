/**
 * Which codeplug radio targets belong to each firmware radio. Used only to link the flasher's "back up first" panel
 * to matching builds' Backup tabs; it keeps radio target ids out of `src/app/`.
 */
import type { FirmwareRadioId } from './types.ts';

const RADIO_TARGET_IDS: Readonly<Record<FirmwareRadioId, readonly string[]>> = {
  'baofeng-dm32uv': ['baofeng-dm32uv', 'baofeng-dm32uv-mm9pdy'],
  'anytone-at-d890uv': ['anytone-at-d890uv', 'anytone-at-d890uv-mm9pdy'],
  'retevis-rt95-head': ['retevis-rt95'],
};

export function radioTargetIdsForFirmwareRadio(radioId: FirmwareRadioId): readonly string[] {
  return RADIO_TARGET_IDS[radioId];
}
