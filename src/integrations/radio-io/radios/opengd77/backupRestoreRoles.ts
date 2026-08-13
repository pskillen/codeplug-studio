/**
 * OpenGD77 / OpenUV380 backup region roles — restorable vs inspect-only.
 *
 * Backup packs the registered FLASH programming spans. Studio has no isolated
 * calibration or LocalInfo table on this map (FirmwareInfo is mem 0x09, not
 * FLASH). Write-codeplug still keeps settings / APRS / DTMF / VFO / boot from
 * the live prior; Restore **does** replay those bytes because they sit inside
 * restorable FLASH spans.
 */

import type { RadioBackupRegionRole } from '../../backup/types.ts';
import { OPENUV380_FLASH_SPANS } from './constants.ts';

export interface OpenGd77BackupFlashSpan {
  id: string;
  label: string;
  start: number;
  length: number;
  restoreRole: RadioBackupRegionRole;
}

/**
 * One named zip region per registered OpenUV380 FLASH span.
 * All spans are restorable — do not invent a calibration offset.
 */
export const OPENGD77_BACKUP_FLASH_SPANS: readonly OpenGd77BackupFlashSpan[] =
  OPENUV380_FLASH_SPANS.map((span, i) => ({
    id: `flash-span-${i}`,
    label: `FLASH span ${i + 1}`,
    start: span.start,
    length: span.length,
    restoreRole: 'restorable' as const,
  }));

export function openGd77BackupSpanForAddress(address: number): OpenGd77BackupFlashSpan | undefined {
  return OPENGD77_BACKUP_FLASH_SPANS.find(
    (span) => address >= span.start && address < span.start + span.length,
  );
}

export function openGd77BackupRestoreRole(address: number): RadioBackupRegionRole {
  const span = openGd77BackupSpanForAddress(address);
  return span?.restoreRole ?? 'inspect-only';
}

export function isOpenGd77RestoreNeverWriteAddress(address: number): boolean {
  return openGd77BackupRestoreRole(address) === 'inspect-only';
}
