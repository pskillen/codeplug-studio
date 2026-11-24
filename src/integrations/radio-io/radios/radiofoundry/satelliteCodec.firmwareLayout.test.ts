/**
 * Packed keps records vs RadioFoundry firmware layout.
 * Firmware: core/satellite/store.c validate_record (commit 454a5b76):
 *   uint32_t id = get32(p); uint8_t name_len = p[4];
 *   uint16_t expected = (uint16_t)(5u + name_len + 2u * SAT_TLE_LINE);
 *   if (id == 0u || id > 99999u || name_len == 0u || name_len > SAT_MAX_NAME || len != expected
 *       || !utf8_name(p + 5, name_len)) return false;
 *   line1[7] in U/C/S; every byte of both lines 0x20–0x7E. SAT_TLE_LINE = 69, SAT_MAX_NAME = 48.
 */

import { describe, expect, it } from 'vitest';
import validTle from '@core/domain/tle/__fixtures__/valid.tle?raw';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { MD9600_RADIOFOUNDRY_BOARD } from '@core/radios/tyt/md-9600-radiofoundry/limits.ts';
import { RADIOFOUNDRY_LIMITS } from '@core/radios/radiofoundry/limits.ts';
import { SAT_TLE_LINE_LENGTH, serialiseSatelliteRecords } from './satellite.ts';
import {
  countRadioFoundryWriteSatellites,
  packRadioFoundrySatellites,
  type RadioFoundryKepsOptions,
} from './satelliteCodec.ts';

const SAT_TLE_LINE = SAT_TLE_LINE_LENGTH;
const SAT_MAX_NAME = RADIOFOUNDRY_LIMITS.SATELLITE_NAME_MAX_BYTES;

function readU32Le(buf: Uint8Array, off: number): number {
  return (buf[off]! | (buf[off + 1]! << 8) | (buf[off + 2]! << 16) | (buf[off + 3]! << 24)) >>> 0;
}

function isPrintableLineByte(b: number): boolean {
  return b >= 0x20 && b <= 0x7e;
}

function walkFirmwareRecordStream(stream: Uint8Array): number[] {
  const nameLengths: number[] = [];
  let off = 0;
  let prevId = 0;
  while (off < stream.length) {
    const remaining = stream.length - off;
    expect(remaining).toBeGreaterThanOrEqual(5);
    const id = readU32Le(stream, off);
    const nameLen = stream[off + 4]!;
    expect(id).toBeGreaterThan(0);
    expect(id).toBeLessThanOrEqual(99_999);
    expect(nameLen).toBeGreaterThan(0);
    expect(nameLen).toBeLessThanOrEqual(SAT_MAX_NAME);
    const recordLen = 5 + nameLen + 2 * SAT_TLE_LINE;
    expect(remaining).toBeGreaterThanOrEqual(recordLen);
    nameLengths.push(nameLen);
    const line1Off = off + 5 + nameLen;
    const line2Off = line1Off + SAT_TLE_LINE;
    const classByte = stream[line1Off + 7]!;
    expect(['U', 'C', 'S'].includes(String.fromCharCode(classByte))).toBe(true);
    for (let i = 0; i < SAT_TLE_LINE; i += 1) {
      expect(isPrintableLineByte(stream[line1Off + i]!)).toBe(true);
      expect(isPrintableLineByte(stream[line2Off + i]!)).toBe(true);
    }
    expect(id).toBeGreaterThan(prevId);
    prevId = id;
    off += recordLen;
  }
  return nameLengths;
}

function issTleLines(): { line1: string; line2: string } {
  const blocks = validTle.trim().split(/\n\n+/);
  const iss = blocks[0]!.trim().split('\n');
  return { line1: iss[1]!, line2: iss[2]! };
}

function makeTransmitter(overrides: Partial<SatelliteTransmitter> = {}): SatelliteTransmitter {
  return {
    id: 'tx',
    label: 'FM Voice',
    mode: 'FM',
    uplinkHz: 145_850_000,
    downlinkHz: 436_795_000,
    uplinkToneHz: null,
    downlinkToneHz: null,
    source: 'manual',
    satnogsUuid: null,
    satnogsAlive: null,
    satnogsStatus: null,
    satnogsSyncedAt: null,
    dismissed: false,
    includeInWrite: true,
    ...overrides,
  };
}

function makeSatelliteFromTle(
  id: string,
  name: string,
  noradId: number,
  line1: string,
  line2: string,
  transmitters: SatelliteTransmitter[],
): Satellite {
  return {
    id,
    projectId: 'proj-1',
    revision: 1,
    updatedAt: '2024-01-01T00:00:00Z',
    name,
    noradId,
    enabled: true,
    source: 'celestrak',
    tleLine1: line1,
    tleLine2: line2,
    epoch: '2024-01-01T00:00:00Z',
    classification: 'U',
    inclinationDeg: 51.6416,
    raanDeg: 247.4627,
    eccentricity: 0.0006703,
    argPerigeeDeg: 130.536,
    meanAnomalyDeg: 325.0288,
    meanMotionRevPerDay: 15.49560319,
    bstar: 0.0001023,
    elementSetNumber: 999,
    revolutionNumber: 99999,
    transmitters,
  };
}

function tleLine1(catalog: number, epochField: string): string {
  const cat = String(catalog).padStart(5, '0');
  const line = `1 ${cat}U 98067A   ${epochField.padEnd(15).slice(0, 15)}  .00016717 00000-0  10230-3 0  9990`;
  if (line.length !== SAT_TLE_LINE) throw new Error(`line1 length ${line.length}`);
  return line;
}

function tleLine2(catalog: number): string {
  const cat = String(catalog).padStart(5, '0');
  const line = `2 ${cat}  51.6416 247.4627 0006703 130.5360 325.0288 15.49560319 99999`;
  if (line.length !== SAT_TLE_LINE) throw new Error(`line2 length ${line.length}`);
  return line;
}

function tleForNorad(noradId: number): { line1: string; line2: string } {
  const epoch = '24045.51782528';
  return { line1: tleLine1(noradId, epoch), line2: tleLine2(noradId) };
}

describe('RadioFoundry keps firmware record layout', () => {
  it('packed records match the firmware record layout', () => {
    const base = issTleLines();
    const longName = 'N'.repeat(48);
    const s1 = makeSatelliteFromTle('sat-a', longName, 25_544, base.line1, base.line2, [
      makeTransmitter({ id: 'tx-a' }),
    ]);
    const t2 = tleForNorad(27_607);
    const s2 = makeSatelliteFromTle('sat-b', 'X', 27_607, t2.line1, t2.line2, [
      makeTransmitter({ id: 'tx-b' }),
    ]);
    const t3 = tleForNorad(43_017);
    const s3 = makeSatelliteFromTle('sat-c', 'AO-91', 43_017, t3.line1, t3.line2, [
      makeTransmitter({ id: 'tx-c' }),
    ]);
    const packed = packRadioFoundrySatellites([s2, s3, s1], {
      bands: MD9600_RADIOFOUNDRY_BOARD.BANDS_HZ,
    });
    expect(packed.records).toHaveLength(3);
    const stream = serialiseSatelliteRecords(
      packed.records,
      RADIOFOUNDRY_LIMITS.SATELLITE_NAME_MAX_BYTES,
    );
    const nameLengths = walkFirmwareRecordStream(stream);
    expect(nameLengths).toContain(48);
    expect(nameLengths).toContain(1);
  });

  it('MD-9600 bands accept the five typical FM satellites', () => {
    const opts: RadioFoundryKepsOptions = { bands: MD9600_RADIOFOUNDRY_BOARD.BANDS_HZ };
    const issLines = issTleLines();
    const satellites: Satellite[] = [
      makeSatelliteFromTle('iss', 'ISS (ZARYA)', 25_544, issLines.line1, issLines.line2, [
        makeTransmitter({
          id: 'iss-tx',
          uplinkHz: 145_990_000,
          downlinkHz: 437_800_000,
        }),
      ]),
    ];
    for (const [id, name, norad] of [
      ['so50', 'SO-50', 27_607],
      ['ao91', 'AO-91', 43_017],
      ['ao27', 'AO-27', 22_825],
    ] as const) {
      const lines = tleForNorad(norad);
      satellites.push(
        makeSatelliteFromTle(id, name, norad, lines.line1, lines.line2, [
          makeTransmitter({ id: `${id}-tx` }),
        ]),
      );
    }
    const poLines = tleForNorad(43_678);
    satellites.push(
      makeSatelliteFromTle('po101', 'PO-101', 43_678, poLines.line1, poLines.line2, [
        makeTransmitter({
          id: 'po101-tx',
          uplinkHz: 145_900_000,
          downlinkHz: 435_200_000,
        }),
      ]),
    );
    const rsLines = tleForNorad(44_909);
    satellites.push(
      makeSatelliteFromTle('rs44', 'RS-44', 44_909, rsLines.line1, rsLines.line2, [
        makeTransmitter({
          id: 'rs44-tx',
          mode: 'USB',
          uplinkHz: 145_960_000,
          downlinkHz: 435_640_000,
        }),
      ]),
    );
    const ao73Lines = tleForNorad(39_444);
    satellites.push(
      makeSatelliteFromTle('ao73', 'AO-73', 39_444, ao73Lines.line1, ao73Lines.line2, [
        makeTransmitter({
          id: 'ao73-tx',
          mode: 'BPSK',
          uplinkHz: 145_935_000,
          downlinkHz: 435_150_000,
        }),
      ]),
    );
    expect(countRadioFoundryWriteSatellites(satellites, opts)).toBe(5);
  });
});
