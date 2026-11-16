import {
  RT95_PROGRAM_PASSWORD_ADDRESS,
  RT95_PROGRAM_PASSWORD_LENGTH,
} from '@core/radios/retevis/rt95/calibration.ts';
import { RT95_POWER_ON_PASSWORD_DIGITS } from '@core/radios/retevis/rt95/radioSettings.ts';
import { RT95_POWER_ON_PASSWORD_ADDRESS } from './constants.ts';
import { RT95_CALIBRATION_REGION_ID } from './debugCapture.ts';
import { RT95_PROGRAMMING_IMAGE_REGION_ID } from './restoreFromBackup.ts';

/** Absolute byte range `[start, end)` holding a secret that debug views mask until revealed. */
export interface DebugSensitiveRange {
  start: number;
  end: number;
  label: string;
}

/** Password bytes inside an RT95 debug-archive region, by region id. */
export function rt95DebugSensitiveRanges(regionId: string): readonly DebugSensitiveRange[] {
  if (regionId === RT95_CALIBRATION_REGION_ID)
    return [
      {
        start: RT95_PROGRAM_PASSWORD_ADDRESS,
        end: RT95_PROGRAM_PASSWORD_ADDRESS + RT95_PROGRAM_PASSWORD_LENGTH,
        label: 'Program password',
      },
    ];
  if (regionId === RT95_PROGRAMMING_IMAGE_REGION_ID)
    return [
      {
        start: RT95_POWER_ON_PASSWORD_ADDRESS,
        end: RT95_POWER_ON_PASSWORD_ADDRESS + RT95_POWER_ON_PASSWORD_DIGITS,
        label: 'Power-on password',
      },
    ];
  return [];
}
