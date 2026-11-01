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

/**
 * Hardware model (`RADIO_MODELS` id) each flasher radio belongs to. The flasher installs the published MM9PDY
 * modded firmware, so the landing-page support matrix reads "can Studio flash this?" from here. Keeps model ids
 * out of `src/app/`.
 */
const MODEL_ID_BY_FIRMWARE_RADIO: Readonly<Record<FirmwareRadioId, string>> = {
  'baofeng-dm32uv': 'baofeng-dm32uv',
  'anytone-at-d890uv': 'anytone-at-d890uv',
  'retevis-rt95-head': 'retevis-rt95',
};

export function modelIdForFirmwareRadio(radioId: FirmwareRadioId): string {
  return MODEL_ID_BY_FIRMWARE_RADIO[radioId];
}

/** The flasher radio for a hardware model, if Studio can flash it at all (before any per-site gating). */
export function firmwareRadioIdForModel(modelId: string): FirmwareRadioId | undefined {
  return (Object.keys(MODEL_ID_BY_FIRMWARE_RADIO) as FirmwareRadioId[]).find(
    (id) => MODEL_ID_BY_FIRMWARE_RADIO[id] === modelId,
  );
}
