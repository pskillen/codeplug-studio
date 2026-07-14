import { useCallback, useState } from 'react';
import {
  DEFAULT_RADIOID_CONTACT_NAME_MODE,
  isRadioidContactNameMode,
  type RadioidContactNameMode,
} from '@integrations/radioid/index.ts';

export const RADIOID_CONTACT_NAME_MODE_STORAGE_KEY =
  'mm9pdy-codeplug-studio.radioid.contactNameMode';

function loadRadioidContactNameMode(): RadioidContactNameMode {
  try {
    const stored = localStorage.getItem(RADIOID_CONTACT_NAME_MODE_STORAGE_KEY);
    if (stored && isRadioidContactNameMode(stored)) return stored;
  } catch {
    // ignore
  }
  return DEFAULT_RADIOID_CONTACT_NAME_MODE;
}

export function useRadioidContactNameMode() {
  const [nameMode, setNameModeState] = useState<RadioidContactNameMode>(loadRadioidContactNameMode);

  const setNameMode = useCallback((mode: RadioidContactNameMode) => {
    setNameModeState(mode);
    try {
      localStorage.setItem(RADIOID_CONTACT_NAME_MODE_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  return { nameMode, setNameMode };
}
