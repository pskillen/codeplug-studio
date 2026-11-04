import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { geocodeQuery, reverseGeocode, searchPlaces } from './geocode.ts';
import {
  setupIntegrationHttpTestMocks,
  teardownIntegrationHttpTestMocks,
} from '@integrations/http/testHelpers.ts';
import { GeocodeError } from './types.ts';

const glasgowBody = JSON.stringify({
  features: [
    {
      geometry: { coordinates: [-4.25, 55.86] },
      properties: { name: 'Glasgow', city: 'Glasgow', country: 'United Kingdom' },
    },
  ],
});

beforeEach(() => {
  setupIntegrationHttpTestMocks();
});

afterEach(() => {
  teardownIntegrationHttpTestMocks();
});

describe('geocodeQuery', () => {
  it('throws when query is empty', async () => {
    await expect(geocodeQuery('  ')).rejects.toBeInstanceOf(GeocodeError);
  });

  it('returns Photon result on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(glasgowBody, { status: 200 })));

    const result = await geocodeQuery('Glasgow', { provider: 'photon' });
    expect(result).toEqual({
      lat: 55.86,
      lon: -4.25,
      label: 'Glasgow, Glasgow, United Kingdom',
    });
  });

  it('returns null when Photon has no results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ features: [] }), { status: 200 })),
    );

    expect(await geocodeQuery('nowhere-xyz', { provider: 'photon' })).toBeNull();
  });

  it('reuses session cache on repeated Photon geocode', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response(glasgowBody, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await geocodeQuery('Glasgow', { provider: 'photon' });
    await geocodeQuery('Glasgow', { provider: 'photon' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('blocks Photon geocode during cooldown after 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })));

    await expect(geocodeQuery('Glasgow', { provider: 'photon' })).rejects.toMatchObject({
      message: expect.stringContaining('rate limit'),
    });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(geocodeQuery('Glasgow', { provider: 'photon' })).rejects.toMatchObject({
      message: expect.stringContaining('rate limit'),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when Mapbox token is missing', async () => {
    await expect(geocodeQuery('Glasgow', { provider: 'mapbox' })).rejects.toBeInstanceOf(
      GeocodeError,
    );
  });

  it('throws when Mapbox request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));

    await expect(
      geocodeQuery('Glasgow', { provider: 'mapbox', mapboxToken: 'pk.test' }),
    ).rejects.toBeInstanceOf(GeocodeError);
  });
});

describe('reverseGeocode', () => {
  it('returns Photon country on reverse lookup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            features: [
              {
                geometry: { coordinates: [-0.1, 51.5] },
                properties: {
                  name: 'London',
                  city: 'London',
                  country: 'United Kingdom',
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await reverseGeocode({ lat: 51.5, lon: -0.1 }, { provider: 'photon' });
    expect(result?.country).toBe('United Kingdom');
    expect(result?.label).toContain('United Kingdom');
  });

  it('reuses session cache on repeated Photon reverse geocode', async () => {
    const body = JSON.stringify({
      features: [
        {
          geometry: { coordinates: [-0.1, 51.5] },
          properties: { name: 'London', country: 'United Kingdom' },
        },
      ],
    });
    const fetchMock = vi.fn().mockImplementation(async () => new Response(body, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const coords = { lat: 51.5, lon: -0.1 };
    await reverseGeocode(coords, { provider: 'photon' });
    await reverseGeocode(coords, { provider: 'photon' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('searchPlaces', () => {
  const tandrageeBody = JSON.stringify({
    features: [
      {
        geometry: { coordinates: [-6.416, 54.355] },
        properties: {
          name: 'Tandragee',
          county: 'County Armagh',
          country: 'United Kingdom',
          osm_value: 'village',
        },
      },
      {
        geometry: { coordinates: [-6.5, 54.4] },
        properties: {
          name: 'Tandragee Road',
          state: 'Northern Ireland',
          country: 'United Kingdom',
        },
      },
    ],
  });

  it('throws when query is empty', async () => {
    await expect(searchPlaces(' ')).rejects.toBeInstanceOf(GeocodeError);
  });

  it('returns every Photon match, biased towards near', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(tandrageeBody, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchPlaces('Tandragee', { near: { lat: 54.5, lon: -6.0 } });
    expect(results).toEqual([
      {
        lat: 54.355,
        lon: -6.416,
        label: 'Tandragee, County Armagh, United Kingdom',
        kind: 'village',
      },
      { lat: 54.4, lon: -6.5, label: 'Tandragee Road, Northern Ireland, United Kingdom' },
    ]);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('q=Tandragee');
    expect(url).toContain('limit=5');
    expect(url).toContain('lat=54.5');
    expect(url).toContain('lon=-6');
  });

  it('returns an empty list when nothing matches', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ features: [] }), { status: 200 })),
    );
    await expect(searchPlaces('Nowhere at all', { provider: 'photon' })).resolves.toEqual([]);
  });

  it('uses Mapbox proximity when a token is set', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ features: [{ center: [-6.416, 54.355], place_name: 'Tandragee, UK' }] }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchPlaces('Tandragee', {
      mapboxToken: 'pk.test',
      near: { lat: 54.5, lon: -6.0 },
    });
    expect(results).toEqual([{ lat: 54.355, lon: -6.416, label: 'Tandragee, UK' }]);
    expect(String(fetchMock.mock.calls[0][0])).toContain('proximity=-6,54.5');
  });
});
