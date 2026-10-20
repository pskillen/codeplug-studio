/**
 * DM-32UV backup region roles — restorable vs inspect-only.
 *
 * Tag `0x02` at offset `0xFFF` is the calibration page only inside the live
 * V-frame `0x0A` window. Restore never writes that page. Pages that end in
 * `0x02` outside the window (fonts, voice) are not calibration and are not
 * packed into the zip. This radio has no LocalInfo bank.
 */

import type { RadioBackupRegionRole } from '../../backup/types.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET } from './constants.ts';
import {
  classifyDm32Metadata,
  isDm32AddressInConfigWindow,
  type Dm32ConfigWindow,
} from './memory.ts';

export function dm32BlockMetadata(data: Uint8Array): number | undefined {
  if (data.byteLength >= DM32_BLOCK_SIZE) {
    return data[DM32_METADATA_OFFSET] ?? data[data.byteLength - 1];
  }
  if (data.byteLength > 0) return data[data.byteLength - 1];
  return undefined;
}

export function isDm32CalibrationBlock(
  data: Uint8Array,
  address: number,
  window: Dm32ConfigWindow,
): boolean {
  if (!isDm32AddressInConfigWindow(address, window)) return false;
  const meta = dm32BlockMetadata(data);
  if (meta === undefined) return false;
  return meta === DM32_METADATA.CALIBRATION || classifyDm32Metadata(meta) === 'calibration';
}

/** Tag `0x02` whose address is outside the live V-frame `0x0A` window. */
export function isDm32Tag02OutsideConfigWindow(
  data: Uint8Array,
  address: number,
  window: Dm32ConfigWindow,
): boolean {
  const meta = dm32BlockMetadata(data);
  if (meta !== DM32_METADATA.CALIBRATION) return false;
  return !isDm32AddressInConfigWindow(address, window);
}

export function dm32BackupRestoreRole(
  data: Uint8Array,
  address: number,
  window: Dm32ConfigWindow,
): RadioBackupRegionRole {
  return isDm32CalibrationBlock(data, address, window) ? 'inspect-only' : 'restorable';
}

export function isDm32RestoreNeverWriteBlock(
  data: Uint8Array,
  address: number,
  window: Dm32ConfigWindow,
): boolean {
  return dm32BackupRestoreRole(data, address, window) === 'inspect-only';
}
