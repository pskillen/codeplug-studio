import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { emptyLibrary, newChannel, newZone } from '@core/domain/factories.ts';
import { buildAirbandImportPlan, channelIdsForZoneMembership } from './airbandImport.ts';

function airbandChannel(id: string, name = 'GLA Tower'): Channel {
  return {
    ...newChannel('p1', name),
    id,
    rxFrequency: 118_805_000,
    txFrequency: null,
    forbidTransmit: 'forbid',
    modeProfiles: [
      { mode: 'am', squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
    ],
  };
}

describe('channelIdsForZoneMembership', () => {
  it('includes existing library id for skipped duplicate by rx hz', () => {
    const library = emptyLibrary();
    library.channels.push(airbandChannel('existing'));

    const ids = channelIdsForZoneMembership(
      library,
      [],
      [
        {
          channel: airbandChannel('throwaway'),
          reason: 'rx_hz',
        },
      ],
    );

    expect(ids).toEqual(['existing']);
  });
});

describe('buildAirbandImportPlan', () => {
  it('dedupes and creates optional batch zone with default name', () => {
    const library = emptyLibrary();
    library.channels.push(airbandChannel('existing'));

    const plan = buildAirbandImportPlan(
      library,
      'p1',
      [
        {
          airport: {
            name: 'Glasgow',
            icao: 'EGPF',
            iata: 'GLA',
            location: null,
            frequencies: [
              { service: 'Tower', rxFrequencyHz: 118_805_000 },
              { service: 'ATIS', rxFrequencyHz: 129_575_000 },
            ],
          },
        },
      ],
      { alsoCreateZone: true },
    );

    expect(plan.totalChannelsToAdd).toHaveLength(1);
    expect(plan.totalSkipped).toHaveLength(1);
    expect(plan.zones).toHaveLength(1);
    expect(plan.zoneUpdates).toHaveLength(0);
    expect(plan.zones[0]?.name).toBe('Airband');
    expect(plan.zones[0]?.members).toHaveLength(1);
  });

  it('imports only selected frequency indices', () => {
    const library = emptyLibrary();
    const plan = buildAirbandImportPlan(
      library,
      'p1',
      [
        {
          airport: {
            name: 'Glasgow',
            icao: 'EGPF',
            iata: 'GLA',
            location: null,
            frequencies: [
              { service: 'Tower', rxFrequencyHz: 118_805_000 },
              { service: 'ATIS', rxFrequencyHz: 129_575_000 },
            ],
          },
          frequencyIndices: [1],
        },
      ],
      {},
    );

    expect(plan.totalChannelsToAdd).toHaveLength(1);
    expect(plan.totalChannelsToAdd[0]?.name).toContain('Atis');
    expect(plan.zoneUpdates).toHaveLength(0);
  });

  it('creates one batch zone across multiple airports', () => {
    const library = emptyLibrary();
    const plan = buildAirbandImportPlan(
      library,
      'p1',
      [
        {
          airport: {
            name: 'Glasgow',
            icao: 'EGPF',
            iata: 'GLA',
            location: null,
            frequencies: [{ service: 'Tower', rxFrequencyHz: 118_805_000 }],
          },
          frequencyIndices: [0],
        },
        {
          airport: {
            name: 'Edinburgh',
            icao: 'EGPH',
            iata: 'EDI',
            location: null,
            frequencies: [{ service: 'Tower', rxFrequencyHz: 118_705_000 }],
          },
          frequencyIndices: [0],
        },
      ],
      { alsoCreateZone: true, zoneName: 'Scottish airband' },
    );

    expect(plan.totalChannelsToAdd).toHaveLength(2);
    expect(plan.zones).toHaveLength(1);
    expect(plan.zoneUpdates).toHaveLength(0);
    expect(plan.zones[0]?.name).toBe('Scottish airband');
    expect(plan.zones[0]?.members).toHaveLength(2);
  });

  it('appends new channels to an existing zone', () => {
    const library = emptyLibrary();
    const airband = { ...newZone('p1', 'Airband'), id: 'zone-airband' };
    library.zones.push(airband);

    const plan = buildAirbandImportPlan(
      library,
      'p1',
      [
        {
          airport: {
            name: 'Glasgow',
            icao: 'EGPF',
            iata: 'GLA',
            location: null,
            frequencies: [{ service: 'ATIS', rxFrequencyHz: 129_575_000 }],
          },
        },
      ],
      { alsoCreateZone: true, targetZoneId: 'zone-airband' },
    );

    expect(plan.zones).toHaveLength(0);
    expect(plan.zoneUpdates).toHaveLength(1);
    expect(plan.zoneUpdates[0]?.zoneId).toBe('zone-airband');
    expect(plan.zoneUpdates[0]?.members).toHaveLength(1);
    expect(plan.totalChannelsToAdd).toHaveLength(1);
  });

  it('appends skipped duplicate channels to existing zone by library id', () => {
    const library = emptyLibrary();
    library.channels.push(airbandChannel('existing'));
    const airband = { ...newZone('p1', 'Airband'), id: 'zone-airband' };
    library.zones.push(airband);

    const plan = buildAirbandImportPlan(
      library,
      'p1',
      [
        {
          airport: {
            name: 'Glasgow',
            icao: 'EGPF',
            iata: 'GLA',
            location: null,
            frequencies: [
              { service: 'Tower', rxFrequencyHz: 118_805_000 },
              { service: 'ATIS', rxFrequencyHz: 129_575_000 },
            ],
          },
        },
      ],
      { alsoCreateZone: true, targetZoneId: 'zone-airband' },
    );

    expect(plan.totalChannelsToAdd).toHaveLength(1);
    expect(plan.totalSkipped).toHaveLength(1);
    expect(plan.zones).toHaveLength(0);
    expect(plan.zoneUpdates[0]?.members).toHaveLength(2);
    expect(plan.zoneUpdates[0]?.members.map((m) => ('channelId' in m ? m.channelId : ''))).toEqual(
      expect.arrayContaining(['existing', plan.totalChannelsToAdd[0]?.id]),
    );
  });

  it('appends batch import from multiple airports to one existing zone', () => {
    const library = emptyLibrary();
    const airband = { ...newZone('p1', 'Airband'), id: 'zone-airband' };
    library.zones.push(airband);

    const plan = buildAirbandImportPlan(
      library,
      'p1',
      [
        {
          airport: {
            name: 'Glasgow',
            icao: 'EGPF',
            iata: 'GLA',
            location: null,
            frequencies: [{ service: 'Tower', rxFrequencyHz: 118_805_000 }],
          },
          frequencyIndices: [0],
        },
        {
          airport: {
            name: 'Edinburgh',
            icao: 'EGPH',
            iata: 'EDI',
            location: null,
            frequencies: [{ service: 'Tower', rxFrequencyHz: 118_705_000 }],
          },
          frequencyIndices: [0],
        },
      ],
      { alsoCreateZone: true, targetZoneId: 'zone-airband' },
    );

    expect(plan.zones).toHaveLength(0);
    expect(plan.zoneUpdates).toHaveLength(1);
    expect(plan.zoneUpdates[0]?.members).toHaveLength(2);
  });

  it('sets zoneTargetError when target zone is missing', () => {
    const library = emptyLibrary();
    const plan = buildAirbandImportPlan(
      library,
      'p1',
      [
        {
          airport: {
            name: 'Glasgow',
            icao: 'EGPF',
            iata: 'GLA',
            location: null,
            frequencies: [{ service: 'Tower', rxFrequencyHz: 118_805_000 }],
          },
        },
      ],
      { alsoCreateZone: true, targetZoneId: 'missing-zone' },
    );

    expect(plan.zoneTargetError).toBeTruthy();
    expect(plan.zoneUpdates).toHaveLength(0);
    expect(plan.zones).toHaveLength(0);
  });
});
