import { describe, expect, it } from 'vitest';
import { RT95_CALIBRATION_REGION_ID } from './debugCapture.ts';
import { rt95DebugSensitiveRanges } from './debugSensitive.ts';
import { RT95_PROGRAMMING_IMAGE_REGION_ID } from './restoreFromBackup.ts';

describe('rt95DebugSensitiveRanges', () => {
  it('marks the stored program password in the calibration region', () => {
    expect(rt95DebugSensitiveRanges(RT95_CALIBRATION_REGION_ID)).toEqual([
      { start: 0x3b18, end: 0x3b1c, label: 'Program password' },
    ]);
  });

  it('marks the power-on password digits in the programming image', () => {
    expect(rt95DebugSensitiveRanges(RT95_PROGRAMMING_IMAGE_REGION_ID)).toEqual([
      { start: 0x3240, end: 0x3246, label: 'Power-on password' },
    ]);
  });

  it('marks nothing in other regions', () => {
    expect(rt95DebugSensitiveRanges('rt95-mmd1')).toEqual([]);
  });
});
