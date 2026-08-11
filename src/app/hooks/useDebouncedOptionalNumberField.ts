import { useDebouncedValue } from '@mantine/hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LIST_NAME_FILTER_DEBOUNCE_MS } from '@integrations/listPrefs/index.ts';

export type OptionalNumberInputValue = string | number | '';

function inputFromCommitted(committed: number | undefined): OptionalNumberInputValue {
  return committed ?? '';
}

export function parseOptionalNumberInput(value: OptionalNumberInputValue): number | undefined {
  if (value === '' || value == null) return undefined;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : undefined;
}

function optionalNumbersEqual(a: number | undefined, b: number | undefined): boolean {
  return a === b;
}

/**
 * Local NumberInput state with debounced persistence — same commit model as
 * {@link useDebouncedNameFilter} for library list search fields.
 */
export function useDebouncedOptionalNumberField(
  committed: number | undefined,
  commit: (value: number | undefined) => void,
  debounceMs = LIST_NAME_FILTER_DEBOUNCE_MS,
): {
  value: OptionalNumberInputValue;
  setValue: (value: OptionalNumberInputValue) => void;
  pending: boolean;
  /** Commit immediately (e.g. on blur) when the draft differs from persisted value. */
  flush: () => void;
} {
  const [input, setInput] = useState(() => inputFromCommitted(committed));
  const [debouncedInput] = useDebouncedValue(input, debounceMs);
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (!isEditingRef.current) {
      setInput(inputFromCommitted(committed));
    }
  }, [committed]);

  useEffect(() => {
    const parsed = parseOptionalNumberInput(debouncedInput);
    if (!optionalNumbersEqual(parsed, committed)) {
      if (isEditingRef.current) {
        commit(parsed);
      }
    } else {
      isEditingRef.current = false;
    }
  }, [debouncedInput, committed, commit]);

  const setValue = useCallback((value: OptionalNumberInputValue) => {
    isEditingRef.current = true;
    setInput(value === '' || value == null ? '' : value);
  }, []);

  const flush = useCallback(() => {
    const parsed = parseOptionalNumberInput(input);
    if (!optionalNumbersEqual(parsed, committed)) {
      commit(parsed);
    }
    isEditingRef.current = false;
  }, [input, committed, commit]);

  return {
    value: input,
    setValue,
    pending: input !== debouncedInput,
    flush,
  };
}
