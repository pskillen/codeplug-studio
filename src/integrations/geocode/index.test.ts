import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeocodeError, geocodeQuery, reverseGeocode } from './index.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('geocodeQuery', () => {
  it('throws when query is empty', async () => {
    await expect(geocodeQuery('  ')).rejects.toBeInstanceOf(GeocodeError);
  });

  it('returns Photon result on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              geometry: { coordinates: [-4.25, 55.86] },
              properties: { name: 'Glasgow', city: 'Glasgow', country: 'United Kingdom' },
            },
          ],
        }),
      }),
    );

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
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ features: [] }),
      }),
    );

    expect(await geocodeQuery('nowhere-xyz', { provider: 'photon' })).toBeNull();
  });

  it('throws when Mapbox token is missing', async () => {
    await expect(geocodeQuery('Glasgow', { provider: 'mapbox' })).rejects.toBeInstanceOf(
      GeocodeError,
    );
  });

  it('throws when Mapbox request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    );

    await expect(
      geocodeQuery('Glasgow', { provider: 'mapbox', mapboxToken: 'pk.test' }),
    ).rejects.toBeInstanceOf(GeocodeError);
  });
});

describe('reverseGeocode', () => {
  it('returns Photon country on reverse lookup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
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
      }),
    );

    const result = await reverseGeocode({ lat: 51.5, lon: -0.1 }, { provider: 'photon' });
    expect(result?.country).toBe('United Kingdom');
    expect(result?.label).toContain('United Kingdom');
  });
});
