/**
 * AT-D890UV range change: post-change verification. Read only; sends no `W`.
 *
 * After the radio has rebooted, LocalInfo should differ from the backup only at `+0x03`, and the tune bank
 * (`0x04F00000`) only at `+0x28` (the firmware rewrites it with the new range).
 *
 * Known possible false positive: the firmware loader reads tune `+0x700` and the boot rewrite may not write it
 * back, so on a radio where it is not `FF`, `tuneDiffs` can list `+0x700..+0x711` even though the change worked.
 * Radio check RT-2 records whether that happens. `identBandCode` is supplied by the caller; this function does
 * not read the ident.
 */

import type { BytePipe } from '../../../types.ts';
import { atD890ReadMemory } from '../connection.ts';
import { D890_MAP } from '../constants.ts';
import { LOCAL_INFO_SERIAL_LENGTH, LOCAL_INFO_SERIAL_OFFSET } from '../identityCheck.ts';
import { AT_D890_LOCAL_INFO_RANGE_OFFSET } from './rangeChangeFrame.ts';

const TUNE_START = 0x04f00000;
const TUNE_RANGE_OFFSET = 0x28;

export interface AtD890RangeChangeVerifyOptions {
  /** The sanitised range code from the ident (byte 8), read after the reboot. */
  identBandCode: number;
  backupLocalInfo: Uint8Array;
  /** Tune bank from the backup; callers pass `0x2000` bytes. Omit to skip the tune comparison. */
  backupTune?: Uint8Array;
  target: number;
}

export interface AtD890RangeChangeVerifyResult {
  /** The ident reports the target. */
  rangeIsTarget: boolean;
  /** The ident still reports the old code (the change did not take). */
  rangeIsOld: boolean;
  /** The 16-byte serial at LocalInfo `+0x30` is unchanged: this is still the same radio. */
  serialMatches: boolean;
  /** LocalInfo offsets that differ from the backup, other than `+0x03`. */
  localInfoDiffs: number[];
  /** Tune offsets that differ from the backup, other than `+0x28`. */
  tuneDiffs: number[];
  tuneChecked: boolean;
}

function diffOffsets(a: Uint8Array, b: Uint8Array, except: number): number[] {
  const out: number[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (i !== except && a[i] !== b[i]) out.push(i);
  return out;
}

export async function verifyAtD890RangeChange(
  pipe: BytePipe,
  opts: AtD890RangeChangeVerifyOptions,
  signal?: AbortSignal,
): Promise<AtD890RangeChangeVerifyResult> {
  const { identBandCode, backupLocalInfo, backupTune, target } = opts;
  const liveLocalInfo = await atD890ReadMemory(
    pipe,
    D890_MAP.LocalInfo,
    D890_MAP.LocalInfoLength,
    signal,
  );
  const localInfoDiffs = diffOffsets(
    liveLocalInfo,
    backupLocalInfo.subarray(0, D890_MAP.LocalInfoLength),
    AT_D890_LOCAL_INFO_RANGE_OFFSET,
  );
  let tuneDiffs: number[] = [];
  if (backupTune) {
    const liveTune = await atD890ReadMemory(pipe, TUNE_START, backupTune.length, signal);
    tuneDiffs = diffOffsets(liveTune, backupTune, TUNE_RANGE_OFFSET);
  }
  return {
    rangeIsTarget:
      identBandCode === target && liveLocalInfo[AT_D890_LOCAL_INFO_RANGE_OFFSET] === target,
    rangeIsOld:
      identBandCode === backupLocalInfo[AT_D890_LOCAL_INFO_RANGE_OFFSET] &&
      liveLocalInfo[AT_D890_LOCAL_INFO_RANGE_OFFSET] ===
        backupLocalInfo[AT_D890_LOCAL_INFO_RANGE_OFFSET],
    serialMatches: Array.from({ length: LOCAL_INFO_SERIAL_LENGTH }).every(
      (_, i) =>
        liveLocalInfo[LOCAL_INFO_SERIAL_OFFSET + i] ===
        backupLocalInfo[LOCAL_INFO_SERIAL_OFFSET + i],
    ),
    localInfoDiffs,
    tuneDiffs,
    tuneChecked: backupTune !== undefined,
  };
}
