import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { SatelliteEnrichment } from '@core/models/satelliteEnrichment.ts';
import {
  fetchSatnogsEnrichmentForNoradIds,
  type FetchSatnogsEnrichmentResult,
} from '@integrations/satellites/satnogsClient.ts';
import {
  mergeSatelliteEnrichmentSet,
  type MergeSatelliteEnrichmentResult,
} from '@integrations/satellites/mergeSatelliteEnrichment.ts';

export interface RefreshSatnogsEnrichmentResult extends FetchSatnogsEnrichmentResult {
  merge: MergeSatelliteEnrichmentResult;
}

interface SatelliteEnrichmentContextValue {
  enrichment: SatelliteEnrichment[];
  getEnrichmentForNoradId: (noradId: number) => SatelliteEnrichment | null;
  refreshEnrichmentForNoradIds: (
    noradIds: number[],
    options?: { refresh?: boolean },
  ) => Promise<RefreshSatnogsEnrichmentResult>;
  clearEnrichment: () => void;
}

const SatelliteEnrichmentContext = createContext<SatelliteEnrichmentContextValue | null>(null);

export function SatelliteEnrichmentProvider({ children }: { children: ReactNode }) {
  const [enrichment, setEnrichment] = useState<SatelliteEnrichment[]>([]);

  const getEnrichmentForNoradId = useCallback(
    (noradId: number) => enrichment.find((row) => row.noradId === noradId) ?? null,
    [enrichment],
  );

  const refreshEnrichmentForNoradIds = useCallback(
    async (
      noradIds: number[],
      options?: { refresh?: boolean },
    ): Promise<RefreshSatnogsEnrichmentResult> => {
      const result = await fetchSatnogsEnrichmentForNoradIds(noradIds, options);
      let merge!: MergeSatelliteEnrichmentResult;
      setEnrichment((current) => {
        merge = mergeSatelliteEnrichmentSet(current, result.entries);
        return merge.rows;
      });
      return { ...result, merge };
    },
    [],
  );

  const clearEnrichment = useCallback(() => {
    setEnrichment([]);
  }, []);

  const value = useMemo(
    () => ({
      enrichment,
      getEnrichmentForNoradId,
      refreshEnrichmentForNoradIds,
      clearEnrichment,
    }),
    [enrichment, getEnrichmentForNoradId, refreshEnrichmentForNoradIds, clearEnrichment],
  );

  return (
    <SatelliteEnrichmentContext.Provider value={value}>
      {children}
    </SatelliteEnrichmentContext.Provider>
  );
}

export function useSatelliteEnrichment(): SatelliteEnrichmentContextValue {
  const ctx = useContext(SatelliteEnrichmentContext);
  if (!ctx) {
    throw new Error('useSatelliteEnrichment must be used within SatelliteEnrichmentProvider');
  }
  return ctx;
}
