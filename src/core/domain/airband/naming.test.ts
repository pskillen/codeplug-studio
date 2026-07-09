import { describe, expect, it } from 'vitest';
import type { AirbandAirportInput } from './types.ts';
import {
  formatAirbandChannelName,
  previewAirbandChannelNameBeforeStrip,
  resolveAirportNameLabel,
  stripLeadingAirportTokens,
} from './naming.ts';

const glasgowAirport: AirbandAirportInput = {
  name: 'Glasgow',
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
    expect(stripLeadingAirportTokens('Glasgow Ground', glasgowAirport)).toBe('Ground');
  });

  it('strips repeated airport tokens', () => {
    expect(stripLeadingAirportTokens('GLA GLA Tower', glasgowAirport)).toBe('Tower');
  });
});

describe('formatAirbandChannelName', () => {
  it('builds IATA-prefixed names by default', () => {
    expect(formatAirbandChannelName(glasgowAirport, 'Tower')).toBe('GLA Tower');
  });

  it('replaces duplicate leading codes before applying the chosen prefix', () => {
    expect(formatAirbandChannelName(glasgowAirport, 'EGPF Tower', { namePrefixKind: 'iata' })).toBe(
      'GLA Tower',
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

describe('previewAirbandChannelNameBeforeStrip', () => {
  it('shows the unstripped composite for preview', () => {
    expect(
      previewAirbandChannelNameBeforeStrip(glasgowAirport, 'GLA Tower', {
        namePrefixKind: 'iata',
      }),
    ).toBe('GLA GLA Tower');
  });
});
