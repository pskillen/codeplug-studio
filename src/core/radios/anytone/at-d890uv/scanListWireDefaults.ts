/**
 * AT-D890UV scan-list timing wire defaults (serial + CSV).
 * Default when build `exportSettings` unset; editable via build export settings ([#1069](https://github.com/pskillen/codeplug-studio/issues/1069));
 * per-list library settings remain [#572](https://github.com/pskillen/codeplug-studio/issues/572).
 */

import type { BuildExportSettings } from '@core/models/radioBuild.ts';

/** Deciseconds on the binary record wire (3.0 s). */
export const AT_D890_SCAN_TIMING_DECISECONDS = 30;

/** Seconds string for `ScanList.CSV` timing columns. */
export const AT_D890_SCAN_TIMING_SECONDS_CSV = '3.0';

const LOOK_BACK_MIN_SECONDS = 0.5;
const LOOK_BACK_MAX_SECONDS = 5.0;
const DELAY_MIN_SECONDS = 0.1;
const DELAY_MAX_SECONDS = 5.0;

export type AtD890ScanListTimingSettings = Pick<
  BuildExportSettings,
  | 'scanListLookBackASeconds'
  | 'scanListLookBackBSeconds'
  | 'scanListDropoutDelaySeconds'
  | 'scanListDwellTimeSeconds'
>;

export interface AtD890ResolvedScanListTiming {
  csv: {
    lookBackA: string;
    lookBackB: string;
    dropoutDelay: string;
    dwellTime: string;
  };
  deciseconds: {
    lookBackA: number;
    lookBackB: number;
    dropoutDelay: number;
    dwellTime: number;
  };
}

function clampRoundSeconds(value: number, min: number, max: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  return Math.round(clamped * 10) / 10;
}

function secondsToCsv(seconds: number): string {
  return seconds.toFixed(1);
}

function secondsToDeciseconds(seconds: number): number {
  return Math.round(seconds * 10);
}

function resolveLookBackSeconds(value: number | undefined): { csv: string; deciseconds: number } {
  const seconds =
    value === undefined
      ? Number.parseFloat(AT_D890_SCAN_TIMING_SECONDS_CSV)
      : clampRoundSeconds(value, LOOK_BACK_MIN_SECONDS, LOOK_BACK_MAX_SECONDS);
  return { csv: secondsToCsv(seconds), deciseconds: secondsToDeciseconds(seconds) };
}

function resolveDelaySeconds(value: number | undefined): { csv: string; deciseconds: number } {
  const seconds =
    value === undefined
      ? Number.parseFloat(AT_D890_SCAN_TIMING_SECONDS_CSV)
      : clampRoundSeconds(value, DELAY_MIN_SECONDS, DELAY_MAX_SECONDS);
  return { csv: secondsToCsv(seconds), deciseconds: secondsToDeciseconds(seconds) };
}

/** Resolve build export settings (or unset) to CSV strings and serial deciseconds for all four timing fields. */
export function resolveAtD890ScanListTiming(
  settings?: AtD890ScanListTimingSettings | null,
): AtD890ResolvedScanListTiming {
  const lookBackA = resolveLookBackSeconds(settings?.scanListLookBackASeconds);
  const lookBackB = resolveLookBackSeconds(settings?.scanListLookBackBSeconds);
  const dropoutDelay = resolveDelaySeconds(settings?.scanListDropoutDelaySeconds);
  const dwellTime = resolveDelaySeconds(settings?.scanListDwellTimeSeconds);
  return {
    csv: {
      lookBackA: lookBackA.csv,
      lookBackB: lookBackB.csv,
      dropoutDelay: dropoutDelay.csv,
      dwellTime: dwellTime.csv,
    },
    deciseconds: {
      lookBackA: lookBackA.deciseconds,
      lookBackB: lookBackB.deciseconds,
      dropoutDelay: dropoutDelay.deciseconds,
      dwellTime: dwellTime.deciseconds,
    },
  };
}
