import { describe, expect, it } from 'vitest';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import { OpenGd77Protocol } from '@integrations/radio-io/radios/opengd77/protocol.ts';
import { OpenGd77ScriptedPipe } from '@integrations/radio-io/radios/opengd77/__fixtures__/scriptedPipe.ts';
import type { RadioDescriptor, RadioSession } from '@integrations/radio-io/types.ts';
import { RadioWriteBlockedError } from './radioIoSession.ts';
import { writeOpenGd77SatellitesToRadio } from './radioIoOpenGd77SatelliteWrite.ts';

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
    tleLine1: '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993',
    tleLine2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001',
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

function fakeSession(pipe: OpenGd77ScriptedPipe, radio: OpenGd77Protocol): RadioSession {
  const descriptor: RadioDescriptor = {
    modelIds: ['DM-1701'],
    label: 'DM-1701',
    supportsBle: false,
    protocolFactory: () => radio,
    capabilities: {
      maxChannels: 1023,
      supportsZones: true,
      supportsScanLists: false,
      analogOnly: false,
    },
    attributionIds: [],
    compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-opengd77-1701' }],
    writeStrategy: 'full-image',
    baudRate: 115200,
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

describe('writeOpenGd77SatellitesToRadio', () => {
  it('writes eligible spacecraft and reports the count', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    const radio = new OpenGd77Protocol();
    await radio.connect(pipe);
    const result = await writeOpenGd77SatellitesToRadio(fakeSession(pipe, radio), [
      makeSatellite(),
    ]);
    expect(result.written).toBe(1);
    expect(result.skipped).toHaveLength(0);
  });

  it('throws RadioWriteBlockedError when over SATELLITE_MAX', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    const radio = new OpenGd77Protocol();
    await radio.connect(pipe);
    const sats = Array.from({ length: OPENGD77_FAMILY_LIMITS.SATELLITE_MAX + 1 }, (_, i) =>
      makeSatellite({ id: `sat-${i}`, noradId: 1000 + i, name: `S${i}` }),
    );
    await expect(
      writeOpenGd77SatellitesToRadio(fakeSession(pipe, radio), sats),
    ).rejects.toBeInstanceOf(RadioWriteBlockedError);
  });
});
