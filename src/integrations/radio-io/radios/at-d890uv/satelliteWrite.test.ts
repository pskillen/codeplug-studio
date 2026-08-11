import { describe, expect, it } from 'vitest';
import {
  AtD890ScriptedPipe,
  collectAtD890WriteDataAddresses,
  writePayloadAt,
} from './__fixtures__/scriptedPipe.ts';
import { AT_D890_SATELLITE } from './constants.ts';
import { encodeSatelliteRecord } from './satelliteCodec.ts';
import { uploadAtD890SatelliteRecords } from './satelliteWrite.ts';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';

const BASE = AT_D890_SATELLITE.BASE_ADDRESS;
const STRIDE = AT_D890_SATELLITE.RECORD_STRIDE;

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
    tleLine1: '1 25544U 98067A   24079.51782528  .00016717  00000-0  30721-3 0  9993',
    tleLine2: '2 25544  51.6416 335.6205 0006447  56.6529  36.3752 15.49560768 45087',
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
    label: 'FM',
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

/** Erase unit reads all `0xff` (freshly erased) unless overridden. */
function scriptAllFfReads(pipe: AtD890ScriptedPipe): void {
  pipe.readResponder = (_addr, len) => new Uint8Array(len).fill(0xff);
}

describe('uploadAtD890SatelliteRecords', () => {
  it('no-ops when there are no records', async () => {
    const pipe = new AtD890ScriptedPipe();
    await uploadAtD890SatelliteRecords(pipe, []);
    expect(pipe.writes).toHaveLength(0);
  });

  it('reads the touched erase unit before writing, and writes exact record bytes', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAllFfReads(pipe);
    pipe.autoAckWrites = true;

    const satellite = makeSatellite();
    const transmitter = makeTransmitter();
    const bytes = encodeSatelliteRecord(satellite, transmitter);
    const records = [{ satelliteId: satellite.id, transmitterId: transmitter.id, address: BASE, bytes }];

    await uploadAtD890SatelliteRecords(pipe, records);

    const firstWriteIndex = pipe.writes.findIndex((w) => w[0] === 0x57);
    expect(firstWriteIndex).toBeGreaterThan(0);
    const readsBeforeWrite = pipe.writes.slice(0, firstWriteIndex).some((w) => w[0] === 0x52);
    expect(readsBeforeWrite).toBe(true);

    // Every non-zero 16-byte chunk of the record should have been transmitted verbatim.
    for (let off = 0; off < bytes.length; off += 16) {
      const chunk = bytes.subarray(off, off + 16);
      if (chunk.every((b) => b === 0)) continue; // filtered as all-zero != all-0xff, still sent
      const payload = writePayloadAt(pipe, BASE + off);
      expect(payload).toEqual(chunk);
    }
  });

  it('writes two records at sequential addresses', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAllFfReads(pipe);
    pipe.autoAckWrites = true;

    const satellite = makeSatellite();
    const txA = makeTransmitter({ id: 'tx-a' });
    const txB = makeTransmitter({ id: 'tx-b', label: 'CW' });
    const records = [
      { satelliteId: satellite.id, transmitterId: txA.id, address: BASE, bytes: encodeSatelliteRecord(satellite, txA) },
      {
        satelliteId: satellite.id,
        transmitterId: txB.id,
        address: BASE + STRIDE,
        bytes: encodeSatelliteRecord(satellite, txB),
      },
    ];

    await uploadAtD890SatelliteRecords(pipe, records);

    const writtenAddrs = new Set(collectAtD890WriteDataAddresses(pipe));
    // Name field (first 16 bytes) differs between the two records, so both leading chunks
    // should be transmitted.
    expect(writtenAddrs.has(BASE)).toBe(true);
    expect(writtenAddrs.has(BASE + STRIDE)).toBe(true);
  });

  it('preserves pre-existing non-erased bytes elsewhere in the touched erase unit', async () => {
    const pipe = new AtD890ScriptedPipe();
    const preExisting = new Uint8Array(16).fill(0xab);
    const preExistingOffset = STRIDE * 20; // well past our single small record, same unit
    pipe.readResponder = (addr, len) => {
      const out = new Uint8Array(len).fill(0xff);
      const relOffset = addr - BASE;
      if (relOffset >= 0 && relOffset < AT_D890_SATELLITE.RECORD_STRIDE * 512) {
        // Only the pre-existing block is non-0xff; everything else in the unit is erased.
        for (let i = 0; i < len; i++) {
          const abs = relOffset + i;
          if (abs >= preExistingOffset && abs < preExistingOffset + preExisting.length) {
            out[i] = preExisting[abs - preExistingOffset]!;
          }
        }
      }
      return out;
    };
    pipe.autoAckWrites = true;

    const satellite = makeSatellite();
    const transmitter = makeTransmitter();
    const bytes = encodeSatelliteRecord(satellite, transmitter);
    const records = [{ satelliteId: satellite.id, transmitterId: transmitter.id, address: BASE, bytes }];

    await uploadAtD890SatelliteRecords(pipe, records);

    const preservedPayload = writePayloadAt(pipe, BASE + preExistingOffset);
    expect(preservedPayload).toEqual(preExisting);
  });
});
