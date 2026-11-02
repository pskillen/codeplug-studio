import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import type { RepeaterListing } from '@integrations/repeaters/index.ts';
import {
  DEFAULT_NEARBY_RADIUS_KM,
  applyNearbyFilters,
  buildNearbyItems,
  formatHeardAgo,
  nearbyMarkerMode,
  nearbySourcesSummary,
  parseNearbyFilters,
} from './nearbyRepeaters.ts';
import type { MeshtasticInfrastructureNode } from '@integrations/meshflow/index.ts';
import { rankByDistance } from '@core/domain/fieldGeo.ts';

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

describe('Meshtastic rows', () => {
  const NOW = Date.parse('2026-11-02T12:00:00Z');
  const node = (
    over: Partial<MeshtasticInfrastructureNode> = {},
  ): MeshtasticInfrastructureNode => ({
    nodeId: '!0000a001',
    longName: 'Test Hill Router',
    shortName: 'THR',
    role: 'Router',
    hardwareModel: '',
    lastHeardAt: '2026-11-02T09:00:00Z',
    location: { lat: 55.9, lon: -4.3 },
    altitudeM: null,
    ...over,
  });
  const base = { listings: [], channels: [], now: NOW };

  it('ignores nodes unless the source is on', () => {
    expect(
      buildNearbyItems({ ...base, sources: ['ukrepeater'], meshtasticNodes: [node()] }),
    ).toEqual([]);
  });

  it('maps a node to a display-only row', () => {
    const [item] = buildNearbyItems({
      ...base,
      sources: ['meshtastic'],
      meshtasticNodes: [node()],
    });
    expect(item).toEqual({
      key: 'meshtastic:!0000a001',
      source: 'meshtastic',
      callsign: 'THR',
      name: 'Test Hill Router',
      rxFrequencyHz: null,
      band: '',
      modes: [],
      status: '',
      detail: 'Router · heard 3 h ago',
      location: { lat: 55.9, lon: -4.3 },
      inLibrary: false,
    });
    expect(item.listing).toBeUndefined();
  });

  it('falls back to the node id and blanks a duplicate name', () => {
    const [a, b] = buildNearbyItems({
      ...base,
      sources: ['meshtastic'],
      meshtasticNodes: [
        node({ shortName: '' }),
        node({
          nodeId: '!0000a002',
          shortName: 'SAME',
          longName: 'SAME',
          role: '',
          lastHeardAt: null,
        }),
      ],
    });
    expect(a.callsign).toBe('!0000a001');
    expect(b.name).toBe('');
    expect(b.detail).toBe('');
  });

  it('does not fold with or hide a library channel of the same callsign', () => {
    const items = buildNearbyItems({
      ...base,
      channels: [channel({ callsign: 'THR', name: 'THR' })],
      sources: ['library', 'meshtastic'],
      meshtasticNodes: [node()],
    });
    expect(items.map((i) => i.source).sort()).toEqual(['library', 'meshtastic']);
    expect(items.find((i) => i.source === 'meshtastic')?.inLibrary).toBe(false);
  });

  it('keeps mesh rows through band, mode and operational filters', () => {
    const items = [
      ...buildNearbyItems({
        listings: [listing({ callsign: 'GB3PA', band: '70CM', modes: ['fm'], status: 'OFF AIR' })],
        channels: [],
        sources: ['ukrepeater', 'meshtastic'],
        meshtasticNodes: [node()],
        now: NOW,
      }),
    ];
    const out = applyNearbyFilters(items, { bands: ['2m'], modes: ['dmr'], operationalOnly: true });
    expect(out.map((i) => i.source)).toEqual(['meshtastic']);
  });

  it('never gives mesh rows an add listing', () => {
    const items = buildNearbyItems({ ...base, sources: ['meshtastic'], meshtasticNodes: [node()] });
    expect(items.every((i) => i.listing === undefined)).toBe(true);
  });

  it('ranks by computed distance, ignoring any wire distance', () => {
    const near = node({ nodeId: '!n', location: { lat: 55.86, lon: -4.26 } });
    const far = node({ nodeId: '!f', location: { lat: 56.5, lon: -4.0 } });
    const items = buildNearbyItems({
      ...base,
      sources: ['meshtastic'],
      meshtasticNodes: [far, near],
    });
    const ranked = rankByDistance(items, { lat: 55.86, lon: -4.25 }, (i) => i.location, 200_000);
    expect(ranked.map((r) => r.item.key)).toEqual(['meshtastic:!n', 'meshtastic:!f']);
  });
});

describe('nearbyMarkerMode', () => {
  const [ukItem] = buildNearbyItems({
    listings: [listing({ modes: ['dmr', 'fm'] })],
    channels: [],
    sources: ['ukrepeater'],
  });

  it('uses the first mode of a repeater row', () => {
    expect(nearbyMarkerMode(ukItem)).toBe('dmr');
  });

  it('falls back to other when a row has no mode', () => {
    expect(nearbyMarkerMode({ ...ukItem, modes: [] })).toBe('other');
  });

  it('uses the reserved meshtastic colour for mesh rows', () => {
    expect(nearbyMarkerMode({ ...ukItem, source: 'meshtastic', modes: [] })).toBe('meshtastic');
  });
});

describe('formatHeardAgo', () => {
  const NOW = Date.parse('2026-11-02T12:00:00Z');
  const ago = (ms: number) => new Date(NOW - ms).toISOString();
  it.each([
    [null, ''],
    ['garbage', ''],
    [new Date(NOW + 60_000).toISOString(), 'heard just now'],
    [new Date(NOW - 30_000).toISOString(), 'heard just now'],
    [ago(5 * 60_000), 'heard 5 min ago'],
    [ago(3 * 3_600_000), 'heard 3 h ago'],
    [ago(47 * 3_600_000), 'heard 47 h ago'],
    [ago(72 * 3_600_000), 'heard 3 d ago'],
  ])('formats %s', (iso, expected) => {
    expect(formatHeardAgo(iso, NOW)).toBe(expected);
  });
});

describe('nearbySourcesSummary', () => {
  it('summarises the selection', () => {
    expect(nearbySourcesSummary([], true)).toBe('no sources');
    expect(nearbySourcesSummary(['library'], true)).toBe('My library');
    expect(nearbySourcesSummary(['ukrepeater', 'meshtastic'], true)).toBe('2 sources');
    expect(nearbySourcesSummary(['ukrepeater', 'library', 'meshtastic'], true)).toBe('all sources');
    expect(nearbySourcesSummary(['ukrepeater', 'meshtastic'], false)).toBe('all sources');
    expect(nearbySourcesSummary(['meshtastic'], false)).toBe('Meshtastic');
  });
});
