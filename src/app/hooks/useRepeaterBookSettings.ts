import { loadRepeaterBookToken, saveRepeaterBookToken } from '@integrations/preferences/index.ts';
import { useStoredCredential } from './useStoredCredential.ts';

export function useRepeaterBookSettings() {
  const credential = useStoredCredential(loadRepeaterBookToken, saveRepeaterBookToken);

  return {
    /** Saved token — what directory search and verify use. */
    repeaterBookToken: credential.savedValue,
    /** Settings input draft. */
    repeaterBookTokenDraft: credential.value,
    setRepeaterBookToken: credential.setValue,
    saveToken: credential.save,
    clearToken: credential.clear,
    isDirty: credential.isDirty,
    hasToken: credential.hasSavedValue,
  };
}
