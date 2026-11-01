import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Channel } from '@core/models/library.ts';

const geocodeQuery = vi.fn();
vi.mock('@integrations/geocode/index.ts', () => ({
  geocodeQuery: (...args: unknown[]) => geocodeQuery(...args),
}));

import { findLocatedChannels, PlaceNotFoundError, resolvePlace } from './resolvePlace.ts';

function channel(over: Partial<Channel>): Channel {
  return { id: 'c1', name: 'GB7GL Glasgow', callsign: 'GB7GL', ...over } as Channel;
}

describe('resolvePlace', () => {
  beforeEach(() => geocodeQuery.mockReset());

  it('resolves a locator without any network call', async () => {
    const p = await resolvePlace('io75ui');
    expect(p.kind).toBe('locator');
    expect(p.label).toBe('IO75UI');
    expect(p.lat).toBeCloseTo(55.35, 1);
    expect(geocodeQuery).not.toHaveBeenCalled();
  });

  it('prefers a located library channel over geocoding', async () => {
    const p = await resolvePlace('gb7gl', {
      channels: [channel({ location: { lat: 55.9, lon: -4.3 } })],
    });
    expect(p.kind).toBe('channel');
    expect(p.lat).toBe(55.9);
    expect(geocodeQuery).not.toHaveBeenCalled();
  });

  it('ignores channels without coordinates and falls back to geocoding', async () => {
    geocodeQuery.mockResolvedValue({ lat: 1, lon: 2, label: 'Somewhere' });
    const p = await resolvePlace('GB7GL', { channels: [channel({})], mapboxToken: 't' });
    expect(p).toEqual({ lat: 1, lon: 2, label: 'Somewhere', kind: 'address' });
    expect(geocodeQuery).toHaveBeenCalledWith('GB7GL', { mapboxToken: 't', provider: undefined });
  });

  it('reports empty input and no results', async () => {
    await expect(resolvePlace('  ')).rejects.toBeInstanceOf(PlaceNotFoundError);
    geocodeQuery.mockResolvedValue(null);
    await expect(resolvePlace('zzzz')).rejects.toThrow('No results found');
  });
});

describe('findLocatedChannels', () => {
  it('matches callsign or name exactly, case-insensitively', () => {
    const ch = channel({ location: { lat: 1, lon: 1 } });
    expect(findLocatedChannels([ch], 'gb7gl')).toHaveLength(1);
    expect(findLocatedChannels([ch], 'gb7gl glasgow')).toHaveLength(1);
    expect(findLocatedChannels([ch], 'gb7')).toHaveLength(0);
  });
});
