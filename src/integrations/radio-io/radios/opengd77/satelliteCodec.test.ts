import { describe, expect, it } from 'vitest';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import {
  ADDITIONAL_SETTINGS_BYTES,
  countWriteEligibleSatelliteRecords,
  listCapabilitySkippedTransmitters,
  OpenGd77AdditionalSettingsVersionError,
  overlaySatelliteBank,
  packSatelliteBank,
  previewSatelliteWriteRecords,
  SATELLITE_BANK_BYTES,
  SATELLITE_BLOCK_ID,
  SATELLITE_RECORD_BYTES,
} from './satelliteCodec.ts';

const ISS_TLE_1 = '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993';
const ISS_TLE_2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001';

function makeTransmitter(overrides: Partial<SatelliteTransmitter> = {}): SatelliteTransmitter {
  return {
    id: 'tx-1',
    label: 'FM Voice',
    mode: 'FM',
    uplinkHz: 145_850_000,
    downlinkHz: 436_795_000,
    uplinkToneHz: 67,
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

function makeSatellite(overrides: Partial<Satellite> = {}): Satellite {
  return {
    id: 'sat-1',
    projectId: 'proj-1',
    revision: 1,
    updatedAt: '2024-02-14T12:25:40Z',
    name: 'ISS',
    noradId: 25544,
    enabled: true,
    source: 'celestrak',
    tleLine1: ISS_TLE_1,
    tleLine2: ISS_TLE_2,
    epoch: '2024-02-14T12:25:40Z',
    classification: 'U',
    inclinationDeg: 51.6416,
    raanDeg: 247.4627,
    eccentricity: 0.0006703,
    argPerigeeDeg: 130.536,
    meanAnomalyDeg: 325.0288,
    meanMotionRevPerDay: 15.4956032,
    bstar: 0.00030589,
    elementSetNumber: 999,
    revolutionNumber: 43000,
    transmitters: [makeTransmitter()],
    ...overrides,
  };
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

function nibble(data: Uint8Array, byte: number, high: boolean): number {
  return high ? (data[byte]! >> 4) & 0xf : data[byte]! & 0xf;
}

describe('packSatelliteBank', () => {
  it('writes bank id 3, payload size, and 0x64 records', () => {
    const bank = packSatelliteBank([makeSatellite()]);
    expect(bank.length).toBe(SATELLITE_BANK_BYTES);
    expect(SATELLITE_RECORD_BYTES).toBe(0x64);
    expect(readU32Le(bank, 0)).toBe(SATELLITE_BLOCK_ID);
    expect(readU32Le(bank, 4)).toBe(SATELLITE_BANK_BYTES - 8);
  });

  it('encodes an 8-byte NUL-padded name and FM frequencies as Hz LE', () => {
    const bank = packSatelliteBank([makeSatellite()]);
    const rec = bank.subarray(0x08, 0x08 + SATELLITE_RECORD_BYTES);
    expect(String.fromCharCode(...rec.subarray(0, 3))).toBe('ISS');
    expect(rec[3]).toBe(0);
    expect(readU32Le(rec, 0x30)).toBe(436_795_000);
    expect(readU32Le(rec, 0x34)).toBe(145_850_000);
    expect(readU32Le(rec, 0x38)).toBe(670);
  });

  it('encodes epoch year 24 in BCD at {0x08,4}', () => {
    const rec = packSatelliteBank([makeSatellite()]).subarray(0x08, 0x08 + SATELLITE_RECORD_BYTES);
    expect(nibble(rec, 0x08, true)).toBe(2);
    expect(nibble(rec, 0x09, false)).toBe(4);
  });

  it('maps APRS and beacon transmitters into the fixed slots', () => {
    const sat = makeSatellite({
      transmitters: [
        makeTransmitter(),
        makeTransmitter({
          id: 'tx-aprs',
          label: 'APRS',
          mode: 'AFSK',
          uplinkHz: 145_825_000,
          downlinkHz: 145_825_000,
          uplinkToneHz: null,
        }),
        makeTransmitter({
          id: 'tx-bcn',
          label: 'Beacon',
          mode: 'CW',
          uplinkHz: null,
          downlinkHz: 145_800_000,
        }),
      ],
    });
    const rec = packSatelliteBank([sat]).subarray(0x08, 0x08 + SATELLITE_RECORD_BYTES);
    expect(readU32Le(rec, 0x3c)).toBe(145_825_000);
    expect(readU32Le(rec, 0x40)).toBe(145_825_000);
    expect(readU32Le(rec, 0x44)).toBe(145_800_000);
  });

  it('skips a second FM transmitter instead of a second record', () => {
    const sat = makeSatellite({
      transmitters: [
        makeTransmitter(),
        makeTransmitter({ id: 'tx-2', label: 'FM 2', mode: 'FM', uplinkHz: 145_900_000 }),
      ],
    });
    expect(countWriteEligibleSatelliteRecords([sat])).toBe(1);
    const skipped = listCapabilitySkippedTransmitters([sat]);
    expect(skipped).toEqual([
      {
        satelliteId: 'sat-1',
        transmitterId: 'tx-2',
        reason: 'Only one FM pair fits an OpenGD77 satellite record.',
      },
    ]);
  });

  it('counts spacecraft not transmitters for capacity', () => {
    const sats = Array.from({ length: 3 }, (_, i) =>
      makeSatellite({
        id: `sat-${i}`,
        noradId: 25544 + i,
        name: `SAT${i}`,
        transmitters: [makeTransmitter({ id: `tx-${i}` }), makeTransmitter({ id: `txb-${i}` })],
      }),
    );
    expect(countWriteEligibleSatelliteRecords(sats)).toBe(3);
  });

  it('does not pack a 26th spacecraft into the bank', () => {
    const sats = Array.from({ length: 26 }, (_, i) =>
      makeSatellite({ id: `sat-${i}`, noradId: 1000 + i, name: `S${i}` }),
    );
    expect(countWriteEligibleSatelliteRecords(sats)).toBe(26);
    const bank = packSatelliteBank(sats);
    const last = bank.subarray(
      0x08 + 24 * SATELLITE_RECORD_BYTES,
      0x08 + 25 * SATELLITE_RECORD_BYTES,
    );
    expect(String.fromCharCode(last[0]!)).toBe('S');
  });
});

describe('previewSatelliteWriteRecords', () => {
  it('emits a row per packed slot sharing the spacecraft name', () => {
    const sat = makeSatellite({
      transmitters: [
        makeTransmitter(),
        makeTransmitter({ id: 'tx-aprs', label: 'APRS', mode: 'APRS', uplinkHz: 145_825_000 }),
      ],
    });
    const preview = previewSatelliteWriteRecords([sat]);
    expect(preview.map((p) => p.slot)).toEqual(['fm', 'aprs']);
    expect(preview.every((p) => p.encodedName === 'ISS')).toBe(true);
  });
});

describe('overlaySatelliteBank', () => {
  it('initializes a virgin 0xff blob and inserts the bank at 0x0c', () => {
    const existing = new Uint8Array(ADDITIONAL_SETTINGS_BYTES).fill(0xff);
    const bank = packSatelliteBank([makeSatellite()]);
    const next = overlaySatelliteBank(existing, bank);
    expect(Array.from(next.subarray(0, 8))).toEqual([...new TextEncoder().encode('OpenGD77')]);
    expect(readU32Le(next, 0x08)).toBe(1);
    expect(readU32Le(next, 0x0c)).toBe(SATELLITE_BLOCK_ID);
    expect(next.subarray(0x0c, 0x0c + SATELLITE_BANK_BYTES)).toEqual(bank);
  });

  it('preserves a co-resident boot-melody TLV', () => {
    const existing = new Uint8Array(ADDITIONAL_SETTINGS_BYTES).fill(0xff);
    existing.set(new TextEncoder().encode('OpenGD77'), 0);
    writeU32(existing, 0x08, 1);
    writeU32(existing, 0x0c, 2);
    writeU32(existing, 0x10, 4);
    existing[0x14] = 0xaa;
    existing[0x15] = 0xbb;
    existing[0x16] = 0xcc;
    existing[0x17] = 0xdd;
    const bank = packSatelliteBank([makeSatellite()]);
    const next = overlaySatelliteBank(existing, bank);
    expect(readU32Le(next, 0x0c)).toBe(2);
    expect(next[0x14]).toBe(0xaa);
    expect(readU32Le(next, 0x18)).toBe(SATELLITE_BLOCK_ID);
  });

  it('refuses an unknown OpenGD77 additional-settings version', () => {
    const existing = new Uint8Array(ADDITIONAL_SETTINGS_BYTES).fill(0xff);
    existing.set(new TextEncoder().encode('OpenGD77'), 0);
    existing[0x08] = 99;
    expect(() => overlaySatelliteBank(existing, packSatelliteBank([makeSatellite()]))).toThrow(
      OpenGd77AdditionalSettingsVersionError,
    );
  });
});

function writeU32(data: Uint8Array, offset: number, value: number): void {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >>> 8) & 0xff;
  data[offset + 2] = (value >>> 16) & 0xff;
  data[offset + 3] = (value >>> 24) & 0xff;
}

describe('OPENGD77_FAMILY_LIMITS satellite caps', () => {
  it('matches the RE doc', () => {
    expect(OPENGD77_FAMILY_LIMITS.SATELLITE_MAX).toBe(25);
    expect(OPENGD77_FAMILY_LIMITS.SATELLITE_NAME_LENGTH).toBe(8);
  });
});
