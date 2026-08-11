/**
 * Write satellite keps to the Anytone AT-D890UV over Web Serial (#856).
 *
 * No UI trigger yet (#859) — this is a standalone service function, exercised by tests only,
 * matching the existing precedent of `radioIoAtD890Write.test.ts` (full-codeplug write).
 *
 * ## Design decision: does NOT reuse `session.radio.upload()`
 *
 * The plan for this ticket originally proposed reusing `session.radio.upload(image, opts)` —
 * the same primitive `writeBuildToRadio` uses — with a small sparse `MemoryMap` containing
 * only satellite records, reasoning that it already handles PROGRAM-session framing and
 * enforces the writable-extents fence internally.
 *
 * That assumption did not hold. `AtD890uvProtocol.upload()` (`radios/at-d890uv/protocol.ts`)
 * is not a generic "upload any sparse MemoryMap" primitive — it:
 *
 * 1. Requires `this.cache.blocks` to already be non-empty (throws "no sparse blocks" if not),
 *    i.e. it requires a prior `download()` (Read) or `seedDownloadCache()` to have run first.
 * 2. Extracts only a hardcoded set of *known* banks (`ChannelSet`, `ZoneSet`, `ScanListSet`,
 *    …) from the passed `MemoryMap` via `applyAtD890WriteImageToCache()` — an unmodelled
 *    region like the satellite table would be silently dropped, not written.
 *
 * Reusing it would mean requiring every satellite-only write to first perform a full
 * codeplug Read, which contradicts the RE doc's own finding that satellite writes are a
 * separate, independent PROGRAM session (`DeviceRWType::SATELLITE_DATA`, independent of
 * `RADIO_DATA`) — see docs/reference/radios/anytone/at-d890uv/satellite-keps.md
 * ("Write-session shape").
 *
 * This is the documented fallback the plan anticipated: `writeSatellitesToRadio` below talks
 * to the pipe directly via `uploadAtD890SatelliteRecords` (`radios/at-d890uv/satelliteWrite.ts`),
 * which reuses the same generic, already-hardened erase-unit RMW helpers `upload()` itself
 * uses (`sparseEraseRmw.ts`, `eraseUnits.ts`) — so the "far less new protocol code" goal of
 * the original design still mostly holds, even though the top-level primitive changed.
 *
 * Session setup is genuinely unchanged, as the plan predicted: by the time a `RadioSession`
 * exists, `AtD890uvProtocol.connect()` has already entered PROGRAM mode, and
 * `closeRadioSession()` exits it — this module does not open or close PROGRAM mode itself.
 */

import type { Satellite } from '@core/models/satellite.ts';
import { isTransmitterWriteEligible } from '@core/domain/satellite/transmitterWriteEligibility.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import {
  AT_D890_SATELLITE,
  listCapabilitySkippedTransmitters,
  packSatelliteWriteRecords,
  uploadAtD890SatelliteRecords,
  type CapabilitySkippedTransmitter,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';
import type { ProgressFn, RadioSession } from '@integrations/radio-io/index.ts';
import { RadioWriteBlockedError } from './radioIoSession.ts';

export interface WriteSatellitesToRadioResult {
  /** Record count actually uploaded. */
  written: number;
  /** Satellites with zero eligible transmitters — not an error, just nothing to write. */
  skipped: { satelliteId: string; reason: string }[];
  /**
   * Individual transmitters that would otherwise have been written but were dropped because
   * the D890 doesn't support their `mode` (#1068) — distinct from `skipped` above, which is
   * satellite-level ("nothing at all to write for this satellite").
   */
  skippedTransmitters: CapabilitySkippedTransmitter[];
}

/**
 * Satellites with no generically write-eligible transmitter at all (`isTransmitterWriteEligible`
 * false for every transmitter — disabled satellite, opted-out/dismissed transmitters, or none).
 * Checked against the generic predicate directly, not "did this satellite end up with a wire
 * record" — a satellite whose only eligible transmitter was capability-filtered (#1068) already
 * has its own specific reason in `skippedTransmitters`, so it is intentionally not duplicated
 * here with the generic "no write-eligible transmitters" reason.
 */
function skippedSatellites(
  satellites: readonly Satellite[],
): { satelliteId: string; reason: string }[] {
  return satellites
    .filter((s) => !s.transmitters.some((t) => isTransmitterWriteEligible(s, t)))
    .map((s) => ({ satelliteId: s.id, reason: 'No write-eligible transmitters.' }));
}

/**
 * Write satellite keps to a connected AT-D890UV.
 *
 * Only supports the D890 today — this function is not multi-radio. Callers are responsible
 * for confirming `session.descriptor` is a D890 before calling.
 */
export async function writeSatellitesToRadio(
  session: RadioSession,
  satellites: readonly Satellite[],
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<WriteSatellitesToRadioResult> {
  const records = packSatelliteWriteRecords(
    satellites,
    AT_D890_SATELLITE.BASE_ADDRESS,
    AT_D890_SATELLITE.RECORD_STRIDE,
  );

  // Capacity check before touching the serial port — no partial write.
  if (records.length > AT_D890UV_LIMITS.SATELLITE_MAX) {
    const radioLabel = session.descriptor.label;
    throw new RadioWriteBlockedError(
      `You have selected ${records.length} satellites, but the ${radioLabel} only supports ` +
        `${AT_D890UV_LIMITS.SATELLITE_MAX} (placeholder pending hardware confirmation — see ` +
        `docs/reference/radios/anytone/at-d890uv/satellite-keps.md). Please deselect some ` +
        `satellites in the library.`,
      { selected: records.length, max: AT_D890UV_LIMITS.SATELLITE_MAX, radioLabel },
    );
  }

  await uploadAtD890SatelliteRecords(session.pipe, records, {
    onProgress: opts?.onProgress,
    signal: opts?.signal,
  });

  return {
    written: records.length,
    skipped: skippedSatellites(satellites),
    skippedTransmitters: listCapabilitySkippedTransmitters(satellites),
  };
}
