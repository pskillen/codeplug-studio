import { describe, expect, it } from 'vitest';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { resolveSatelliteTransmitterWriteNames } from './resolveSatelliteTransmitterWriteNames.ts';

const N = 8;

function tx(id: string, label: string): SatelliteTransmitter {
  return {
    id,
    label,
    mode: 'FM',
    uplinkHz: 145_800_000,
    downlinkHz: 436_000_000,
    uplinkToneHz: null,
    downlinkToneHz: null,
    source: 'manual',
    satnogsUuid: null,
    satnogsAlive: null,
    satnogsStatus: null,
    satnogsSyncedAt: null,
    dismissed: false,
    includeInWrite: true,
  };
}

function sat(
  id: string,
  name: string,
  noradId: number,
  transmitters: SatelliteTransmitter[],
): Satellite {
  return {
    id,
    projectId: 'p1',
    revision: 1,
    updatedAt: '2024-01-01T00:00:00Z',
    name,
    noradId,
    enabled: true,
    source: 'celestrak',
    tleLine1: '1',
    tleLine2: '2',
    epoch: '2024-01-01T00:00:00Z',
    classification: 'U',
    inclinationDeg: 0,
    raanDeg: 0,
    eccentricity: 0,
    argPerigeeDeg: 0,
    meanAnomalyDeg: 0,
    meanMotionRevPerDay: 15,
    bstar: 0,
    elementSetNumber: 1,
    revolutionNumber: 1,
    transmitters,
  };
}

describe('resolveSatelliteTransmitterWriteNames', () => {
  it('resolves per-transmitter encoded names from familiar shorts', () => {
    const satellite = sat('s1', 'ISS (ZARYA)', 25544, [tx('t1', 'FM')]);
    const result = resolveSatelliteTransmitterWriteNames(
      [{ satellite, transmitter: satellite.transmitters[0]! }],
      [],
      { maxLength: N },
    );
    expect(result.get('t1')).toMatchObject({
      encodedName: 'ISS FM',
      fromOverride: false,
      suggestedFamiliarShort: 'ISS',
      suggestedOscarEncoded: null,
    });
  });

  it('exposes OSCAR suggestion when parenthetical is Tier A', () => {
    const satellite = sat('s1', 'FOX-1A (AO-85)', 1, [tx('t1', 'FM')]);
    const result = resolveSatelliteTransmitterWriteNames(
      [{ satellite, transmitter: satellite.transmitters[0]! }],
      [],
      { maxLength: N },
    );
    expect(result.get('t1')!.suggestedOscarShort).toBe('AO-85');
    expect(result.get('t1')!.suggestedOscarEncoded).toBe('AO-85 FM');
  });

  it('uses transmitter-keyed override as full encoded field', () => {
    const satellite = sat('s1', 'ISS (ZARYA)', 25544, [tx('t1', 'FM'), tx('t2', 'Voice')]);
    const result = resolveSatelliteTransmitterWriteNames(
      [
        { satellite, transmitter: satellite.transmitters[0]! },
        { satellite, transmitter: satellite.transmitters[1]! },
      ],
      [{ libraryEntityId: 't1', wireName: 'CUSTOM' }],
      { maxLength: N },
    );
    expect(result.get('t1')!.encodedName).toBe('CUSTOM');
    expect(result.get('t1')!.fromOverride).toBe(true);
    expect(result.get('t2')!.fromOverride).toBe(false);
  });

  it('allows duplicate encoded names when both are overrides', () => {
    const satellite = sat('s1', 'ISS (ZARYA)', 25544, [tx('t1', 'FM'), tx('t2', 'Voice')]);
    const result = resolveSatelliteTransmitterWriteNames(
      [
        { satellite, transmitter: satellite.transmitters[0]! },
        { satellite, transmitter: satellite.transmitters[1]! },
      ],
      [
        { libraryEntityId: 't1', wireName: 'SAME' },
        { libraryEntityId: 't2', wireName: 'SAME' },
      ],
      { maxLength: N },
    );
    expect(result.get('t1')!.encodedName).toBe('SAME');
    expect(result.get('t2')!.encodedName).toBe('SAME');
  });
});
