import { useCallback, useState } from 'react';
import type { MaidenheadGridMode } from '@core/domain/maidenheadGrid.ts';
import {
  loadMaidenheadGridMode,
  loadMapboxToken,
  saveMaidenheadGridMode,
  saveMapboxToken,
} from '@integrations/preferences/index.ts';

export function useMapSettings() {
  const [mapboxToken, setMapboxTokenState] = useState(() => loadMapboxToken());
  const [maidenheadGrid, setMaidenheadGridState] = useState<MaidenheadGridMode>(() =>
    loadMaidenheadGridMode(),
  );

  const setMapboxToken = useCallback((token: string) => {
    setMapboxTokenState(token);
  }, []);

  const saveToken = useCallback(() => {
    saveMapboxToken(mapboxToken);
  }, [mapboxToken]);

  const clearToken = useCallback(() => {
    saveMapboxToken('');
    setMapboxTokenState('');
  }, []);

  const setMaidenheadGrid = useCallback((mode: MaidenheadGridMode) => {
    setMaidenheadGridState(mode);
    saveMaidenheadGridMode(mode);
  }, []);

  return {
    mapboxToken,
    setMapboxToken,
    saveToken,
    clearToken,
    maidenheadGrid,
    setMaidenheadGrid,
  };
}
