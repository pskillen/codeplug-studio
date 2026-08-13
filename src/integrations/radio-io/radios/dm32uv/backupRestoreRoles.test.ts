import { describe, expect, it } from 'vitest';
import { DM32_BLOCK_SIZE, DM32_METADATA } from './constants.ts';
import {
  dm32BackupRestoreRole,
  isDm32CalibrationBlock,
  isDm32RestoreNeverWriteBlock,
} from './backupRestoreRoles.ts';

function block(metadata: number, fill = 0x11): Uint8Array {
  const data = new Uint8Array(DM32_BLOCK_SIZE).fill(fill);
  data[DM32_BLOCK_SIZE - 1] = metadata;
  return data;
}

describe('dm32BackupRestoreRole', () => {
  it('marks calibration (0x02) inspect-only', () => {
    const cal = block(DM32_METADATA.CALIBRATION, 0x00);
    expect(dm32BackupRestoreRole(cal)).toBe('inspect-only');
    expect(isDm32CalibrationBlock(cal)).toBe(true);
    expect(isDm32RestoreNeverWriteBlock(cal)).toBe(true);
  });

  it('marks channel / zone / settings blocks restorable', () => {
    expect(dm32BackupRestoreRole(block(DM32_METADATA.CHANNEL_FIRST))).toBe('restorable');
    expect(dm32BackupRestoreRole(block(DM32_METADATA.ZONE))).toBe('restorable');
    expect(dm32BackupRestoreRole(block(DM32_METADATA.VFO_SETTINGS))).toBe('restorable');
  });
});
