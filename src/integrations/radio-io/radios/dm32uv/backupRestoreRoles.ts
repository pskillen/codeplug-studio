/**
 * DM-32UV backup region roles — restorable vs inspect-only.
 *
 * Calibration blocks (metadata 0x02 at offset 0xFFF) stay in the zip for
 * diagnostics. Restore never writes them. This radio has no LocalInfo bank.
 */

import type { RadioBackupRegionRole } from '../../backup/types.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET } from './constants.ts';
import { classifyDm32Metadata } from './memory.ts';

export function dm32BlockMetadata(data: Uint8Array): number | undefined {
  if (data.byteLength >= DM32_BLOCK_SIZE) {
    return data[DM32_METADATA_OFFSET] ?? data[data.byteLength - 1];
  }
  if (data.byteLength > 0) return data[data.byteLength - 1];
  return undefined;
}

export function isDm32CalibrationBlock(data: Uint8Array): boolean {
  const meta = dm32BlockMetadata(data);
  if (meta === undefined) return false;
  return meta === DM32_METADATA.CALIBRATION || classifyDm32Metadata(meta) === 'calibration';
}

export function dm32BackupRestoreRole(data: Uint8Array): RadioBackupRegionRole {
  return isDm32CalibrationBlock(data) ? 'inspect-only' : 'restorable';
}

export function isDm32RestoreNeverWriteBlock(data: Uint8Array): boolean {
  return dm32BackupRestoreRole(data) === 'inspect-only';
}
