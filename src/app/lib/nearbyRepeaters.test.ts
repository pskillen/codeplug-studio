import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import type { RepeaterListing } from '@integrations/repeaters/index.ts';
import {
  DEFAULT_NEARBY_RADIUS_KM,
  applyNearbyFilters,
  buildNearbyItems,
  parseNearbyFilters,
} from './nearbyRepeaters.ts';

function listing(over: Partial<RepeaterListing>): RepeaterListing {
  return {
    source: 'ukrepeater',
    remoteId: '1',
    callsign: 'GB7GL',
    name: 'Glasgow',
    rxFrequencyHz: 439_487_500,
    txFrequencyHz: 430_887_500,
    rxToneHz: null,
    txToneHz: null,
    modes: ['dmr'],
    primaryMode: 'dmr',
    colourCode: 1,
    locator: 'IO75',
    location: { lat: 55.5, lon: -4 },
    band: '70CM',
    status: 'OPERATIONAL',
    ...over,
  };
}

function channel(over: Partial<Channel>): Channel {
  return {
    id: 'c1',
    name: 'GB3GL',
    callsign: 'GB3GL',
    rxFrequency: 145_612_500,
    txFrequency: 145_012_500,
    location: { lat: 55.8, lon: -4.2 },
    useLocation: true,
    modeProfiles: [{ mode: 'fm' }],
    ...over,
  } as Channel;
}

describe('buildNearbyItems', () => {
  it('maps directory listings and flags callsigns already in the library', () => {
    const items = buildNearbyItems({
      listings: [listing({}), listing({ remoteId: '2', callsign: 'GB7XX' })],
      channels: [channel({ callsign: 'gb7gl', name: 'Mine', location: null })],
      sources: ['ukrepeater'],
    });
    expect(items.map((i) => [i.callsign, i.inLibrary, i.band])).toEqual([
      ['GB7GL', true, '70cm'],
      ['GB7XX', false, '70cm'],
    ]);
  });

  it('skips listings without a location', () => {
    const items = buildNearbyItems({
      listings: [listing({ location: null })],
      channels: [],
      sources: ['ukrepeater'],
    });
    expect(items).toHaveLength(0);
  });

  it('adds geolocated library channels and does not duplicate a directory callsign', () => {
    const items = buildNearbyItems({
      listings: [listing({ callsign: 'GB3GL', band: '2M', rxFrequencyHz: 145_612_500 })],
      channels: [channel({}), channel({ id: 'c2', callsign: 'MB7ZZ', name: 'MB7ZZ' })],
      sources: ['ukrepeater', 'library'],
    });
    expect(items.map((i) => [i.callsign, i.source])).toEqual([
      ['GB3GL', 'ukrepeater'],
      ['MB7ZZ', 'library'],
    ]);
  });

  it('ignores channels without useLocation', () => {
    const items = buildNearbyItems({
      listings: [],
      channels: [channel({ useLocation: false })],
      sources: ['library'],
    });
    expect(items).toHaveLength(0);
  });
});

describe('applyNearbyFilters', () => {
  const items = buildNearbyItems({
    listings: [
      listing({}),
      listing({
        remoteId: '2',
        callsign: 'GB3PA',
        rxFrequencyHz: 145_600_000,
        modes: ['fm'],
        status: 'OFF AIR',
      }),
    ],
    channels: [],
    sources: ['ukrepeater'],
  });

  it('filters by band, mode and operational status', () => {
    const none = { bands: [], modes: [], operationalOnly: false } as const;
    expect(applyNearbyFilters(items, none)).toHaveLength(2);
    expect(applyNearbyFilters(items, { ...none, bands: ['2m'] }).map((i) => i.callsign)).toEqual([
      'GB3PA',
    ]);
    expect(applyNearbyFilters(items, { ...none, modes: ['dmr'] }).map((i) => i.callsign)).toEqual([
      'GB7GL',
    ]);
    expect(
      applyNearbyFilters(items, { ...none, operationalOnly: true }).map((i) => i.callsign),
    ).toEqual(['GB7GL']);
  });
});

describe('parseNearbyFilters', () => {
  const parse = (qs: string, hasProject = false) =>
    parseNearbyFilters(new URLSearchParams(qs), { hasProject });

  it('defaults sources by project state', () => {
    expect(parse('').sources).toEqual(['ukrepeater']);
    expect(parse('', true).sources).toEqual(['ukrepeater', 'library']);
  });

  it('treats s=none as no sources and drops unknown ids', () => {
    expect(parse('s=none').sources).toEqual([]);
    expect(parse('s=ukrepeater,bogus').sources).toEqual(['ukrepeater']);
  });

  it('drops unknown band and mode ids', () => {
    const f = parse('b=2m,9km&m=dmr,zzz&op=1');
    expect(f.bands).toEqual(['2m']);
    expect(f.modes).toEqual(['dmr']);
    expect(f.operationalOnly).toBe(true);
  });

  it.each(['NaN', '-3', '0', '201', 'abc'])('falls back to the default radius for r=%s', (r) => {
    expect(parse(`r=${r}`).radiusKm).toBe(DEFAULT_NEARBY_RADIUS_KM);
  });

  it('keeps a valid radius', () => {
    expect(parse('r=50').radiusKm).toBe(50);
  });
});
