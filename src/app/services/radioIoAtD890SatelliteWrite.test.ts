import { describe, expect, it, vi } from 'vitest';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { AT_D890_SATELLITE } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { AtD890ScriptedPipe } from '@integrations/radio-io/radios/at-d890uv/__fixtures__/scriptedPipe.ts';
import type { CloneImageRadio, RadioDescriptor, RadioSession } from '@integrations/radio-io/types.ts';
import { RadioWriteBlockedError } from './radioIoSession.ts';
import { writeSatellitesToRadio } from './radioIoAtD890SatelliteWrite.ts';

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

function fakeSession(pipe: AtD890ScriptedPipe): RadioSession {
  const radio: CloneImageRadio = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    download: vi.fn(),
    upload: vi.fn(),
    decodeChannels: () => [],
    encodeChannels: (img) => img,
    readFirmware: () => undefined,
  };
  const descriptor: RadioDescriptor = {
    modelIds: ['AT-D890UV'],
    label: 'D890',
    supportsBle: false,
    protocolFactory: () => radio,
    capabilities: {
      maxChannels: 4000,
      supportsZones: true,
      supportsScanLists: true,
      analogOnly: false,
    },
    attributionIds: [],
    compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-at-d890uv' }],
    writeStrategy: 'selective-ranges',
    hydrationRequiredForWrite: false,
    baudRate: 921600,
    hydration: {
      extractHydration: () => {
        throw new Error('unused');
      },
      mergeChannelsIntoHydration: (bag) => {
        throw new Error('unused');
        return bag as never;
      },
    },
  };
  return { descriptor, pipe, radio };
}

describe('writeSatellitesToRadio', () => {
  it('uploads eligible transmitters and reports the written count', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.readResponder = (_addr, len) => new Uint8Array(len).fill(0xff);
    pipe.autoAckWrites = true;

    const satellite = makeSatellite({ transmitters: [makeTransmitter()] });
    const result = await writeSatellitesToRadio(fakeSession(pipe), [satellite]);

    expect(result.written).toBe(1);
    expect(result.skipped).toHaveLength(0);
    expect(pipe.writes.some((w) => w[0] === 0x57)).toBe(true);
  });

  it('reports a satellite with zero eligible transmitters as skipped, not an error', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.readResponder = (_addr, len) => new Uint8Array(len).fill(0xff);
    pipe.autoAckWrites = true;

    const eligible = makeSatellite({ id: 'sat-eligible', transmitters: [makeTransmitter()] });
    const noneEligible = makeSatellite({
      id: 'sat-none',
      transmitters: [makeTransmitter({ includeInWrite: false })],
    });

    const result = await writeSatellitesToRadio(fakeSession(pipe), [eligible, noneEligible]);

    expect(result.written).toBe(1);
    expect(result.skipped).toEqual([
      { satelliteId: 'sat-none', reason: 'No write-eligible transmitters.' },
    ]);
  });

  it('refuses to write when eligible transmitters exceed capacity, before any frame is sent', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.readResponder = (_addr, len) => new Uint8Array(len).fill(0xff);
    pipe.autoAckWrites = true;

    const overCapacity = Array.from({ length: AT_D890UV_LIMITS.SATELLITE_MAX + 1 }, (_, i) =>
      makeSatellite({ id: `sat-${i}`, transmitters: [makeTransmitter({ id: `tx-${i}` })] }),
    );

    await expect(writeSatellitesToRadio(fakeSession(pipe), overCapacity)).rejects.toBeInstanceOf(
      RadioWriteBlockedError,
    );
    expect(pipe.writes).toHaveLength(0);
  });

  it('writes sequential records at AT_D890_SATELLITE.BASE_ADDRESS + i * RECORD_STRIDE', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.readResponder = (_addr, len) => new Uint8Array(len).fill(0xff);
    pipe.autoAckWrites = true;

    const satellite = makeSatellite({
      transmitters: [makeTransmitter({ id: 'tx-a' }), makeTransmitter({ id: 'tx-b', label: 'CW' })],
    });
    const result = await writeSatellitesToRadio(fakeSession(pipe), [satellite]);
    expect(result.written).toBe(2);

    const writeAddrs = new Set(
      pipe.writes
        .filter((w) => w[0] === 0x57)
        .map((w) => ((w[1]! << 24) | (w[2]! << 16) | (w[3]! << 8) | w[4]!) >>> 0),
    );
    expect(writeAddrs.has(AT_D890_SATELLITE.BASE_ADDRESS)).toBe(true);
    expect(writeAddrs.has(AT_D890_SATELLITE.BASE_ADDRESS + AT_D890_SATELLITE.RECORD_STRIDE)).toBe(
      true,
    );
  });
});
