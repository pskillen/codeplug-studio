import { describe, expect, it } from 'vitest';
import { emptyLibrary } from '@core/domain/factories.ts';
import { buildAirbandImportPlan } from './airbandImport.ts';

describe('buildAirbandImportPlan', () => {
  it('dedupes and creates optional batch zone with default name', () => {
    const library = emptyLibrary();
    library.channels.push({
      id: 'existing',
      projectId: 'p1',
      name: 'GLA Tower',
      callsign: '',
      rxFrequency: 118_805_000,
      txFrequency: null,
      location: null,
      useLocation: false,
      maidenheadLocator: null,
      power: null,
      forbidTransmit: true,
      scanInclusion: 'default',
      comment: '',
      modeProfiles: [
        { mode: 'am', squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
      ],
      revision: 1,
      updatedAt: '',
    });

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
    expect(plan.totalChannelsToAdd[0]?.name).toContain('ATIS');
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
    expect(plan.zones[0]?.name).toBe('Scottish airband');
    expect(plan.zones[0]?.members).toHaveLength(2);
  });
});
