import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import { matchListingForChannel } from './matchListing.ts';
import type { RepeaterListing } from './types.ts';

const baseListing: RepeaterListing = {
  source: 'ukrepeater',
  remoteId: '1',
  callsign: 'GB3DA',
  name: 'Danbury',
  rxFrequencyHz: 145_725_000,
  txFrequencyHz: 145_125_000,
  toneHz: null,
  modes: ['fm'],
  primaryMode: 'fm',
  colourCode: null,
  locator: 'JO01GR',
  location: null,
  band: '2M',
  status: 'OPERATIONAL',
};

const baseChannel: Channel = {
  ...newChannel('p1', 'Danbury', 'GB3DA'),
  rxFrequency: 145_725_000,
  txFrequency: 145_125_000,
  modeProfiles: [{ mode: 'fm', rxTone: 'none', txTone: 'none', squelch: null, bandwidthKHz: null }],
};

describe('matchListingForChannel', () => {
  it('returns null for empty listings', () => {
    expect(matchListingForChannel(baseChannel, [])).toBeNull();
  });

  it('matches by RX/TX frequency', () => {
    const other: RepeaterListing = {
      ...baseListing,
      remoteId: '2',
      callsign: 'GB3DB',
      rxFrequencyHz: 430_000_000,
      txFrequencyHz: 438_000_000,
    };
    const match = matchListingForChannel(baseChannel, [other, baseListing]);
    expect(match?.remoteId).toBe('1');
  });

  it('falls back to callsign match', () => {
    const channel = { ...baseChannel, rxFrequency: null, txFrequency: null };
    const match = matchListingForChannel(channel, [baseListing]);
    expect(match?.callsign).toBe('GB3DA');
  });

  it('returns sole listing when only one result', () => {
    const channel = { ...baseChannel, callsign: 'OTHER', rxFrequency: null, txFrequency: null };
    expect(matchListingForChannel(channel, [baseListing])?.remoteId).toBe('1');
  });

  it('returns null when multiple listings and no freq/callsign match', () => {
    const channel = { ...baseChannel, callsign: 'OTHER', rxFrequency: null, txFrequency: null };
    const other = { ...baseListing, remoteId: '2', callsign: 'GB3DB' };
    expect(matchListingForChannel(channel, [baseListing, other])).toBeNull();
  });
});
