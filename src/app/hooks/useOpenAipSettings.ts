import { loadOpenAipApiKey, saveOpenAipApiKey } from '@integrations/preferences/index.ts';
import { useStoredCredential } from './useStoredCredential.ts';

export function useOpenAipSettings() {
  const credential = useStoredCredential(loadOpenAipApiKey, saveOpenAipApiKey);

  return {
    /** Saved key — what airport search uses. */
    openAipApiKey: credential.savedValue,
    /** Settings input draft. */
    openAipApiKeyDraft: credential.value,
    setOpenAipApiKey: credential.setValue,
    saveApiKey: credential.save,
    clearApiKey: credential.clear,
    isDirty: credential.isDirty,
    hasApiKey: credential.hasSavedValue,
  };
}
