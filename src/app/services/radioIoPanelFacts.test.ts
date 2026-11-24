import { describe, expect, it } from 'vitest';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import { radioIoPanelFacts } from './radioIoPanelFacts.ts';

describe('radioIoPanelFacts', () => {
  it('radioIoPanelFacts lists out-of-range channels with id, callsign and name', () => {
    const { build, egress } = newRadioBuildForProfile('project-1', 'radio-io-at-d890uv');
    const out = newChannel('project-1', 'Far repeater');
    out.id = 'ch-far';
    out.callsign = 'GB3ZZ';
    out.rxFrequency = 10_000_000_000;
    out.modeProfiles = [
      {
        mode: 'fm',
        rxTone: 'none',
        txTone: 'none',
        squelch: null,
        bandwidthKHz: null,
        analogSquelchMode: 'default',
      } as never,
    ];
    const facts = radioIoPanelFacts(build, egress, {
      channels: [out],
      zones: [],
      scanLists: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      aprsConfiguration: null,
    });
    expect(facts.outOfRangeChannels).toEqual([
      { id: 'ch-far', callsign: 'GB3ZZ', name: 'Far repeater' },
    ]);
  });
});
