/**
 * Firmware updater registry — separate from the codeplug radio registry (`../registry.ts`).
 */
import type { FirmwareRadioId } from '@core/firmware/types.ts';

import { DM32UV_FIRMWARE_UPDATER } from '../radios/dm32uv/firmwareUpdate/descriptor.ts';
import type { FirmwareUpdaterDescriptor } from './types.ts';

const FIRMWARE_UPDATERS: readonly FirmwareUpdaterDescriptor[] = [DM32UV_FIRMWARE_UPDATER];

export function listFirmwareUpdaters(): readonly FirmwareUpdaterDescriptor[] {
  return FIRMWARE_UPDATERS;
}

export function getFirmwareUpdater(
  radioId: FirmwareRadioId,
): FirmwareUpdaterDescriptor | undefined {
  return FIRMWARE_UPDATERS.find((d) => d.radioId === radioId);
}
