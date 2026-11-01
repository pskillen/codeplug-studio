import { useEffect, useMemo, useState } from 'react';
import { coveringLocatorSquares } from '@core/domain/fieldGeo.ts';
import type { GeoPoint } from '@core/models/libraryTypes.ts';
import { searchUkRepeatersByLocator, type RepeaterListing } from '@integrations/repeaters/index.ts';

export interface UkRepeatersNear {
  listings: RepeaterListing[];
  loading: boolean;
  error: string | null;
}

/**
 * ukrepeater.net listings around a point: one locator-square request per 4-character square the
 * radius touches (responses are cached for the session by the directory client). Radius filtering
 * and ranking happen in the caller.
 */
export function useUkRepeatersNear(
  point: GeoPoint | null,
  radiusM: number,
  enabled: boolean,
): UkRepeatersNear {
  const squaresKey = useMemo(
    () => (point && enabled ? coveringLocatorSquares(point, radiusM).join(',') : ''),
    [point, radiusM, enabled],
  );
  const [result, setResult] = useState<{
    key: string;
    listings: RepeaterListing[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!squaresKey) return;
    let cancelled = false;
    const squares = squaresKey.split(',');
    void Promise.allSettled(squares.map((sq) => searchUkRepeatersByLocator(sq))).then((results) => {
      if (cancelled) return;
      const byId = new Map<string, RepeaterListing>();
      let failed = 0;
      let firstError: string | null = null;
      for (const r of results) {
        if (r.status === 'fulfilled') {
          for (const l of r.value) byId.set(l.remoteId, l);
        } else {
          failed++;
          firstError ??= r.reason instanceof Error ? r.reason.message : 'Directory request failed';
        }
      }
      setResult({
        key: squaresKey,
        listings: [...byId.values()],
        error:
          failed === results.length
            ? firstError
            : failed > 0
              ? `${failed} of ${results.length} areas could not be loaded; results may be incomplete.`
              : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [squaresKey]);

  const current = result && result.key === squaresKey ? result : null;
  return {
    listings: current?.listings ?? EMPTY,
    loading: squaresKey !== '' && current == null,
    error: current?.error ?? null,
  };
}

const EMPTY: RepeaterListing[] = [];
