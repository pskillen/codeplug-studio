import { useCallback, useState } from 'react';

/**
 * Draft + saved state for a bring-your-own API key or token held in browser
 * preferences. `value` is the input draft; `savedValue` is what features read.
 */
export function useStoredCredential(load: () => string, save: (value: string) => void) {
  const [value, setValue] = useState(load);
  const [savedValue, setSavedValue] = useState(load);

  const saveValue = useCallback(() => {
    const trimmed = value.trim();
    save(trimmed);
    setValue(trimmed);
    setSavedValue(trimmed);
  }, [save, value]);

  const clearValue = useCallback(() => {
    save('');
    setValue('');
    setSavedValue('');
  }, [save]);

  return {
    value,
    setValue,
    savedValue,
    save: saveValue,
    clear: clearValue,
    hasSavedValue: savedValue.length > 0,
    isDirty: value.trim() !== savedValue,
  };
}
