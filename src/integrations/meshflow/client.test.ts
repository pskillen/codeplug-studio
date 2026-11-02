import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupIntegrationHttpTestMocks,
  teardownIntegrationHttpTestMocks,
} from '../http/testHelpers.ts';
import { mockJsonFetch, mockTextFetch } from '../repeaters/testHelpers.ts';
import fixture from './__fixtures__/nearby-infrastructure.sample.json';
import {
  buildMeshflowNearbyUrl,
  humaniseRole,
  meshflowApiBase,
  searchMeshtasticInfrastructureNear,
} from './client.ts';
import { MeshflowError } from './errors.ts';

const QUERY = { lat: 55.8612, lon: -4.2518, radiusKm: 40.2 };

beforeEach(() => setupIntegrationHttpTestMocks());
afterEach(() => {
  vi.unstubAllEnvs();
  teardownIntegrationHttpTestMocks();
});

describe('buildMeshflowNearbyUrl', () => {
  it('builds the endpoint with rounded point and fixed window', () => {
    const url = new URL(buildMeshflowNearbyUrl(QUERY, 'https://example.test/api/'));
    expect(url.origin + url.pathname).toBe(
      'https://example.test/api/nodes/observed-nodes/infrastructure/nearby/',
    );
    expect(url.searchParams.get('lat')).toBe('55.86');
    expect(url.searchParams.get('lon')).toBe('-4.25');
    expect(url.searchParams.get('radius_km')).toBe('42');
    expect(url.searchParams.get('last_heard_within_days')).toBe('30');
  });

  it('clamps the radius to 1-100 km', () => {
    const radius = (km: number) =>
      new URL(
        buildMeshflowNearbyUrl({ ...QUERY, radiusKm: km }, 'https://x.test'),
      ).searchParams.get('radius_km');
    expect(radius(0.5)).toBe('2');
    expect(radius(0)).toBe('1');
    expect(radius(160.9)).toBe('100');
  });
});

describe('meshflowApiBase', () => {
  it('defaults to the public service', () => {
    expect(meshflowApiBase()).toBe('https://meshflow.pskillen.xyz/api');
  });
  it('honours the env override and strips trailing slashes', () => {
    vi.stubEnv('VITE_MESHFLOW_API_BASE_URL', 'http://localhost:8000/api/');
    expect(meshflowApiBase()).toBe('http://localhost:8000/api');
  });
});

describe('humaniseRole', () => {
  it('lower-cases and capitalises the first word', () => {
    expect(humaniseRole('ROUTER_CLIENT')).toBe('Router client');
    expect(humaniseRole('')).toBe('');
  });
});

describe('searchMeshtasticInfrastructureNear', () => {
  it('parses the synthetic fixture', async () => {
    mockJsonFetch(200, fixture);
    const result = await searchMeshtasticInfrastructureNear(QUERY);
    expect(result.truncated).toBe(false);
    expect(result.nodes.map((n) => n.nodeId)).toEqual([
      '!0000a001',
      '!0000a002',
      '!0000a003',
      '!0000a006',
    ]);
    const [first, second, third, fourth] = result.nodes;
    expect(first).toMatchObject({
      shortName: 'THR',
      longName: 'Test Hill Router',
      role: 'Router',
      location: { lat: 55.87, lon: -4.24 },
      altitudeM: 190,
    });
    expect(second.shortName).toBe('');
    expect(second.altitudeM).toBeNull();
    expect(third.role).toBe('Router late');
    expect(fourth.role).toBe('Something new');
    expect(fourth.lastHeardAt).toBeNull();
  });

  it('reports truncation', async () => {
    mockJsonFetch(200, { results: [], meta: { truncated: true } });
    expect((await searchMeshtasticInfrastructureNear(QUERY)).truncated).toBe(true);
  });

  it('treats a non-array results as empty', async () => {
    mockJsonFetch(200, { results: 'nope' });
    expect((await searchMeshtasticInfrastructureNear(QUERY)).nodes).toEqual([]);
  });

  it('sends a simple request: credentials omitted, no headers', async () => {
    mockJsonFetch(200, fixture);
    await searchMeshtasticInfrastructureNear(QUERY);
    const fetchMock = vi.mocked(globalThis.fetch);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('omit');
    expect(init).not.toHaveProperty('headers');
  });

  it('uses the error body message on a 400', async () => {
    mockJsonFetch(400, { error: 'lat out of range' });
    const err = await searchMeshtasticInfrastructureNear(QUERY).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MeshflowError);
    expect((err as MeshflowError).message).toContain('lat out of range');
    expect((err as MeshflowError).status).toBe(400);
  });

  it('falls back to a status message for a non-JSON 500', async () => {
    mockTextFetch(500, '<html>oops</html>');
    await expect(searchMeshtasticInfrastructureNear(QUERY)).rejects.toThrow(
      'Meshflow returned 500.',
    );
  });

  it('throws on invalid JSON', async () => {
    mockTextFetch(200, 'not json');
    await expect(searchMeshtasticInfrastructureNear(QUERY)).rejects.toThrow(
      'Invalid response from Meshflow.',
    );
  });

  it('gives the network message when fetch rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    await expect(searchMeshtasticInfrastructureNear(QUERY)).rejects.toThrow(
      'Could not reach Meshflow',
    );
  });

  it('cools down after a 429', async () => {
    mockJsonFetch(429, {});
    await expect(searchMeshtasticInfrastructureNear(QUERY)).rejects.toThrow(/rate limit/);
    await expect(searchMeshtasticInfrastructureNear(QUERY)).rejects.toThrow(/rate limit/);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });

  it('serves a repeat call from the session cache', async () => {
    mockJsonFetch(200, fixture);
    await searchMeshtasticInfrastructureNear(QUERY);
    await searchMeshtasticInfrastructureNear(QUERY);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });
});
