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
 * The `!dismissed` clause is a judgment call, flagged as such in the #856 planning notes:
 * dismissed rows are hidden from the SatelliteEditor UI, and this codec's position is that
 * they should not silently reach the radio either — a dismissed row reads as "the operator
 * doesn't want this one" even though `includeInWrite` was never explicitly flipped off.
 */
export function isWriteEligible(satellite: Satellite, transmitter: SatelliteTransmitter): boolean {
  return satellite.enabled && transmitter.includeInWrite && !transmitter.dismissed;
}

interface EligiblePair {
  satellite: Satellite;
  transmitter: SatelliteTransmitter;
}

function listEligiblePairs(satellites: readonly Satellite[]): EligiblePair[] {
  const pairs: EligiblePair[] = [];
  for (const satellite of satellites) {
    for (const transmitter of satellite.transmitters) {
      if (isWriteEligible(satellite, transmitter)) {
        pairs.push({ satellite, transmitter });
      }
    }
  }
  return pairs;
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
 * Truncate to 8 ASCII chars, left-justified, space-padded, matching satellite-keps.md's
 * `leftJustified(8, ' ')` convention. Satellite/transmitter names are typically plain ASCII
 * (e.g. "ISS", "AO-27"), so non-ASCII handling is not modelled here.
 */
function encodeName(satellite: Satellite, transmitter: SatelliteTransmitter): string {
  const combined = `${satellite.name} ${transmitter.label}`.trim();
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
