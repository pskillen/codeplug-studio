import { describe, expect, it } from 'vitest';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import {
  encodeSatelliteRecord,
  listCapabilitySkippedTransmitters,
  packSatelliteWriteRecords,
  previewSatelliteWriteRecords,
  SATELLITE_RECORD_BYTES,
} from './satelliteCodec.ts';

const ISS_TLE_1 = '1 25544U 98067A   24079.51782528  .00016717  00000-0  30721-3 0  9993';
const ISS_TLE_2 = '2 25544  51.6416 335.6205 0006447  56.6529  36.3752 15.49560768 45087';

function makeSatellite(overrides: Partial<Satellite> = {}): Satellite {
  return {
    id: 'sat-1',
    projectId: 'proj-1',
    revision: 1,
    updatedAt: '2024-03-19T12:25:40Z',
    name: 'ISS',
    noradId: 25544,
    enabled: true,
    source: 'celestrak',
    tleLine1: ISS_TLE_1,
    tleLine2: ISS_TLE_2,
    epoch: '2024-03-19T12:25:40Z',
    classification: 'U',
    inclinationDeg: 51.6416,
    raanDeg: 335.6205,
    eccentricity: 0.0006447,
    argPerigeeDeg: 56.6529,
    meanAnomalyDeg: 36.3752,
    meanMotionRevPerDay: 15.4956,
    bstar: 0.00030721,
    elementSetNumber: 999,
    revolutionNumber: 4508,
    transmitters: [],
    ...overrides,
  } as Satellite;
}

function makeTransmitter(overrides: Partial<SatelliteTransmitter> = {}): SatelliteTransmitter {
  return {
    id: 'tx-1',
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

function readU32Le(data: Uint8Array, offset: number): number {
  return (
    (data[offset]! |
      (data[offset + 1]! << 8) |
      (data[offset + 2]! << 16) |
      (data[offset + 3]! << 24)) >>>
    0
  );
}

describe('encodeSatelliteRecord', () => {
  it('produces a 0x200-byte record', () => {
    const record = encodeSatelliteRecord(makeSatellite(), makeTransmitter());
    expect(record.length).toBe(SATELLITE_RECORD_BYTES);
    expect(SATELLITE_RECORD_BYTES).toBe(0x200);
  });

  it('encodes exact TLE substrings at the documented offsets', () => {
    const record = encodeSatelliteRecord(makeSatellite(), makeTransmitter());
    const ascii = (offset: number, length: number) =>
      new TextDecoder().decode(record.subarray(offset, offset + length));

    expect(ascii(0x08, 14)).toBe('24079.51782528');
    expect(ascii(0x16, 11)).toBe('  .00016717');
    expect(ascii(0x21, 8)).toBe(' 51.6416');
    expect(ascii(0x29, 9)).toBe(' 335.6205');
    expect(ascii(0x32, 8)).toBe(' 0006447');
    expect(ascii(0x3a, 9)).toBe('  56.6529');
    expect(ascii(0x43, 9)).toBe('  36.3752');
    expect(ascii(0x4c, 12)).toBe(' 15.49560768');
    expect(ascii(0x58, 5)).toBe(' 4508');
  });

  it('encodes the combined name field, truncated and space-padded to 8 bytes', () => {
    const short = encodeSatelliteRecord(
      makeSatellite({ name: 'AO' }),
      makeTransmitter({ label: '27' }),
    );
    expect(new TextDecoder().decode(short.subarray(0x00, 0x08))).toBe('AO 27   ');

    const long = encodeSatelliteRecord(
      makeSatellite({ name: 'International Space Station' }),
      makeTransmitter({ label: 'FM Voice Repeater' }),
    );
    // Truncated to exactly 8 ASCII chars, no padding needed since it's already full.
    expect(long.subarray(0x00, 0x08).length).toBe(8);
    expect(new TextDecoder().decode(long.subarray(0x00, 0x08))).toBe('Internat');
  });

  it('encodes RX=downlink / TX=uplink frequency as deci-Hz, little-endian u32', () => {
    // AO-27 cross-check from satellite-keps.md: downlink 436.795 MHz -> 43679500 deci-Hz,
    // uplink 145.850 MHz -> 14585000 deci-Hz.
    const record = encodeSatelliteRecord(
      makeSatellite({ name: 'AO-27' }),
      makeTransmitter({ downlinkHz: 436_795_000, uplinkHz: 145_850_000 }),
    );
    expect(readU32Le(record, 0x60)).toBe(43_679_500);
    expect(readU32Le(record, 0x64)).toBe(14_585_000);
  });

  it('writes zero frequency bytes when a transmitter has no known frequency', () => {
    const record = encodeSatelliteRecord(
      makeSatellite(),
      makeTransmitter({ downlinkHz: null, uplinkHz: null }),
    );
    expect(readU32Le(record, 0x60)).toBe(0);
    expect(readU32Le(record, 0x64)).toBe(0);
  });

  it('encodes uplink tone as CTCSS "encode" and downlink tone as CTCSS "decode"', () => {
    const record = encodeSatelliteRecord(
      makeSatellite(),
      makeTransmitter({ uplinkToneHz: 100.0, downlinkToneHz: 67.0 }),
    );
    expect(record[0x68]).toBe(1); // encode (uplink) type = CTCSS
    expect(record[0x69]).toBe(1); // decode (downlink) type = CTCSS
    expect(record[0x6a]).toBe(13); // index of 100.0 Hz in AT_D890_CTCSS_TONE_HZ
    expect(record[0x6b]).toBe(1); // index of 67.0 Hz
  });

  it('leaves tone type/index/DCS bytes zero when no tone is set', () => {
    const record = encodeSatelliteRecord(makeSatellite(), makeTransmitter());
    expect(record[0x68]).toBe(0);
    expect(record[0x69]).toBe(0);
    expect(record[0x6a]).toBe(0);
    expect(record[0x6b]).toBe(0);
    expect(record[0x6c]).toBe(0);
    expect(record[0x6d]).toBe(0);
    expect(record[0x6e]).toBe(0);
    expect(record[0x6f]).toBe(0);
  });

  it('leaves 0x70-0x1ff zero-filled', () => {
    const record = encodeSatelliteRecord(makeSatellite(), makeTransmitter());
    for (let i = 0x70; i < SATELLITE_RECORD_BYTES; i++) {
      expect(record[i]).toBe(0);
    }
  });
});

describe('packSatelliteWriteRecords', () => {
  const BASE = 0x4a8_0000;
  const STRIDE = 0x200;

  it('excludes a transmitter when satellite.enabled is false', () => {
    const satellites = [makeSatellite({ enabled: false, transmitters: [makeTransmitter()] })];
    expect(packSatelliteWriteRecords(satellites, BASE, STRIDE)).toHaveLength(0);
  });

  it('excludes a transmitter when includeInWrite is false', () => {
    const satellites = [
      makeSatellite({ transmitters: [makeTransmitter({ includeInWrite: false })] }),
    ];
    expect(packSatelliteWriteRecords(satellites, BASE, STRIDE)).toHaveLength(0);
  });

  it('excludes a transmitter when dismissed is true', () => {
    const satellites = [makeSatellite({ transmitters: [makeTransmitter({ dismissed: true })] })];
    expect(packSatelliteWriteRecords(satellites, BASE, STRIDE)).toHaveLength(0);
  });

  it('assigns sequential addresses to multiple eligible transmitters on one satellite', () => {
    const satellites = [
      makeSatellite({
        transmitters: [
          makeTransmitter({ id: 'tx-a', label: 'FM' }),
          makeTransmitter({ id: 'tx-b', label: 'CW' }),
        ],
      }),
    ];
    const records = packSatelliteWriteRecords(satellites, BASE, STRIDE);
    expect(records).toHaveLength(2);
    expect(records[0]!.address).toBe(BASE);
    expect(records[1]!.address).toBe(BASE + STRIDE);
    expect(records[0]!.transmitterId).toBe('tx-a');
    expect(records[1]!.transmitterId).toBe('tx-b');
  });

  it('skips ineligible transmitters without leaving address gaps', () => {
    const satellites = [
      makeSatellite({
        id: 'sat-a',
        transmitters: [makeTransmitter({ id: 'tx-a', includeInWrite: false })],
      }),
      makeSatellite({
        id: 'sat-b',
        transmitters: [makeTransmitter({ id: 'tx-b' })],
      }),
    ];
    const records = packSatelliteWriteRecords(satellites, BASE, STRIDE);
    expect(records).toHaveLength(1);
    expect(records[0]!.address).toBe(BASE);
    expect(records[0]!.satelliteId).toBe('sat-b');
  });

  it('excludes a transmitter whose mode is on the D890 denylist (#1068)', () => {
    const satellites = [makeSatellite({ transmitters: [makeTransmitter({ mode: 'SSTV' })] })];
    expect(packSatelliteWriteRecords(satellites, BASE, STRIDE)).toHaveLength(0);
  });

  it('still writes an includeInWrite:false transmitter for the generic reason, not capability', () => {
    // An opted-out transmitter is skipped whether or not its mode would also be unsupported —
    // confirms the generic and capability checks are independent, not conflated.
    const satellites = [
      makeSatellite({
        id: 'sat-a',
        transmitters: [makeTransmitter({ id: 'tx-a', includeInWrite: false, mode: 'FM' })],
      }),
    ];
    expect(packSatelliteWriteRecords(satellites, BASE, STRIDE)).toHaveLength(0);
    expect(listCapabilitySkippedTransmitters(satellites)).toHaveLength(0);
  });
});

describe('previewSatelliteWriteRecords', () => {
  it('returns one entry per write-eligible transmitter, with the encoded name matching the packed record', () => {
    const satellites = [
      makeSatellite({
        id: 'sat-a',
        name: 'International Space Station',
        transmitters: [
          makeTransmitter({ id: 'tx-a', label: 'FM Voice Repeater' }),
          makeTransmitter({ id: 'tx-b', label: 'CW', includeInWrite: false }),
        ],
      }),
    ];

    const preview = previewSatelliteWriteRecords(satellites);
    expect(preview).toHaveLength(1);

    const [entry] = preview;
    expect(entry).toEqual({
      satelliteId: 'sat-a',
      satelliteName: 'International Space Station',
      transmitterId: 'tx-a',
      transmitterLabel: 'FM Voice Repeater',
      mode: 'FM',
      encodedName: 'Internat',
      uplinkHz: 145_850_000,
      downlinkHz: 436_795_000,
    });

    const [record] = packSatelliteWriteRecords(satellites, 0, SATELLITE_RECORD_BYTES);
    const packedName = new TextDecoder().decode(record!.bytes.subarray(0x00, 0x08)).trimEnd();
    expect(entry!.encodedName).toBe(packedName);
  });
});

describe('listCapabilitySkippedTransmitters', () => {
  it('reports a generically-eligible SSTV transmitter with a specific reason', () => {
    const satellites = [
      makeSatellite({ id: 'sat-a', transmitters: [makeTransmitter({ id: 'tx-a', mode: 'SSTV' })] }),
    ];
    const skipped = listCapabilitySkippedTransmitters(satellites);
    expect(skipped).toEqual([
      {
        satelliteId: 'sat-a',
        transmitterId: 'tx-a',
        reason: expect.stringContaining('SSTV'),
      },
    ]);
  });

  it('does not report a transmitter that is generically ineligible for an unrelated reason', () => {
    const satellites = [
      makeSatellite({
        transmitters: [makeTransmitter({ mode: 'SSTV', includeInWrite: false })],
      }),
    ];
    expect(listCapabilitySkippedTransmitters(satellites)).toHaveLength(0);
  });

  it('does not report a supported-mode transmitter', () => {
    const satellites = [makeSatellite({ transmitters: [makeTransmitter({ mode: 'FM' })] })];
    expect(listCapabilitySkippedTransmitters(satellites)).toHaveLength(0);
  });
});
