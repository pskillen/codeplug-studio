import { useCallback, useState } from 'react';
import type { MaidenheadGridMode } from '@core/domain/maidenheadGrid.ts';
import {
  loadMaidenheadGridMode,
  loadMapboxToken,
  saveMaidenheadGridMode,
  saveMapboxToken,
} from '@integrations/preferences/index.ts';
import { useStoredCredential } from './useStoredCredential.ts';

export function useMapSettings() {
  const credential = useStoredCredential(loadMapboxToken, saveMapboxToken);
  const [maidenheadGrid, setMaidenheadGridState] = useState<MaidenheadGridMode>(() =>
    loadMaidenheadGridMode(),
  );

  const setMaidenheadGrid = useCallback((mode: MaidenheadGridMode) => {
    setMaidenheadGridState(mode);
    saveMaidenheadGridMode(mode);
  }, []);

  return {
    /** Saved token — what geocode features use. */
    mapboxToken: credential.savedValue,
    /** Settings input draft. */
    mapboxTokenDraft: credential.value,
    setMapboxToken: credential.setValue,
    saveToken: credential.save,
    clearToken: credential.clear,
    isMapboxTokenDirty: credential.isDirty,
    maidenheadGrid,
    setMaidenheadGrid,
  };
}
