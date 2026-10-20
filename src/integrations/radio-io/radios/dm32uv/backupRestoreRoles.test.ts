import { describe, expect, it } from 'vitest';
import { DM32_BLOCK_SIZE, DM32_METADATA } from './constants.ts';
import { selectDm32CalibrationPages, type Dm32ConfigWindow } from './memory.ts';
import {
  dm32BackupRestoreRole,
  isDm32CalibrationBlock,
  isDm32RestoreNeverWriteBlock,
  isDm32Tag02OutsideConfigWindow,
} from './backupRestoreRoles.ts';

/** Reference-radio V-frame `0x0A` window: 0x001000–0x0C8FFF, aligned end 0x0C8000. */
const WINDOW: Dm32ConfigWindow = { start: 0x1000, end: 0xc8000 };

/** Fonts and voice on the reference radio. Last byte happens to be `0x02`. */
const OUTSIDE_WINDOW = [0x105000, 0x116000, 0x218000, 0x24a000, 0x25d000] as const;

function block(metadata: number, fill = 0x11): Uint8Array {
  const data = new Uint8Array(DM32_BLOCK_SIZE).fill(fill);
  data[DM32_BLOCK_SIZE - 1] = metadata;
  return data;
}

describe('dm32BackupRestoreRole', () => {
  it('marks an in-range calibration page inspect-only', () => {
    const cal = block(DM32_METADATA.CALIBRATION, 0x00);
    expect(dm32BackupRestoreRole(cal, 0xb8000, WINDOW)).toBe('inspect-only');
    expect(isDm32CalibrationBlock(cal, 0xb8000, WINDOW)).toBe(true);
    expect(isDm32RestoreNeverWriteBlock(cal, 0xb8000, WINDOW)).toBe(true);
  });

  it('does not treat a 4KB page ending in 0x02 outside the window as calibration', () => {
    const page = block(DM32_METADATA.CALIBRATION, 0x00);
    for (const address of OUTSIDE_WINDOW) {
      expect(isDm32CalibrationBlock(page, address, WINDOW)).toBe(false);
      expect(dm32BackupRestoreRole(page, address, WINDOW)).toBe('restorable');
      expect(isDm32Tag02OutsideConfigWindow(page, address, WINDOW)).toBe(true);
    }
  });

  it('marks channel / zone / settings blocks restorable', () => {
    expect(dm32BackupRestoreRole(block(DM32_METADATA.CHANNEL_FIRST), 0x1000, WINDOW)).toBe(
      'restorable',
    );
    expect(dm32BackupRestoreRole(block(DM32_METADATA.ZONE), 0x2000, WINDOW)).toBe('restorable');
    expect(dm32BackupRestoreRole(block(DM32_METADATA.VFO_SETTINGS), 0x3000, WINDOW)).toBe(
      'restorable',
    );
  });
});

describe('selectDm32CalibrationPages', () => {
  it('keeps the lower in-range page as live and reports the higher one as a duplicate', () => {
    const selected = selectDm32CalibrationPages(
      [
        { address: 0xc0000, metadata: DM32_METADATA.CALIBRATION },
        { address: 0x105000, metadata: DM32_METADATA.CALIBRATION },
        { address: 0xb8000, metadata: DM32_METADATA.CALIBRATION },
        { address: 0x2000, metadata: DM32_METADATA.ZONE },
      ],
      WINDOW,
    );
    expect(selected.live).toEqual({ address: 0xb8000, metadata: DM32_METADATA.CALIBRATION });
    expect(selected.duplicates).toEqual([
      { address: 0xc0000, metadata: DM32_METADATA.CALIBRATION },
    ]);
  });
});
