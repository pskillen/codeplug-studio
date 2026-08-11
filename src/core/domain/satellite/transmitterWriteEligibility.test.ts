import { describe, expect, it } from 'vitest';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { isTransmitterWriteEligible } from './transmitterWriteEligibility.ts';

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

describe('isTransmitterWriteEligible', () => {
  it('is true when satellite is enabled, transmitter opted in, and not dismissed', () => {
    expect(isTransmitterWriteEligible(makeSatellite(), makeTransmitter())).toBe(true);
  });

  it('is false when the satellite is disabled', () => {
    expect(isTransmitterWriteEligible(makeSatellite({ enabled: false }), makeTransmitter())).toBe(
      false,
    );
  });

  it('is false when the transmitter has opted out of write', () => {
    expect(
      isTransmitterWriteEligible(makeSatellite(), makeTransmitter({ includeInWrite: false })),
    ).toBe(false);
  });

  it('is false when the transmitter is dismissed, even if includeInWrite is true', () => {
    expect(isTransmitterWriteEligible(makeSatellite(), makeTransmitter({ dismissed: true }))).toBe(
      false,
    );
  });
});
