import { describe, expect, it } from 'vitest';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitterInfo } from '@core/models/satelliteEnrichment.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { mergeSatnogsTransmittersIntoSatellite } from './mergeSatnogsTransmitters.ts';

function satellite(transmitters: SatelliteTransmitter[] = []): Satellite {
  return {
    id: 'sat-1',
    projectId: 'proj-1',
    revision: 1,
    name: 'Test Sat',
    noradId: 12345,
    enabled: true,
    source: 'celestrak',
    tleLine1: '1 12345U 98067A   24001.00000000  .00000000  00000-0  00000-0 0  9999',
    tleLine2: '2 12345  51.6400   0.0000 0000000   0.0000   0.0000 15.50000000000001',
    epoch: '2024-01-01T00:00:00.000Z',
    classification: 'U',
    inclinationDeg: 51.64,
    raanDeg: 0,
    eccentricity: 0,
    argPerigeeDeg: 0,
    meanAnomalyDeg: 0,
    meanMotionRevPerDay: 15.5,
    bstar: 0,
    elementSetNumber: 999,
    revolutionNumber: 0,
    transmitters,
  } as Satellite;
}

function transmitterInfo(
  overrides: Partial<SatelliteTransmitterInfo> = {},
): SatelliteTransmitterInfo {
  return {
    uuid: 'uuid-1',
    description: 'FM voice repeater',
    mode: 'FM',
    downlinkHz: 145800000,
    uplinkHz: 145200000,
    alive: true,
    status: 'active',
    ...overrides,
  };
}

function satnogsRow(overrides: Partial<SatelliteTransmitter> = {}): SatelliteTransmitter {
  return {
    id: 'row-1',
    label: 'FM voice repeater',
    mode: 'FM',
    uplinkHz: 145200000,
    downlinkHz: 145800000,
    uplinkToneHz: null,
    downlinkToneHz: null,
    source: 'satnogs',
    satnogsUuid: 'uuid-1',
    satnogsAlive: true,
    satnogsStatus: 'active',
    satnogsSyncedAt: '2024-01-01T00:00:00.000Z',
    dismissed: false,
    ...overrides,
  };
}

describe('mergeSatnogsTransmittersIntoSatellite', () => {
  it('appends both transmitters on first sync', () => {
    const result = mergeSatnogsTransmittersIntoSatellite(
      satellite([]),
      [transmitterInfo({ uuid: 'uuid-1' }), transmitterInfo({ uuid: 'uuid-2' })],
      '2024-06-01T00:00:00.000Z',
    );

    expect(result.added).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(0);
    expect(result.satellite.transmitters).toHaveLength(2);
    expect(result.satellite.transmitters.map((t) => t.satnogsUuid)).toEqual(['uuid-1', 'uuid-2']);
  });

  it('reports unchanged and leaves satnogsSyncedAt untouched on a no-op re-sync', () => {
    const existing = satnogsRow({ satnogsSyncedAt: '2024-01-01T00:00:00.000Z' });
    const result = mergeSatnogsTransmittersIntoSatellite(
      satellite([existing]),
      [transmitterInfo({ uuid: 'uuid-1' })],
      '2024-06-01T00:00:00.000Z',
    );

    expect(result.added).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(1);
    expect(result.satellite.transmitters[0].satnogsSyncedAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('updates changed fields and bumps satnogsSyncedAt only on the changed row', () => {
    const changedRow = satnogsRow({
      id: 'row-1',
      satnogsUuid: 'uuid-1',
      downlinkHz: 145800000,
      satnogsSyncedAt: '2024-01-01T00:00:00.000Z',
    });
    const untouchedRow = satnogsRow({
      id: 'row-2',
      satnogsUuid: 'uuid-2',
      satnogsSyncedAt: '2024-01-01T00:00:00.000Z',
    });

    const result = mergeSatnogsTransmittersIntoSatellite(
      satellite([changedRow, untouchedRow]),
      [
        transmitterInfo({ uuid: 'uuid-1', downlinkHz: 145850000 }),
        transmitterInfo({ uuid: 'uuid-2' }),
      ],
      '2024-06-01T00:00:00.000Z',
    );

    expect(result.updated).toBe(1);
    expect(result.unchanged).toBe(1);
    const merged1 = result.satellite.transmitters.find((t) => t.satnogsUuid === 'uuid-1');
    const merged2 = result.satellite.transmitters.find((t) => t.satnogsUuid === 'uuid-2');
    expect(merged1?.downlinkHz).toBe(145850000);
    expect(merged1?.satnogsSyncedAt).toBe('2024-06-01T00:00:00.000Z');
    expect(merged2?.satnogsSyncedAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('adds a new transmitter alongside an already-synced one', () => {
    const existing = satnogsRow({ satnogsUuid: 'uuid-1' });
    const result = mergeSatnogsTransmittersIntoSatellite(
      satellite([existing]),
      [
        transmitterInfo({ uuid: 'uuid-1' }),
        transmitterInfo({ uuid: 'uuid-2', description: 'CW beacon' }),
      ],
      '2024-06-01T00:00:00.000Z',
    );

    expect(result.added).toBe(1);
    expect(result.unchanged).toBe(1);
    expect(result.satellite.transmitters).toHaveLength(2);
    expect(result.satellite.transmitters.some((t) => t.satnogsUuid === 'uuid-2')).toBe(true);
  });

  it('never touches manual rows', () => {
    const manualRow = satnogsRow({
      id: 'manual-1',
      source: 'manual',
      satnogsUuid: null,
      satnogsAlive: null,
      satnogsStatus: null,
      satnogsSyncedAt: null,
      label: 'Manual entry',
    });
    const satnogsExisting = satnogsRow({ satnogsUuid: 'uuid-1' });

    const result = mergeSatnogsTransmittersIntoSatellite(
      satellite([manualRow, satnogsExisting]),
      [transmitterInfo({ uuid: 'uuid-1', downlinkHz: 145900000 })],
      '2024-06-01T00:00:00.000Z',
    );

    const stillManual = result.satellite.transmitters.find((t) => t.id === 'manual-1');
    expect(stillManual).toEqual(manualRow);
  });

  it('does not overwrite an existing label when upstream description changes', () => {
    const existing = satnogsRow({ label: 'My custom label', satnogsUuid: 'uuid-1' });
    const result = mergeSatnogsTransmittersIntoSatellite(
      satellite([existing]),
      [transmitterInfo({ uuid: 'uuid-1', description: 'Renamed upstream description' })],
      '2024-06-01T00:00:00.000Z',
    );

    expect(result.satellite.transmitters[0].label).toBe('My custom label');
  });

  it('seeds label from description only when creating a new row', () => {
    const result = mergeSatnogsTransmittersIntoSatellite(
      satellite([]),
      [transmitterInfo({ uuid: 'uuid-1', description: 'Brand new transmitter' })],
      '2024-06-01T00:00:00.000Z',
    );

    expect(result.satellite.transmitters[0].label).toBe('Brand new transmitter');
  });

  it('keeps a dismissed row dismissed while still refreshing its data', () => {
    const dismissedRow = satnogsRow({
      dismissed: true,
      satnogsUuid: 'uuid-1',
      downlinkHz: 145800000,
    });
    const result = mergeSatnogsTransmittersIntoSatellite(
      satellite([dismissedRow]),
      [transmitterInfo({ uuid: 'uuid-1', downlinkHz: 145900000 })],
      '2024-06-01T00:00:00.000Z',
    );

    expect(result.satellite.transmitters[0].dismissed).toBe(true);
    expect(result.satellite.transmitters[0].downlinkHz).toBe(145900000);
  });

  it('keeps stale SatNOGS rows not present in the fetch (no pruning)', () => {
    const staleRow = satnogsRow({ id: 'stale-1', satnogsUuid: 'uuid-stale' });
    const result = mergeSatnogsTransmittersIntoSatellite(
      satellite([staleRow]),
      [transmitterInfo({ uuid: 'uuid-1' })],
      '2024-06-01T00:00:00.000Z',
    );

    expect(result.satellite.transmitters.some((t) => t.id === 'stale-1')).toBe(true);
    expect(result.satellite.transmitters).toHaveLength(2);
  });
});
