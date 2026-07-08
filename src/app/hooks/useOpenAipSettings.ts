import { useCallback, useState } from 'react';
import { loadOpenAipApiKey, saveOpenAipApiKey } from '@integrations/preferences/index.ts';

export function useOpenAipSettings() {
  const [openAipApiKey, setOpenAipApiKeyState] = useState(() => loadOpenAipApiKey());

  const setOpenAipApiKey = useCallback((apiKey: string) => {
    setOpenAipApiKeyState(apiKey);
  }, []);

  const saveApiKey = useCallback(() => {
    saveOpenAipApiKey(openAipApiKey);
  }, [openAipApiKey]);

  const clearApiKey = useCallback(() => {
    saveOpenAipApiKey('');
    setOpenAipApiKeyState('');
  }, []);

  return {
    openAipApiKey,
    setOpenAipApiKey,
    saveApiKey,
    clearApiKey,
    hasApiKey: openAipApiKey.trim().length > 0,
  };
}
