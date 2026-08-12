/**
 * Anytone AT-D890UV satellite keps write codec — packs `(Satellite, SatelliteTransmitter)`
 * pairs into `0x200`-byte wire records (#856).
 *
 * Cite: docs/reference/radios/anytone/at-d890uv/satellite-keps.md (#855) — record layout,
 * offsets, and field lengths below mirror that doc's "Record layout" table exactly (facts
 * only, no GPL source pasted). Everything there is flagged "not hardware-verified."
 */

import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { isTransmitterWriteEligible } from '@core/domain/satellite/transmitterWriteEligibility.ts';
import {
  isFrequencyInD890SatelliteRange,
  isModeSupportedByAtD890,
} from '@core/radios/anytone/at-d890uv/satelliteCapability.ts';
import { ctcssIndexFromHz } from './ctcssToneTable.ts';

/** Wire record size — zero-initialized before fields are written (satellite-keps.md). */
export const SATELLITE_RECORD_BYTES = 0x200;

export interface SatelliteWriteRecord {
  satelliteId: string;
  transmitterId: string;
  address: number;
  /** Exactly {@link SATELLITE_RECORD_BYTES} bytes. */
  bytes: Uint8Array;
}

/**
 * Which `(satellite, transmitter)` pairs get a wire record.
 *
 * This is the vendor-neutral `isTransmitterWriteEligible` predicate
 * (`src/core/domain/satellite/transmitterWriteEligibility.ts`), kept under this name for the
 * D890 codec's existing internal call sites and the `isAtD890SatelliteWriteEligible` external
 * re-export (`./index.ts`). See that module's doc comment for the `!dismissed` judgment call.
 */
export const isWriteEligible = isTransmitterWriteEligible;

interface EligiblePair {
  satellite: Satellite;
  transmitter: SatelliteTransmitter;
}

/** A generically write-eligible transmitter skipped because the D890 can't use its `mode`. */
export interface CapabilitySkippedTransmitter {
  satelliteId: string;
  transmitterId: string;
  reason: string;
}

/**
 * A transmitter's uplink AND downlink (when set) must both fall inside the D890's ham-band
 * TX ranges — see `isFrequencyInD890SatelliteRange`'s doc comment for which rows apply and
 * why. Either frequency being unset does not disqualify on its own.
 */
function isFrequencyEligibleForAtD890(transmitter: SatelliteTransmitter): boolean {
  return (
    isFrequencyInD890SatelliteRange(transmitter.uplinkHz) &&
    isFrequencyInD890SatelliteRange(transmitter.downlinkHz)
  );
}

function listEligiblePairs(satellites: readonly Satellite[]): EligiblePair[] {
  const pairs: EligiblePair[] = [];
  for (const satellite of satellites) {
    for (const transmitter of satellite.transmitters) {
      if (
        isWriteEligible(satellite, transmitter) &&
        isModeSupportedByAtD890(transmitter.mode) &&
        isFrequencyEligibleForAtD890(transmitter)
      ) {
        pairs.push({ satellite, transmitter });
      }
    }
  }
  return pairs;
}

/** MHz, matching `isFrequencyInD890SatelliteRange`'s bare `hz / 1_000_000` conversion. */
function formatMhz(hz: number): string {
  return `${(hz / 1_000_000).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')} MHz`;
}

/**
 * Generically write-eligible `(satellite, transmitter)` pairs that `packSatelliteWriteRecords`
 * drops for a D890-specific reason: either the transmitter's `mode` is not on the D890 mode
 * allowlist (`isModeSupportedByAtD890`, #1068/#1086), or its uplink/downlink frequency falls
 * outside the D890's ham-band TX ranges (`isFrequencyInD890SatelliteRange`, #1085 follow-up) —
 * each reported with its own distinct reason string, not conflated. Distinct from
 * `WriteSatellitesToRadioResult.skipped` (satellite-level, "no eligible transmitters at all",
 * #856).
 */
export function listCapabilitySkippedTransmitters(
  satellites: readonly Satellite[],
): CapabilitySkippedTransmitter[] {
  const skipped: CapabilitySkippedTransmitter[] = [];
  for (const satellite of satellites) {
    for (const transmitter of satellite.transmitters) {
      if (!isWriteEligible(satellite, transmitter)) continue;

      if (!isModeSupportedByAtD890(transmitter.mode)) {
        skipped.push({
          satelliteId: satellite.id,
          transmitterId: transmitter.id,
          reason:
            `${transmitter.mode ?? 'unknown mode'} not supported by Anytone D890 ` +
            `(placeholder pending hardware confirmation).`,
        });
        continue;
      }

      if (!isFrequencyInD890SatelliteRange(transmitter.uplinkHz)) {
        skipped.push({
          satelliteId: satellite.id,
          transmitterId: transmitter.id,
          reason:
            `Uplink ${formatMhz(transmitter.uplinkHz!)} outside Anytone D890 ham-band range ` +
            `(136-174/400-480 MHz).`,
        });
        continue;
      }

      if (!isFrequencyInD890SatelliteRange(transmitter.downlinkHz)) {
        skipped.push({
          satelliteId: satellite.id,
          transmitterId: transmitter.id,
          reason:
            `Downlink ${formatMhz(transmitter.downlinkHz!)} outside Anytone D890 ham-band range ` +
            `(136-174/400-480 MHz).`,
        });
      }
    }
  }
  return skipped;
}

/**
 * Copy a fixed-width TLE column substring, right-justified (space-padded on the left if the
 * source line is short — should not happen for a valid 69-char TLE line, but this keeps
 * encoding total rather than throwing on malformed data).
 */
function tleField(line: string, start: number, length: number): string {
  const raw = line.slice(start, start + length);
  return raw.length >= length ? raw : raw.padStart(length, ' ');
}

/**
 * TLE column offsets below are derived from the public-domain NORAD/Celestrak two-line
 * element format, reconciled against the wire field lengths in satellite-keps.md (each
 * field beyond inclination/revolution carries one extra leading byte matching the TLE
 * column separator space — a pattern consistent across every field, not a per-field guess).
 * This mapping is an inference from combining a public spec with the RE doc's wire-length
 * facts, not itself read from GPL source — still unverified against real firmware output,
 * per the doc's overall "not hardware-verified" caveat.
 */
function tleEpoch(tleLine1: string): string {
  return tleField(tleLine1, 18, 14); // TLE cols 19-32 (epoch year + day-of-year/fraction).
}

function tleMeanMotionDerivative(tleLine1: string): string {
  return tleField(tleLine1, 32, 11); // TLE cols 33(sep)-43.
}

function tleInclination(tleLine2: string): string {
  return tleField(tleLine2, 8, 8); // TLE cols 9-16.
}

function tleRaan(tleLine2: string): string {
  return tleField(tleLine2, 16, 9); // TLE cols 17(sep)-25.
}

function tleEccentricity(tleLine2: string): string {
  return tleField(tleLine2, 25, 8); // TLE cols 26(sep)-33.
}

function tleArgPerigee(tleLine2: string): string {
  return tleField(tleLine2, 33, 9); // TLE cols 34(sep)-42.
}

function tleMeanAnomaly(tleLine2: string): string {
  return tleField(tleLine2, 42, 9); // TLE cols 43(sep)-51.
}

function tleMeanMotion(tleLine2: string): string {
  return tleField(tleLine2, 51, 12); // TLE cols 52(sep)-63.
}

function tleRevolutionNumber(tleLine2: string): string {
  return tleField(tleLine2, 63, 5); // TLE cols 64-68.
}

function writeAsciiField(data: Uint8Array, offset: number, text: string, length: number): void {
  const encoded = new TextEncoder().encode(text.slice(0, length));
  data.set(encoded.subarray(0, length), offset);
}

/** u32 little-endian — satellite-keps.md's `rx_frequency`/`tx_frequency` encoding. */
function writeU32Le(data: Uint8Array, offset: number, value: number): void {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >>> 8) & 0xff;
  data[offset + 2] = (value >>> 16) & 0xff;
  data[offset + 3] = (value >>> 24) & 0xff;
}

/** Deci-Hz per satellite-keps.md's AO-27 cross-check (stored value = Hz ÷ 10). */
function hzToDeciHz(hz: number | null): number {
  if (hz == null || !Number.isFinite(hz) || hz <= 0) return 0;
  return Math.round(hz / 10);
}

/**
 * Combined name field is 8 bytes — tight for "<satellite name> <transmitter label>".
 * `satellite.name` gets first claim on all 8 bytes; `transmitter.label` only gets to
 * contribute when the name leaves room (#1075 — see satellite-keps.md's "Name field"
 * section for the anytone-cps `Satellite::encode()` cross-check: the vendor's own model has
 * no transmitter/label concept at all, so this combining rule is Studio-only, not
 * vendor-verified).
 *
 * Deliberately still a hard byte-slice — no word-boundary search — matching
 * satellite-keps.md's `leftJustified(8, ' ')` convention. Satellite/transmitter names are
 * typically plain ASCII (e.g. "ISS", "AO-27"), so non-ASCII handling is not modelled here.
 */
function encodeName(satellite: Satellite, transmitter: SatelliteTransmitter): string {
  const name = satellite.name.trim();
  if (name.length >= 8) return name.slice(0, 8).padEnd(8, ' ');
  const combined = `${name} ${transmitter.label}`.trim();
  return combined.slice(0, 8).padEnd(8, ' ');
}

/** CTCSS/DCS type byte: `0` none, `1` CTCSS, `2` DCS. Satellite transmitters have no DCS field. */
function toneTypeByte(toneHz: number | null): number {
  return toneHz != null ? 1 : 0;
}

function toneIndexByte(toneHz: number | null): number {
  if (toneHz == null) return 0;
  return ctcssIndexFromHz(toneHz);
}

/** Encode one `(satellite, transmitter)` pair into its `0x200`-byte wire record. */
export function encodeSatelliteRecord(
  satellite: Satellite,
  transmitter: SatelliteTransmitter,
): Uint8Array {
  const data = new Uint8Array(SATELLITE_RECORD_BYTES);

  writeAsciiField(data, 0x00, encodeName(satellite, transmitter), 8);
  writeAsciiField(data, 0x08, tleEpoch(satellite.tleLine1), 14);
  writeAsciiField(data, 0x16, tleMeanMotionDerivative(satellite.tleLine1), 11);
  writeAsciiField(data, 0x21, tleInclination(satellite.tleLine2), 8);
  writeAsciiField(data, 0x29, tleRaan(satellite.tleLine2), 9);
  writeAsciiField(data, 0x32, tleEccentricity(satellite.tleLine2), 8);
  writeAsciiField(data, 0x3a, tleArgPerigee(satellite.tleLine2), 9);
  writeAsciiField(data, 0x43, tleMeanAnomaly(satellite.tleLine2), 9);
  writeAsciiField(data, 0x4c, tleMeanMotion(satellite.tleLine2), 12);
  writeAsciiField(data, 0x58, tleRevolutionNumber(satellite.tleLine2), 5);

  // RX = downlink (what the operator's radio receives), TX = uplink — per satellite-keps.md's
  // own "RX (downlink)" / "TX (uplink)" field labels.
  writeU32Le(data, 0x60, hzToDeciHz(transmitter.downlinkHz));
  writeU32Le(data, 0x64, hzToDeciHz(transmitter.uplinkHz));

  // "encode" = uplink (what the radio transmits to the satellite); "decode" = downlink
  // (what the radio receives) — per satellite-keps.md's own "encode (uplink)" / "decode
  // (downlink)" field labels.
  data[0x68] = toneTypeByte(transmitter.uplinkToneHz);
  data[0x69] = toneTypeByte(transmitter.downlinkToneHz);
  data[0x6a] = toneIndexByte(transmitter.uplinkToneHz);
  data[0x6b] = toneIndexByte(transmitter.downlinkToneHz);
  // 0x6c-0x6f (DCS encode/decode) stay zero — satellite transmitters have no DCS field.

  return data;
}

/** One `(satellite, transmitter)` pair as it would be written, without encoding wire bytes. */
export interface SatelliteWritePreviewEntry {
  satelliteId: string;
  satelliteName: string;
  transmitterId: string;
  transmitterLabel: string;
  mode: string | null;
  /** Exactly what encodeName() would write to the 8-byte name field, trimmed of padding. */
  encodedName: string;
  uplinkHz: number | null;
  downlinkHz: number | null;
  /** True when encodedName lost information relative to the full name (+label, if it had room). */
  nameTruncated: boolean;
}

/**
 * The untruncated source string `encodeName` draws from — `satellite.name` alone once it
 * already fills the 8-byte budget, otherwise `name + " " + label` (#1075). Comparing
 * `encodeName`'s trimmed output against this tells the UI whether the write dropped
 * information, without duplicating `encodeName`'s own budget-allocation branch a second time.
 */
function nameEncodingSource(satellite: Satellite, transmitter: SatelliteTransmitter): string {
  const name = satellite.name.trim();
  return name.length >= 8 ? name : `${name} ${transmitter.label}`.trim();
}

/**
 * Everything `packSatelliteWriteRecords` would write, in the same wire order, without encoding
 * bytes — lets the UI show operators what would go to the radio before/without triggering an
 * actual write (#1074).
 */
export function previewSatelliteWriteRecords(
  satellites: readonly Satellite[],
): SatelliteWritePreviewEntry[] {
  return listEligiblePairs(satellites).map(({ satellite, transmitter }) => {
    const encodedName = encodeName(satellite, transmitter).trimEnd();
    return {
      satelliteId: satellite.id,
      satelliteName: satellite.name,
      transmitterId: transmitter.id,
      transmitterLabel: transmitter.label,
      mode: transmitter.mode,
      encodedName,
      uplinkHz: transmitter.uplinkHz,
      downlinkHz: transmitter.downlinkHz,
      nameTruncated: encodedName !== nameEncodingSource(satellite, transmitter),
    };
  });
}

/**
 * Pack all write-eligible `(satellite, transmitter)` pairs into sequential wire records.
 * Iterates in existing array order (no sort) — matching anytone-cps's own list-order write.
 */
export function packSatelliteWriteRecords(
  satellites: readonly Satellite[],
  baseAddress: number,
  recordStride: number,
): SatelliteWriteRecord[] {
  const pairs = listEligiblePairs(satellites);
  return pairs.map(({ satellite, transmitter }, index) => ({
    satelliteId: satellite.id,
    transmitterId: transmitter.id,
    address: baseAddress + index * recordStride,
    bytes: encodeSatelliteRecord(satellite, transmitter),
  }));
}
