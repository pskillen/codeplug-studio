import { useCallback, useState } from 'react';
import { loadMapboxToken, saveMapboxToken } from '@integrations/preferences/index.ts';

export function useMapSettings() {
  const [mapboxToken, setMapboxTokenState] = useState(() => loadMapboxToken());

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

  return {
    mapboxToken,
    setMapboxToken,
    saveToken,
    clearToken,
  };
}
