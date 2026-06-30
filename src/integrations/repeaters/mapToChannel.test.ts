import { describe, expect, it } from 'vitest';
import type { ChannelModeProfileDMR, ChannelModeProfileFM } from '@core/models/library.ts';
import { repeaterListingToChannel } from './mapToChannel.ts';
import type { RepeaterListing } from './types.ts';

const fmListing: RepeaterListing = {
  source: 'ukrepeater',
  remoteId: '4120',
  callsign: 'GB3DA',
  name: 'Danbury',
  rxFrequencyHz: 145_725_000,
  txFrequencyHz: 145_125_000,
  toneHz: 110.9,
  mode: 'fm',
  colourCode: null,
  locator: 'JO01GR',
  location: { lat: 51.7, lon: 0.6 },
  band: '2M',
  status: 'OPERATIONAL',
};

describe('repeaterListingToChannel', () => {
  it('maps an FM repeater to a channel with an FM profile and tone', () => {
    const channel = repeaterListingToChannel(fmListing, 'p1');
    expect(channel.callsign).toBe('GB3DA');
    expect(channel.name).toBe('GB3DA Danbury');
    expect(channel.rxFrequency).toBe(145_725_000);
    expect(channel.txFrequency).toBe(145_125_000);
    expect(channel.useLocation).toBe(true);
    expect(channel.location).toEqual({ lat: 51.7, lon: 0.6 });
    const profile = channel.modeProfiles[0] as ChannelModeProfileFM;
    expect(profile.mode).toBe('fm');
    expect(profile.rxTone).toBe('110.9');
  });

  it('maps a DMR repeater to a channel with a DMR profile and colour code', () => {
    const channel = repeaterListingToChannel(
      { ...fmListing, mode: 'dmr', colourCode: 1, toneHz: null },
      'p1',
    );
    const profile = channel.modeProfiles[0] as ChannelModeProfileDMR;
    expect(profile.mode).toBe('dmr');
    expect(profile.colourCode).toBe(1);
  });
});
