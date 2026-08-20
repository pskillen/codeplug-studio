import { describe, expect, it } from 'vitest';
import type { ChannelModeProfileAnalog, ChannelModeProfileDMR } from '@core/models/library.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
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
  rxToneHz: 110.9,
  txToneHz: 110.9,
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

  it('formats whole-number repeater CTCSS with one decimal place', () => {
    const profiles = buildModeProfilesFromListing({
      ...baseListing,
      rxToneHz: 100,
      txToneHz: 100,
    });
    const fm = profiles[0] as ChannelModeProfileAnalog;
    expect(fm.rxTone).toBe('100.0');
    expect(fm.txTone).toBe('100.0');
  });

  it('collapses legacy ssb modes to one ssb profile with first sideband', () => {
    const profiles = buildModeProfilesFromListing({
      ...baseListing,
      modes: ['ssb-usb', 'ssb-lsb'] as unknown as ChannelMode[],
    });
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ mode: 'ssb', ssbSideband: 'usb' });
  });

  it('keeps fm when listed before ssb', () => {
    const profiles = buildModeProfilesFromListing({
      ...baseListing,
      modes: ['fm', 'ssb'],
    });
    expect(profiles.map((p) => p.mode)).toEqual(['fm']);
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
    expect(channel.maidenheadLocator).toBe('JO01GR');
    const profile = channel.modeProfiles[0] as ChannelModeProfileAnalog;
    expect(profile.mode).toBe('fm');
    expect(profile.rxTone).toBe('110.9');
  });

  it('maps whole-number repeater tone to library CTCSS with decimal', () => {
    const channel = repeaterListingToChannel(
      { ...baseListing, rxToneHz: 100, txToneHz: 100 },
      'p1',
    );
    const profile = channel.modeProfiles[0] as ChannelModeProfileAnalog;
    expect(profile.rxTone).toBe('100.0');
    expect(profile.txTone).toBe('100.0');
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
      {
        ...baseListing,
        modes: ['dmr'],
        primaryMode: 'dmr',
        colourCode: 1,
        rxToneHz: null,
        txToneHz: null,
      },
      'p1',
    );
    const profile = channel.modeProfiles[0] as ChannelModeProfileDMR;
    expect(profile.mode).toBe('dmr');
    expect(profile.colourCode).toBe(1);
  });

  it('title-cases name and comment when requested', () => {
    const channel = repeaterListingToChannel(
      { ...baseListing, name: 'DANBURY', status: 'OPERATIONAL' },
      'p1',
      { titleCaseText: true },
    );
    expect(channel.name).toBe('Danbury');
    expect(channel.comment).toBe('Danbury — Operational');
  });

  it('maps a ukrepeater listing with TX-only tone to TX tone, RX none (#1254)', () => {
    const channel = repeaterListingToChannel(
      { ...baseListing, rxToneHz: null, txToneHz: 110.9 },
      'p1',
    );
    const profile = channel.modeProfiles[0] as ChannelModeProfileAnalog;
    expect(profile.rxTone).toBe('none');
    expect(profile.txTone).toBe('110.9');
  });

  it('omits comment for BrandMeister listings by default', () => {
    const channel = repeaterListingToChannel(
      {
        ...baseListing,
        source: 'brandmeister',
        name: 'London',
        status: 'Online',
      },
      'p1',
    );
    expect(channel.comment).toBe('');
  });
});
