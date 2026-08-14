import { describe, expect, it } from 'vitest';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import {
  getSatelliteKepsExclusions,
  getSatelliteKepsWriteAdapter,
  getSatelliteKepsWriteCapacity,
  getSatelliteKepsWritePreview,
  hasSatelliteKepsWriteAdapter,
  SATELLITE_KEPS_WRITE_ADAPTERS,
  SATELLITE_KEPS_WRITE_PREVIEW,
} from './satelliteKepsWriteAdapters.ts';

describe('satelliteKepsWriteAdapters', () => {
  it('has an adapter registered for the AT-D890UV profile', () => {
    expect(hasSatelliteKepsWriteAdapter('radio-io-at-d890uv')).toBe(true);
    expect(getSatelliteKepsWriteAdapter('radio-io-at-d890uv')).toBe(
      SATELLITE_KEPS_WRITE_ADAPTERS['radio-io-at-d890uv'],
    );
  });

  it('has adapters registered for OpenGD77 DM-1701 and MD-9600', () => {
    for (const profileId of ['radio-io-opengd77-1701', 'radio-io-opengd77-md9600'] as const) {
      expect(hasSatelliteKepsWriteAdapter(profileId)).toBe(true);
      expect(getSatelliteKepsWriteAdapter(profileId)).toBe(
        SATELLITE_KEPS_WRITE_ADAPTERS[profileId],
      );
    }
  });

  it('has no adapter for an unknown profile', () => {
    expect(hasSatelliteKepsWriteAdapter('radio-io-uv5r-mini')).toBe(false);
    expect(getSatelliteKepsWriteAdapter('radio-io-uv5r-mini')).toBeUndefined();
    expect(hasSatelliteKepsWriteAdapter('not-a-real-profile')).toBe(false);
  });
});

describe('getSatelliteKepsWriteCapacity (#1068)', () => {
  it('registers the D890 capacity ceiling from AT_D890UV_LIMITS.SATELLITE_MAX', () => {
    const capacity = getSatelliteKepsWriteCapacity('radio-io-at-d890uv');
    expect(capacity?.max).toBe(AT_D890UV_LIMITS.SATELLITE_MAX);
  });

  it('registers OpenGD77 capacity from OPENGD77_FAMILY_LIMITS.SATELLITE_MAX', () => {
    for (const profileId of ['radio-io-opengd77-1701', 'radio-io-opengd77-md9600'] as const) {
      const capacity = getSatelliteKepsWriteCapacity(profileId);
      expect(capacity?.max).toBe(OPENGD77_FAMILY_LIMITS.SATELLITE_MAX);
      expect(capacity?.nameLength).toBe(OPENGD77_FAMILY_LIMITS.SATELLITE_NAME_LENGTH);
      expect(capacity?.unitNoun).toBe('satellite');
      expect(capacity?.nameScope).toBe('spacecraft');
    }
  });

  it('is undefined for a profile with no registered capacity ceiling', () => {
    expect(getSatelliteKepsWriteCapacity('radio-io-uv5r-mini')).toBeUndefined();
  });
});

describe('getSatelliteKepsWritePreview (#1074)', () => {
  it('has a preview function registered for the AT-D890UV profile', () => {
    expect(getSatelliteKepsWritePreview('radio-io-at-d890uv')).toBe(
      SATELLITE_KEPS_WRITE_PREVIEW['radio-io-at-d890uv'],
    );
  });

  it('has preview functions registered for OpenGD77 profileIds', () => {
    for (const profileId of ['radio-io-opengd77-1701', 'radio-io-opengd77-md9600'] as const) {
      expect(getSatelliteKepsWritePreview(profileId)).toBe(SATELLITE_KEPS_WRITE_PREVIEW[profileId]);
    }
  });

  it('is undefined for a profile with no registered preview function', () => {
    expect(getSatelliteKepsWritePreview('radio-io-uv5r-mini')).toBeUndefined();
  });
});

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

function makeSatellite(overrides: Partial<Satellite> = {}): Satellite {
  return {
    id: 'sat-1',
    projectId: 'proj-1',
    revision: 1,
    updatedAt: '2024-01-01T00:00:00Z',
    name: 'ISS',
    noradId: 25544,
    enabled: true,
    source: 'celestrak',
    tleLine1: '1 25544U 98067A   24079.51782528  .00016717  00000-0  30721-3 0  9993',
    tleLine2: '2 25544  51.6416 335.6205 0006447  56.6529  36.3752 15.49560768 45087',
    epoch: '2024-01-01T00:00:00Z',
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

describe('getSatelliteKepsExclusions (#1085 follow-up)', () => {
  it('has an exclusions function registered for the AT-D890UV profile', () => {
    expect(getSatelliteKepsExclusions('radio-io-at-d890uv')).toBeTypeOf('function');
  });

  it('has exclusions functions registered for OpenGD77 profileIds', () => {
    for (const profileId of ['radio-io-opengd77-1701', 'radio-io-opengd77-md9600'] as const) {
      expect(getSatelliteKepsExclusions(profileId)).toBeTypeOf('function');
    }
  });

  it('is undefined for a profile with no registered exclusions function', () => {
    expect(getSatelliteKepsExclusions('radio-io-uv5r-mini')).toBeUndefined();
  });

  it('reports a satellite-level exclusion with transmitterId null when nothing is write-eligible', () => {
    const satellites = [
      makeSatellite({
        id: 'sat-a',
        transmitters: [makeTransmitter({ id: 'tx-a', includeInWrite: false })],
      }),
    ];
    const exclusions = getSatelliteKepsExclusions('radio-io-at-d890uv')!(satellites);
    expect(exclusions).toEqual([
      { satelliteId: 'sat-a', transmitterId: null, reason: expect.any(String) },
    ]);
  });

  it('reports a transmitter-level exclusion with its transmitterId for an unsupported mode', () => {
    const satellites = [
      makeSatellite({
        id: 'sat-a',
        transmitters: [makeTransmitter({ id: 'tx-a', mode: 'SSTV' })],
      }),
    ];
    const exclusions = getSatelliteKepsExclusions('radio-io-at-d890uv')!(satellites);
    expect(exclusions).toEqual([
      { satelliteId: 'sat-a', transmitterId: 'tx-a', reason: expect.stringContaining('SSTV') },
    ]);
  });

  it('is empty when every enabled satellite/transmitter is fully write-eligible', () => {
    const satellites = [makeSatellite({ transmitters: [makeTransmitter()] })];
    expect(getSatelliteKepsExclusions('radio-io-at-d890uv')!(satellites)).toEqual([]);
  });

  it('reports an extra OpenGD77 transmitter that does not fit the in-record FM slot', () => {
    const satellites = [
      makeSatellite({
        id: 'sat-a',
        transmitters: [
          makeTransmitter({ id: 'tx-fm', mode: 'FM', label: 'Voice' }),
          makeTransmitter({ id: 'tx-fm-2', mode: 'FM', label: 'Voice 2' }),
        ],
      }),
    ];
    const exclusions = getSatelliteKepsExclusions('radio-io-opengd77-1701')!(satellites);
    expect(exclusions.some((e) => e.transmitterId === 'tx-fm-2' && e.reason.length > 0)).toBe(true);
  });
});
