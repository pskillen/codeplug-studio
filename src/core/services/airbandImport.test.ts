import { describe, expect, it } from 'vitest';
import { emptyLibrary } from '@core/domain/factories.ts';
import { buildAirbandImportPlan } from './airbandImport.ts';

describe('buildAirbandImportPlan', () => {
  it('dedupes and creates optional zone', () => {
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
      modeProfiles: [{ mode: 'am', squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 }],
      revision: { updatedAt: '', version: 1 },
      updatedAt: '',
    });

    const plan = buildAirbandImportPlan(
      library,
      'p1',
      [
        {
          name: 'Glasgow',
          icao: 'EGPF',
          iata: 'GLA',
          location: null,
          frequencies: [
            { service: 'Tower', rxFrequencyHz: 118_805_000 },
            { service: 'ATIS', rxFrequencyHz: 129_575_000 },
          ],
        },
      ],
      { alsoCreateZone: true },
    );

    expect(plan.totalChannelsToAdd).toHaveLength(1);
    expect(plan.totalSkipped).toHaveLength(1);
    expect(plan.zones).toHaveLength(1);
    expect(plan.zones[0]?.name).toBe('EGPF — Glasgow');
    expect(plan.zones[0]?.members).toHaveLength(1);
  });
});
