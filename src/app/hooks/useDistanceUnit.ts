import { useCallback, useState } from 'react';
import type { DistanceUnit } from '@core/domain/fieldGeo.ts';
import { loadDistanceUnit, saveDistanceUnit } from '@integrations/preferences/index.ts';

/** Persisted km / mi preference shared by the Field tools. */
export function useDistanceUnit(): [DistanceUnit, (unit: DistanceUnit) => void] {
  const [unit, setUnitState] = useState<DistanceUnit>(() => loadDistanceUnit());
  const setUnit = useCallback((next: DistanceUnit) => {
    setUnitState(next);
    saveDistanceUnit(next);
  }, []);
  return [unit, setUnit];
}
