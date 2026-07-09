import { describe, expect, it } from 'vitest';
import { emptyLibrary } from '@core/domain/factories.ts';
import type { AirbandAirportInput } from './types.ts';
import {
  channelsMatchingAirbandFrequency,
  findExistingAirbandChannelMatch,
  formatAirbandChannelName,
  possibleAirbandChannelNames,
  resolveAirportNameLabel,
  stripLeadingAirportTokens,
  titleCaseWords,
} from './naming.ts';

const glasgowAirport: AirbandAirportInput = {
  name: 'glasgow airport',
  icao: 'EGPF',
  iata: 'GLA',
  location: null,
  frequencies: [],
};

const nameOnlyAirport: AirbandAirportInput = {
  name: 'Remote Strip',
  icao: null,
  iata: null,
  location: null,
  frequencies: [],
};

describe('titleCaseWords', () => {
  it('title-cases each word', () => {
    expect(titleCaseWords('tower')).toBe('Tower');
    expect(titleCaseWords('ground movement')).toBe('Ground Movement');
  });
});

describe('resolveAirportNameLabel', () => {
  it('defaults to IATA', () => {
    expect(resolveAirportNameLabel(glasgowAirport, 'iata')).toBe('GLA');
  });

  it('falls back from IATA to ICAO to name', () => {
    expect(resolveAirportNameLabel(nameOnlyAirport, 'iata')).toBe('Remote Strip');
  });

  it('prefers ICAO when requested', () => {
    expect(resolveAirportNameLabel(glasgowAirport, 'icao')).toBe('EGPF');
  });
});

describe('stripLeadingAirportTokens', () => {
  it('leaves bare service labels unchanged', () => {
    expect(stripLeadingAirportTokens('Tower', glasgowAirport)).toBe('Tower');
  });

  it('strips a leading IATA token', () => {
    expect(stripLeadingAirportTokens('GLA Tower', glasgowAirport)).toBe('Tower');
  });

  it('strips a leading ICAO token', () => {
    expect(stripLeadingAirportTokens('EGPF ATIS', glasgowAirport)).toBe('ATIS');
  });

  it('strips a leading airport name', () => {
    expect(stripLeadingAirportTokens('glasgow airport Ground', glasgowAirport)).toBe('Ground');
  });
});

describe('formatAirbandChannelName', () => {
  it('builds IATA-prefixed names with title-cased services', () => {
    expect(formatAirbandChannelName(glasgowAirport, 'tower')).toBe('GLA Tower');
  });

  it('replaces duplicate leading codes before applying the chosen prefix', () => {
    expect(formatAirbandChannelName(glasgowAirport, 'EGPF tower', { namePrefixKind: 'iata' })).toBe(
      'GLA Tower',
    );
  });

  it('title-cases airport name labels when that prefix is selected', () => {
    expect(formatAirbandChannelName(glasgowAirport, 'tower', { namePrefixKind: 'name' })).toBe(
      'Glasgow Airport Tower',
    );
  });

  it('uses ICAO when selected', () => {
    expect(formatAirbandChannelName(glasgowAirport, 'Tower', { namePrefixKind: 'icao' })).toBe(
      'EGPF Tower',
    );
  });

  it('applies extra literal namePrefix after airport label', () => {
    expect(
      formatAirbandChannelName(glasgowAirport, 'Tower', {
        namePrefixKind: 'iata',
        namePrefix: 'AB-',
      }),
    ).toBe('AB-GLA Tower');
  });
});

describe('possibleAirbandChannelNames', () => {
  it('includes each prefix kind and the raw wire label', () => {
    const names = possibleAirbandChannelNames(glasgowAirport, 'tower');
    expect(names).toContain('tower');
    expect(names).toContain('GLA Tower');
    expect(names).toContain('EGPF Tower');
    expect(names).toContain('Glasgow Airport Tower');
  });
});

describe('findExistingAirbandChannelMatch', () => {
  it('matches AM simplex channels on frequency and plausible names', () => {
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

    const match = findExistingAirbandChannelMatch(
      glasgowAirport,
      'tower',
      118_805_000,
      library.channels,
    );
    expect(match?.id).toBe('existing');
  });

  it('ignores FM channels on the same frequency', () => {
    const library = emptyLibrary();
    library.channels.push({
      id: 'fm',
      projectId: 'p1',
      name: 'GLA Tower',
      callsign: '',
      rxFrequency: 118_805_000,
      txFrequency: 118_805_000,
      location: null,
      useLocation: false,
      maidenheadLocator: null,
      power: null,
      forbidTransmit: false,
      scanInclusion: 'default',
      comment: '',
      modeProfiles: [
        { mode: 'fm', squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
      ],
      revision: 1,
      updatedAt: '',
    });

    expect(
      findExistingAirbandChannelMatch(glasgowAirport, 'tower', 118_805_000, library.channels),
    ).toBeUndefined();
  });
});

describe('channelsMatchingAirbandFrequency', () => {
  it('includes RX-only AM channels', () => {
    const library = emptyLibrary();
    library.channels.push({
      id: 'rx-only',
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

    expect(channelsMatchingAirbandFrequency(library.channels, 118_805_000)).toHaveLength(1);
  });
});
