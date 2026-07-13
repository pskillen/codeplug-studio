import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { geocodeQuery, reverseGeocode } from './geocode.ts';
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
