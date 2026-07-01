import { describe, expect, it } from 'vitest';
import type { ChannelModeProfileDMR, ChannelModeProfileFM } from '@core/models/library.ts';
import { buildModeProfilesFromListing } from './buildModeProfiles.ts';
import { repeaterListingToChannel } from './mapToChannel.ts';
import type { RepeaterListing } from './types.ts';

const baseListing: RepeaterListing = {
  source: 'ukrepeater',
  remoteId: '4120',
  callsign: 'GB3DA',
  name: 'Danbury',
  rxFrequencyHz: 145_725_000,
  txFrequencyHz: 145_125_000,
  toneHz: 110.9,
  modes: ['fm'],
  primaryMode: 'fm',
  colourCode: null,
  locator: 'JO01GR',
  location: { lat: 51.7, lon: 0.6 },
  band: '2M',
  status: 'OPERATIONAL',
};

describe('buildModeProfilesFromListing', () => {
  it('creates FM and DMR profiles for a multi-mode analogue + DMR listing', () => {
    const profiles = buildModeProfilesFromListing({
      ...baseListing,
      modes: ['fm', 'dmr'],
      colourCode: 1,
    });
    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toMatchObject({ mode: 'fm', rxTone: '110.9' });
    expect(profiles[1]).toMatchObject({ mode: 'dmr', colourCode: 1 });
  });

  it('creates stubs for other digital modes alongside FM and DMR', () => {
    const profiles = buildModeProfilesFromListing({
      ...baseListing,
      modes: ['fm', 'dmr', 'dstar', 'ysf', 'p25', 'nxdn'],
      colourCode: 1,
    });
    expect(profiles.map((p) => p.mode)).toEqual(['fm', 'dmr', 'dstar', 'ysf', 'p25', 'nxdn']);
  });

  it('defaults to a single FM profile when no modes are advertised', () => {
    const profiles = buildModeProfilesFromListing({ ...baseListing, modes: [] });
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.mode).toBe('fm');
  });
});

describe('repeaterListingToChannel', () => {
  it('maps an FM repeater to a channel with an FM profile and tone', () => {
    const channel = repeaterListingToChannel(baseListing, 'p1');
    expect(channel.callsign).toBe('GB3DA');
    expect(channel.name).toBe('Danbury');
    expect(channel.rxFrequency).toBe(145_725_000);
    expect(channel.txFrequency).toBe(145_125_000);
    expect(channel.useLocation).toBe(true);
    expect(channel.location).toEqual({ lat: 51.7, lon: 0.6 });
    const profile = channel.modeProfiles[0] as ChannelModeProfileFM;
    expect(profile.mode).toBe('fm');
    expect(profile.rxTone).toBe('110.9');
  });

  it('falls back to callsign when town is missing', () => {
    const channel = repeaterListingToChannel({ ...baseListing, name: '' }, 'p1');
    expect(channel.callsign).toBe('GB3DA');
    expect(channel.name).toBe('GB3DA');
  });

  it('maps FM + Fusion to FM profile and YSF stub', () => {
    const channel = repeaterListingToChannel({ ...baseListing, modes: ['fm', 'ysf'] }, 'p1');
    expect(channel.modeProfiles.map((p) => p.mode)).toEqual(['fm', 'ysf']);
  });

  it('maps a DMR repeater to a channel with a DMR profile and colour code', () => {
    const channel = repeaterListingToChannel(
      { ...baseListing, modes: ['dmr'], primaryMode: 'dmr', colourCode: 1, toneHz: null },
      'p1',
    );
    const profile = channel.modeProfiles[0] as ChannelModeProfileDMR;
    expect(profile.mode).toBe('dmr');
    expect(profile.colourCode).toBe(1);
  });
});
