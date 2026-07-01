import { describe, expect, it } from 'vitest';
import type { Channel, ChannelModeProfileDMR, ChannelModeProfileFM } from '@core/models/library.ts';
import { filterChannelsForList } from './useChannelListFilters.ts';

function makeChannel(overrides: Partial<Channel> = {}): Channel {
  const fm: ChannelModeProfileFM = {
    mode: 'fm',
    squelch: null,
    rxTone: 'none',
    txTone: 'none',
  };
  return {
    id: 'ch-1',
    projectId: 'p1',
    revision: 1,
    name: 'Test',
    callsign: 'GB3TEST',
    rxFrequency: 145_000_000,
    txFrequency: 145_000_000,
    location: null,
    useLocation: false,
    power: null,
    scanSkip: false,
    comment: '',
    modeProfiles: [fm],
    ...overrides,
  };
}

describe('filterChannelsForList', () => {
  const channels = [
    makeChannel({ id: '1', name: 'Alpha FM', modeProfiles: [{ mode: 'fm', squelch: null, rxTone: 'none', txTone: 'none' }] }),
    makeChannel({
      id: '2',
      name: 'Bravo DMR',
      rxFrequency: 430_000_000,
      txFrequency: 430_000_000,
      modeProfiles: [
        {
          mode: 'dmr',
          colourCode: 1,
          timeslot: 1,
          dmrId: 123,
          contactRef: null,
          rxGroupListId: null,
        } satisfies ChannelModeProfileDMR,
      ],
    }),
    makeChannel({
      id: '3',
      name: 'Charlie split',
      rxFrequency: 145_000_000,
      txFrequency: 145_600_000,
    }),
  ];

  it('filters by name', () => {
    const result = filterChannelsForList(channels, { nameFilter: 'bravo', bandFilter: [], modeFilter: [], duplexFilter: null, distanceFilterEnabled: false, maxDistanceKm: 25, sortMode: 'name' }, null);
    expect(result.map((c) => c.id)).toEqual(['2']);
  });

  it('filters by mode using modeProfiles', () => {
    const result = filterChannelsForList(channels, { nameFilter: '', bandFilter: [], modeFilter: ['dmr'], duplexFilter: null, distanceFilterEnabled: false, maxDistanceKm: 25, sortMode: 'name' }, null);
    expect(result.map((c) => c.id)).toEqual(['2']);
  });

  it('filters by band', () => {
    const result = filterChannelsForList(channels, { nameFilter: '', bandFilter: ['2m'], modeFilter: [], duplexFilter: null, distanceFilterEnabled: false, maxDistanceKm: 25, sortMode: 'name' }, null);
    expect(result.map((c) => c.id)).toEqual(['1', '3']);
  });
});
