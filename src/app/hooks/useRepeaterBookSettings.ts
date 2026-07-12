import { useCallback, useState } from 'react';
import { loadRepeaterBookToken, saveRepeaterBookToken } from '@integrations/preferences/index.ts';

export function useRepeaterBookSettings() {
  const [repeaterBookToken, setRepeaterBookTokenState] = useState(() => loadRepeaterBookToken());

  const setRepeaterBookToken = useCallback((token: string) => {
    setRepeaterBookTokenState(token);
  }, []);

  const saveToken = useCallback(() => {
    saveRepeaterBookToken(repeaterBookToken);
  }, [repeaterBookToken]);

  const clearToken = useCallback(() => {
    saveRepeaterBookToken('');
    setRepeaterBookTokenState('');
  }, []);

  return {
    repeaterBookToken,
    setRepeaterBookToken,
    saveToken,
    clearToken,
    hasToken: repeaterBookToken.trim().length > 0,
  };
}
