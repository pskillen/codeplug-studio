import { useDebouncedValue } from '@mantine/hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LIST_NAME_FILTER_DEBOUNCE_MS } from '@integrations/listPrefs/index.ts';

export { LIST_NAME_FILTER_DEBOUNCE_MS };

export function useDebouncedNameFilter(
  committedFilter: string,
  commitFilter: (value: string) => void,
): {
  /** Debounced value — use for table filtering (in sync with settled input). */
  nameFilter: string;
  nameFilterInput: string;
  setNameFilter: (value: string) => void;
  nameFilterPending: boolean;
} {
  const [nameFilterInput, setNameFilterInput] = useState(committedFilter);
  const [debouncedInput] = useDebouncedValue(nameFilterInput, LIST_NAME_FILTER_DEBOUNCE_MS);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!isTypingRef.current) {
      setNameFilterInput(committedFilter);
    }
  }, [committedFilter]);

  useEffect(() => {
    if (debouncedInput !== committedFilter) {
      if (isTypingRef.current) {
        commitFilter(debouncedInput);
      }
    } else {
      isTypingRef.current = false;
    }
  }, [debouncedInput, committedFilter, commitFilter]);

  const setNameFilter = useCallback((value: string) => {
    isTypingRef.current = true;
    setNameFilterInput(value);
  }, []);

  return {
    nameFilter: debouncedInput,
    nameFilterInput,
    setNameFilter,
    nameFilterPending: nameFilterInput !== debouncedInput,
  };
}
