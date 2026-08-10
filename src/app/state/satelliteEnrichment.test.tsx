import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SatelliteTransmitterInfo } from '@core/models/satelliteEnrichment.ts';
import {
  SatelliteEnrichmentProvider,
  useSatelliteEnrichment,
} from './satelliteEnrichment.tsx';

const mockFetch = vi.fn();
vi.mock('@integrations/satellites/satnogsClient.ts', () => ({
  fetchSatnogsEnrichmentForNoradIds: (...args: unknown[]) => mockFetch(...args),
}));

function transmitter(overrides: Partial<SatelliteTransmitterInfo> = {}): SatelliteTransmitterInfo {
  return {
    uuid: 'tx-1',
    description: 'FM repeater',
    mode: 'FM',
    downlinkHz: 145_800_000,
    uplinkHz: 145_200_000,
    alive: true,
    status: 'active',
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <SatelliteEnrichmentProvider>{children}</SatelliteEnrichmentProvider>;
}

describe('useSatelliteEnrichment', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('merges fetched enrichment into session state', async () => {
    mockFetch.mockResolvedValue({
      entries: [{ noradId: 25544, transmitters: [transmitter()] }],
      failures: [],
    });

    const { result } = renderHook(() => useSatelliteEnrichment(), { wrapper });

    await act(async () => {
      await result.current.refreshEnrichmentForNoradIds([25544], { refresh: true });
    });

    expect(mockFetch).toHaveBeenCalledWith([25544], { refresh: true });
    const row = result.current.getEnrichmentForNoradId(25544);
    expect(row?.transmitters).toHaveLength(1);
    expect(row?.transmitters[0]?.description).toBe('FM repeater');
  });

  it('returns null when no enrichment exists for a NORAD id', () => {
    const { result } = renderHook(() => useSatelliteEnrichment(), { wrapper });
    expect(result.current.getEnrichmentForNoradId(99999)).toBeNull();
  });

  it('surfaces partial failures without aborting the merge', async () => {
    mockFetch.mockResolvedValue({
      entries: [{ noradId: 25544, transmitters: [transmitter()] }],
      failures: [{ noradId: 99999, message: 'SatNOGS fetch failed.' }],
    });

    const { result } = renderHook(() => useSatelliteEnrichment(), { wrapper });

    let refreshResult: Awaited<
      ReturnType<typeof result.current.refreshEnrichmentForNoradIds>
    > | null = null;
    await act(async () => {
      refreshResult = await result.current.refreshEnrichmentForNoradIds([25544, 99999]);
    });

    expect(refreshResult?.failures).toHaveLength(1);
    expect(result.current.getEnrichmentForNoradId(25544)).not.toBeNull();
  });
});
