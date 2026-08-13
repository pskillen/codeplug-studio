/**
 * OpenGD77 / OpenUV380 satellite orbital packer — additional-settings block id 3 (#858).
 *
 * Cite: docs/reference/radios/opengd77/satellite-orbitals.md — facts from qdmr
 * SatelliteElement / SatelliteBankElement; not hardware-verified.
 */

import type { BuildEntityOverride } from '@core/models/radioBuild.ts';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { overrideByEntityId } from '@core/domain/formatBuildOverrides.ts';
import { isTransmitterWriteEligible } from '@core/domain/satellite/transmitterWriteEligibility.ts';
import { shortenSatelliteNames } from '@core/domain/satellite/shortenSatelliteNames.ts';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';

export const SATELLITE_RECORD_BYTES = 0x64;
export const SATELLITE_BANK_BYTES = 0x09e0;
export const SATELLITE_BANK_PAYLOAD_BYTES = SATELLITE_BANK_BYTES - 8;
export const ADDITIONAL_SETTINGS_BYTES = 0x11a0;
export const SATELLITE_BLOCK_ID = 3;
export const ADDITIONAL_SETTINGS_VERSION = 1;
export const ADDITIONAL_SETTINGS_MAGIC = 'OpenGD77';

const BLOCKS_OFFSET = 0x0c;
const RECORDS_OFFSET = 0x08;
const UNUSED_TLV = 0xff_ff_ff_ff;

export class OpenGd77AdditionalSettingsVersionError extends Error {
  constructor(version: number) {
    super(
      `OpenGD77 additional-settings version ${version} is not supported (expected ${ADDITIONAL_SETTINGS_VERSION}).`,
    );
    this.name = 'OpenGd77AdditionalSettingsVersionError';
  }
}

export class OpenGd77SatelliteBankFitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenGd77SatelliteBankFitError';
  }
}

export interface OpenGd77SatelliteWritePreviewEntry {
  satelliteId: string;
  satelliteName: string;
  transmitterId: string;
  transmitterLabel: string;
  mode: string | null;
  encodedName: string;
  satelliteWireName: string;
  generatedWireName: string;
  suggestedFamiliarEncoded: string;
  suggestedOscarEncoded: string | null;
  hasWireNameOverride: boolean;
  uplinkHz: number | null;
  downlinkHz: number | null;
  nameTruncated: boolean;
  slot: 'fm' | 'aprs' | 'beacon';
}

export interface CapabilitySkippedTransmitter {
  satelliteId: string;
  transmitterId: string;
  reason: string;
}

export interface OpenGd77PackedSatellite {
  satellite: Satellite;
  encodedName: string;
  generatedShortName: string;
  fromOverride: boolean;
  fm: SatelliteTransmitter | null;
  aprs: SatelliteTransmitter | null;
  beacon: SatelliteTransmitter | null;
}

function writeU32Le(data: Uint8Array, offset: number, value: number): void {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >>> 8) & 0xff;
  data[offset + 2] = (value >>> 16) & 0xff;
  data[offset + 3] = (value >>> 24) & 0xff;
}

function readU32Le(data: Uint8Array, offset: number): number {
  return (
    (data[offset]! |
      (data[offset + 1]! << 8) |
      (data[offset + 2]! << 16) |
      (data[offset + 3]! << 24)) >>>
    0
  );
}

function writeAsciiPad0(data: Uint8Array, offset: number, text: string, length: number): void {
  const slice = text.slice(0, length);
  for (let i = 0; i < length; i++) {
    data[offset + i] = i < slice.length ? slice.charCodeAt(i) & 0xff : 0x00;
  }
}

function addBits(byte: number, bit: number, delta: number): { byte: number; bit: number } {
  const total = byte * 8 + bit + delta;
  return { byte: Math.floor(total / 8), bit: total % 8 };
}

function writeDigit(data: Uint8Array, byte: number, bit: number, digit: number): void {
  if (bit % 4 !== 0) return;
  const val = data[byte] ?? 0;
  data[byte] = (val & ~(0xf << bit)) | ((digit & 0xf) << bit);
}

/** qdmr SatelliteElement::writeInteger — BCD, optional leading blank/minus overwritten when unsigned. */
function writeInteger(
  data: Uint8Array,
  byte: number,
  bit: number,
  value: number,
  sign: boolean,
  dec: number,
): void {
  if (bit % 4 !== 0 || dec === 0) return;
  let intVal = Math.trunc(value);
  writeDigit(data, byte, bit, sign && intVal < 0 ? 0xc : 0xb);
  if (intVal < 0) intVal = -intVal;
  let o = 4 * (dec - 1);
  for (let i = dec; i > 0; i--) {
    const pos = addBits(byte, bit, o);
    writeDigit(data, pos.byte, pos.bit, intVal % 10);
    intVal = Math.trunc(intVal / 10);
    o -= 4;
  }
}

function writeFractional(
  data: Uint8Array,
  byte: number,
  bit: number,
  value: number,
  sign: boolean,
  frac: number,
): void {
  if (bit % 4 !== 0 || frac === 0) return;
  let o = 0;
  if (sign) {
    writeDigit(data, byte, bit, value < 0 ? 0xc : 0xb);
    o += 4;
  }
  let fracVal = Math.abs(value) - Math.trunc(Math.abs(value));
  for (let i = 0; i < frac; i++, o += 4) {
    fracVal *= 10;
    const digit = Math.trunc(fracVal);
    const pos = addBits(byte, bit, o);
    writeDigit(data, pos.byte, pos.bit, digit);
    fracVal -= digit;
  }
}

function writeFixedPoint(
  data: Uint8Array,
  byte: number,
  bit: number,
  value: number,
  sign: boolean,
  dec: number,
  frac: number,
): void {
  writeInteger(data, byte, bit, value, sign, dec);
  let o = 4 * dec + (sign ? 4 : 0);
  let pos = addBits(byte, bit, o);
  writeDigit(data, pos.byte, pos.bit, 0xa);
  o += 4;
  pos = addBits(byte, bit, o);
  const abs = Math.abs(value);
  writeFractional(data, pos.byte, pos.bit, abs - Math.trunc(abs), false, frac);
}

function parseTleEpoch(tleLine1: string): { year: number; day: number } {
  const year = Number.parseInt(tleLine1.slice(18, 20), 10);
  const day = Number.parseFloat(tleLine1.slice(20, 32));
  return {
    year: Number.isFinite(year) ? year : 0,
    day: Number.isFinite(day) ? day : 0,
  };
}

function parseTleMeanMotionDerivative(tleLine1: string): number {
  const raw = tleLine1.slice(33, 43).trim();
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function hzOrZero(hz: number | null | undefined): number {
  if (hz == null || !Number.isFinite(hz) || hz <= 0) return 0;
  return Math.round(hz);
}

/** CTCSS as qdmr `mHz / 100` (0.1 Hz units). */
function ctcssWire(toneHz: number | null | undefined): number {
  if (toneHz == null || !Number.isFinite(toneHz) || toneHz <= 0) return 0;
  return Math.round(toneHz * 10);
}

function normalizeMode(mode: string | null | undefined): string {
  return (mode ?? '').trim().toUpperCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
}

function isFmFamily(mode: string | null | undefined): boolean {
  const n = normalizeMode(mode);
  if (!n) return true;
  return n === 'FM' || n === 'FMN' || n === 'NFM' || n === 'FM NARROW' || n === 'NARROW FM';
}

function isAprsFamily(mode: string | null | undefined, label: string): boolean {
  const blob = `${normalizeMode(mode)} ${label.toUpperCase()}`;
  return /\b(APRS|PACKET|AX\.?25|AFSK)\b/.test(blob);
}

function isBeaconFamily(mode: string | null | undefined, label: string): boolean {
  const blob = `${normalizeMode(mode)} ${label.toUpperCase()}`;
  return /\bBEACON\b/.test(blob);
}

function assignSlots(satellite: Satellite): {
  fm: SatelliteTransmitter | null;
  aprs: SatelliteTransmitter | null;
  beacon: SatelliteTransmitter | null;
  skipped: CapabilitySkippedTransmitter[];
} {
  const eligible = satellite.transmitters.filter((t) => isTransmitterWriteEligible(satellite, t));
  let fm: SatelliteTransmitter | null = null;
  let aprs: SatelliteTransmitter | null = null;
  let beacon: SatelliteTransmitter | null = null;
  const skipped: CapabilitySkippedTransmitter[] = [];

  const take = (
    tx: SatelliteTransmitter,
    current: SatelliteTransmitter | null,
    extraReason: string,
  ): SatelliteTransmitter | null => {
    if (!current) return tx;
    skipped.push({ satelliteId: satellite.id, transmitterId: tx.id, reason: extraReason });
    return current;
  };

  for (const tx of eligible) {
    if (isBeaconFamily(tx.mode, tx.label)) {
      beacon = take(tx, beacon, 'Only one beacon frequency fits an OpenGD77 satellite record.');
      continue;
    }
    if (isAprsFamily(tx.mode, tx.label)) {
      aprs = take(tx, aprs, 'Only one APRS pair fits an OpenGD77 satellite record.');
      continue;
    }
    if (isFmFamily(tx.mode)) {
      fm = take(tx, fm, 'Only one FM pair fits an OpenGD77 satellite record.');
      continue;
    }
    skipped.push({
      satelliteId: satellite.id,
      transmitterId: tx.id,
      reason: `${tx.mode ?? 'unknown mode'} has no OpenGD77 satellite slot (FM, APRS, or beacon).`,
    });
  }

  return { fm, aprs, beacon, skipped };
}

export function listOpenGd77WriteSatellites(satellites: readonly Satellite[]): Satellite[] {
  return satellites.filter((satellite) => {
    if (!satellite.enabled) return false;
    if (satellite.transmitters.length === 0) return true;
    return satellite.transmitters.some((t) => isTransmitterWriteEligible(satellite, t));
  });
}

export function skippedSatellites(
  satellites: readonly Satellite[],
): { satelliteId: string; reason: string }[] {
  return satellites
    .filter((s) => s.enabled)
    .filter((s) => {
      if (s.transmitters.length === 0) return false;
      return !s.transmitters.some((t) => isTransmitterWriteEligible(s, t));
    })
    .map((s) => ({ satelliteId: s.id, reason: 'No write-eligible transmitters.' }));
}

export function listCapabilitySkippedTransmitters(
  satellites: readonly Satellite[],
): CapabilitySkippedTransmitter[] {
  const out: CapabilitySkippedTransmitter[] = [];
  for (const satellite of listOpenGd77WriteSatellites(satellites)) {
    out.push(...assignSlots(satellite).skipped);
  }
  return out;
}

function resolvePacked(
  satellites: readonly Satellite[],
  satelliteOverrides?: readonly BuildEntityOverride[],
): OpenGd77PackedSatellite[] {
  const selected = listOpenGd77WriteSatellites(satellites);
  const names = shortenSatelliteNames(
    selected.map((s) => ({ id: s.id, name: s.name, noradId: s.noradId })),
    { maxLength: OPENGD77_FAMILY_LIMITS.SATELLITE_NAME_LENGTH },
  );
  const overrides = overrideByEntityId(satelliteOverrides);

  return selected.map((satellite) => {
    const slots = assignSlots(satellite);
    const primary = slots.fm ?? slots.aprs ?? slots.beacon;
    const generated = names.get(satellite.id)?.generatedShortName ?? satellite.name;
    let encodedName = generated.slice(0, OPENGD77_FAMILY_LIMITS.SATELLITE_NAME_LENGTH);
    let fromOverride = false;
    if (primary) {
      const override = overrides.get(primary.id)?.wireName?.trim();
      if (override) {
        encodedName = override.slice(0, OPENGD77_FAMILY_LIMITS.SATELLITE_NAME_LENGTH);
        fromOverride = true;
      }
    }
    return {
      satellite,
      encodedName,
      generatedShortName: generated,
      fromOverride,
      fm: slots.fm,
      aprs: slots.aprs,
      beacon: slots.beacon,
    };
  });
}

export function countWriteEligibleSatelliteRecords(satellites: readonly Satellite[]): number {
  return listOpenGd77WriteSatellites(satellites).length;
}

export function encodeSatelliteRecord(
  satellite: Satellite,
  packed: Pick<OpenGd77PackedSatellite, 'encodedName' | 'fm' | 'aprs' | 'beacon'>,
): Uint8Array {
  const data = new Uint8Array(SATELLITE_RECORD_BYTES);
  writeAsciiPad0(data, 0x00, packed.encodedName, OPENGD77_FAMILY_LIMITS.SATELLITE_NAME_LENGTH);

  const epoch = parseTleEpoch(satellite.tleLine1);
  writeInteger(data, 0x08, 4, epoch.year, false, 2);
  writeFixedPoint(data, 0x09, 4, epoch.day, false, 3, 8);
  writeFixedPoint(data, 0x0f, 4, parseTleMeanMotionDerivative(satellite.tleLine1), true, 0, 8);
  writeFixedPoint(data, 0x14, 4, satellite.inclinationDeg, false, 3, 4);
  writeFixedPoint(data, 0x18, 4, satellite.raanDeg, false, 3, 4);
  writeFractional(data, 0x1c, 4, satellite.eccentricity, false, 7);
  writeFixedPoint(data, 0x1f, 0, satellite.argPerigeeDeg, false, 3, 4);
  writeFixedPoint(data, 0x23, 0, satellite.meanAnomalyDeg, false, 3, 4);
  writeFixedPoint(data, 0x27, 0, satellite.meanMotionRevPerDay, false, 2, 8);
  writeInteger(data, 0x2d, 4, satellite.revolutionNumber, false, 5);

  writeU32Le(data, 0x30, hzOrZero(packed.fm?.downlinkHz));
  writeU32Le(data, 0x34, hzOrZero(packed.fm?.uplinkHz));
  writeU32Le(data, 0x38, ctcssWire(packed.fm?.uplinkToneHz));
  writeU32Le(data, 0x3c, hzOrZero(packed.aprs?.downlinkHz));
  writeU32Le(data, 0x40, hzOrZero(packed.aprs?.uplinkHz));
  writeU32Le(data, 0x44, hzOrZero(packed.beacon?.downlinkHz ?? packed.beacon?.uplinkHz));

  return data;
}

export function packSatelliteBank(
  satellites: readonly Satellite[],
  options?: { satelliteOverrides?: readonly BuildEntityOverride[] },
): Uint8Array {
  const packed = resolvePacked(satellites, options?.satelliteOverrides);
  const bank = new Uint8Array(SATELLITE_BANK_BYTES);
  writeU32Le(bank, 0x00, SATELLITE_BLOCK_ID);
  writeU32Le(bank, 0x04, SATELLITE_BANK_PAYLOAD_BYTES);
  for (let i = 0; i < OPENGD77_FAMILY_LIMITS.SATELLITE_MAX; i++) {
    const rec = packed[i];
    const offset = RECORDS_OFFSET + i * SATELLITE_RECORD_BYTES;
    if (!rec) continue;
    bank.set(encodeSatelliteRecord(rec.satellite, rec), offset);
  }
  return bank;
}

export function previewSatelliteWriteRecords(
  satellites: readonly Satellite[],
  options?: { satelliteOverrides?: readonly BuildEntityOverride[] },
): OpenGd77SatelliteWritePreviewEntry[] {
  const packed = resolvePacked(satellites, options?.satelliteOverrides);
  const names = shortenSatelliteNames(
    packed.map((p) => ({
      id: p.satellite.id,
      name: p.satellite.name,
      noradId: p.satellite.noradId,
    })),
    { maxLength: OPENGD77_FAMILY_LIMITS.SATELLITE_NAME_LENGTH },
  );
  const entries: OpenGd77SatelliteWritePreviewEntry[] = [];
  for (const row of packed) {
    const satNames = names.get(row.satellite.id);
    const familiar = satNames?.suggestedFamiliar ?? row.generatedShortName;
    const oscar = satNames?.suggestedOscar ?? null;
    const nameTruncated = row.generatedShortName !== row.satellite.name.trim();
    const push = (slot: 'fm' | 'aprs' | 'beacon', tx: SatelliteTransmitter): void => {
      entries.push({
        satelliteId: row.satellite.id,
        satelliteName: row.satellite.name,
        transmitterId: tx.id,
        transmitterLabel: tx.label,
        mode: tx.mode,
        encodedName: row.encodedName,
        satelliteWireName: row.generatedShortName,
        generatedWireName: row.generatedShortName,
        suggestedFamiliarEncoded: familiar,
        suggestedOscarEncoded: oscar,
        hasWireNameOverride: row.fromOverride,
        uplinkHz: tx.uplinkHz,
        downlinkHz: tx.downlinkHz,
        nameTruncated: nameTruncated || row.generatedShortName !== row.satellite.name.trim(),
        slot,
      });
    };
    if (row.fm) push('fm', row.fm);
    if (row.aprs) push('aprs', row.aprs);
    if (row.beacon) push('beacon', row.beacon);
    if (!row.fm && !row.aprs && !row.beacon) {
      entries.push({
        satelliteId: row.satellite.id,
        satelliteName: row.satellite.name,
        transmitterId: row.satellite.id,
        transmitterLabel: '',
        mode: null,
        encodedName: row.encodedName,
        satelliteWireName: row.generatedShortName,
        generatedWireName: row.generatedShortName,
        suggestedFamiliarEncoded: familiar,
        suggestedOscarEncoded: oscar,
        hasWireNameOverride: row.fromOverride,
        uplinkHz: null,
        downlinkHz: null,
        nameTruncated: row.generatedShortName !== row.satellite.name.trim(),
        slot: 'fm',
      });
    }
  }
  return entries;
}

function readMagic(blob: Uint8Array): string {
  let s = '';
  for (let i = 0; i < 8; i++) {
    const c = blob[i]!;
    if (c === 0 || c === 0xff) break;
    if (c >= 32 && c < 127) s += String.fromCharCode(c);
  }
  return s;
}

function isValidAdditionalSettingsHeader(blob: Uint8Array): boolean {
  return (
    readMagic(blob) === ADDITIONAL_SETTINGS_MAGIC &&
    readU32Le(blob, 0x08) === ADDITIONAL_SETTINGS_VERSION
  );
}

function initializeAdditionalSettingsHeader(blob: Uint8Array): void {
  blob.fill(0xff);
  const magicBytes = new TextEncoder().encode(ADDITIONAL_SETTINGS_MAGIC);
  blob.set(magicBytes.subarray(0, 8), 0);
  for (let i = magicBytes.length; i < 8; i++) blob[i] = 0xff;
  writeU32Le(blob, 0x08, ADDITIONAL_SETTINGS_VERSION);
}

/**
 * Insert or replace satellite bank (block id 3) inside a copy of the additional-settings blob.
 * Preserves other TLV blocks. Initializes a virgin/garbage header; refuses unknown OpenGD77 versions.
 */
export function overlaySatelliteBank(existing: Uint8Array, bank: Uint8Array): Uint8Array {
  if (existing.length < ADDITIONAL_SETTINGS_BYTES) {
    throw new RangeError(
      `Additional settings blob must be ${ADDITIONAL_SETTINGS_BYTES} bytes, got ${existing.length}`,
    );
  }
  if (bank.length !== SATELLITE_BANK_BYTES) {
    throw new RangeError(`Satellite bank must be ${SATELLITE_BANK_BYTES} bytes`);
  }

  const next = existing.slice(0, ADDITIONAL_SETTINGS_BYTES);
  const magic = readMagic(next);
  const version = readU32Le(next, 0x08);
  if (magic === ADDITIONAL_SETTINGS_MAGIC && version !== ADDITIONAL_SETTINGS_VERSION) {
    throw new OpenGd77AdditionalSettingsVersionError(version);
  }
  if (!isValidAdditionalSettingsHeader(next)) {
    initializeAdditionalSettingsHeader(next);
  }

  let offset = BLOCKS_OFFSET;
  while (offset + 8 <= ADDITIONAL_SETTINGS_BYTES) {
    const id = readU32Le(next, offset);
    const payloadSize = readU32Le(next, offset + 4);
    if (id === UNUSED_TLV) {
      if (offset + SATELLITE_BANK_BYTES > ADDITIONAL_SETTINGS_BYTES) {
        throw new OpenGd77SatelliteBankFitError(
          'Additional-settings region has no room for a satellite bank.',
        );
      }
      next.set(bank, offset);
      return next;
    }
    if (id === SATELLITE_BLOCK_ID) {
      if (offset + SATELLITE_BANK_BYTES > ADDITIONAL_SETTINGS_BYTES) {
        throw new OpenGd77SatelliteBankFitError(
          'Existing satellite block does not fit the bank size.',
        );
      }
      next.set(bank, offset);
      return next;
    }
    if (payloadSize > ADDITIONAL_SETTINGS_BYTES) break;
    offset += 8 + payloadSize;
  }

  throw new OpenGd77SatelliteBankFitError(
    'Additional-settings region is full; cannot insert a satellite bank.',
  );
}
