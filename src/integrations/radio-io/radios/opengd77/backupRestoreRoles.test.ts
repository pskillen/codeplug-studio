import { describe, expect, it } from 'vitest';
import { OPENUV380_FLASH_SPANS, OPENUV380_OFFSET } from './constants.ts';
import {
  OPENGD77_BACKUP_FLASH_SPANS,
  isOpenGd77RestoreNeverWriteAddress,
  openGd77BackupRestoreRole,
  openGd77BackupSpanForAddress,
} from './backupRestoreRoles.ts';
import { openGd77KeptRegions } from './writeRole.ts';

describe('OpenGD77 backup restore roles', () => {
  it('classifies every registered FLASH span as restorable', () => {
    expect(OPENGD77_BACKUP_FLASH_SPANS).toHaveLength(OPENUV380_FLASH_SPANS.length);
    expect(OPENGD77_BACKUP_FLASH_SPANS.every((s) => s.restoreRole === 'restorable')).toBe(true);
    expect(OPENGD77_BACKUP_FLASH_SPANS.map((s) => s.id)).toEqual(
      OPENUV380_FLASH_SPANS.map((_, i) => `flash-span-${i}`),
    );
    expect(OPENGD77_BACKUP_FLASH_SPANS[0]!.start).toBe(OPENUV380_FLASH_SPANS[0]!.start);
    expect(OPENGD77_BACKUP_FLASH_SPANS[0]!.length).toBe(OPENUV380_FLASH_SPANS[0]!.length);
  });

  it('treats Write-kept named regions as restorable (they live in FLASH spans)', () => {
    for (const region of openGd77KeptRegions()) {
      expect(openGd77BackupRestoreRole(region.absAddress)).toBe('restorable');
      expect(isOpenGd77RestoreNeverWriteAddress(region.absAddress)).toBe(false);
    }
    expect(openGd77BackupRestoreRole(OPENUV380_OFFSET.settings)).toBe('restorable');
    expect(openGd77BackupRestoreRole(OPENUV380_OFFSET.aprsSettings)).toBe('restorable');
    expect(openGd77BackupRestoreRole(OPENUV380_OFFSET.channelBank0)).toBe('restorable');
  });

  it('does not invent a calibration span; addresses outside FLASH are inspect-only', () => {
    expect(openGd77BackupSpanForAddress(0)).toBeUndefined();
    expect(openGd77BackupRestoreRole(0)).toBe('inspect-only');
    expect(isOpenGd77RestoreNeverWriteAddress(0)).toBe(true);
    expect(OPENGD77_BACKUP_FLASH_SPANS.some((s) => s.id.includes('cal'))).toBe(false);
  });
});
