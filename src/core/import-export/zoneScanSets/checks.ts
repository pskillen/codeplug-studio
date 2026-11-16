/**
 * Write and export warnings for zone scan sets, and the hook each radio fills in.
 * All three warn; none refuses (pskillen/firmware-mods#13, zone-scan.md, Radios without stock zones).
 */

import { pushZoneScanSetWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';

/** A zone scan set below this size gives the radio's stock "cannot scan" response. */
export const ZONE_SCAN_SET_MIN_CHANNELS = 2;

/** One zone's scan set as the radio will write it. */
export interface ZoneScanSetOnRadio {
  /** The zone's name as written to the radio. */
  zoneName: string;
  /** Radio channel numbers in the zone's scan set. */
  scanChannelNumbers: readonly number[];
}

/** This hook describes firmware that cannot store sets; its caller leaves them unwritten. */
export interface ZoneScanSetFirmwareTooOld {
  /** How the radio knows, in the operator's words (e.g. "the radio reports firmware 1.0.0"). */
  reason: string;
}

/** The radio has less room for scan sets than the build needs. */
export interface ZoneScanSetRoomExceeded {
  /** What the radio holds, in `unit`. */
  limit: number;
  /** What these scan sets need, in `unit`. */
  needed: number;
  /** What is counted, plural (e.g. "zone scan sets", "bytes"). */
  unit: string;
  /** What happens to the zones that don't fit, one sentence (e.g. "Zones after the 20th scan as before."). */
  consequence: string;
}

/**
 * What a radio supplies. Each check is optional: a radio leaves out what it can't know.
 * `firmwareTooOld` returns `undefined` when the firmware stores scan sets (or the radio can't tell);
 * `roomExceeded` returns `undefined` when the sets fit.
 */
export interface ZoneScanSetRadioChecks {
  firmwareTooOld?: () => ZoneScanSetFirmwareTooOld | undefined;
  roomExceeded?: (sets: readonly ZoneScanSetOnRadio[]) => ZoneScanSetRoomExceeded | undefined;
}

export interface ZoneScanSetCheckResult {
  /** False when the firmware is too old: the writer leaves the scan sets out. */
  writeScanSets: boolean;
}

/**
 * Run the common checks and the radio's hooks, pushing warnings. Firmware first: when it is too old
 * the scan sets aren't written, so the per-zone checks are skipped. Radios that write anyway use
 * their own compatibility warning and still run the per-zone checks.
 */
export function checkZoneScanSets(
  sets: readonly ZoneScanSetOnRadio[],
  checks: ZoneScanSetRadioChecks,
  warnings: ExportWarning[],
): ZoneScanSetCheckResult {
  const tooOld = checks.firmwareTooOld?.();
  if (tooOld) {
    pushZoneScanSetWarning(warnings, { issue: 'firmware-too-old', reason: tooOld.reason });
    return { writeScanSets: false };
  }

  for (const set of sets) {
    const count = new Set(set.scanChannelNumbers).size;
    if (count < ZONE_SCAN_SET_MIN_CHANNELS) {
      pushZoneScanSetWarning(warnings, { issue: 'too-few', zoneName: set.zoneName, count });
    }
  }

  const room = checks.roomExceeded?.(sets);
  if (room) {
    pushZoneScanSetWarning(warnings, { issue: 'room-exceeded', ...room });
  }

  return { writeScanSets: true };
}
