import { useCallback, useMemo, useState } from 'react';
import type { DataTableSortState } from '../lib/dataTable/sort.ts';
import { useProjects } from '../state/useProjects.ts';
import { loadChannelListColumnSort, persistChannelListColumnSort } from './useListNameQuery.ts';

export function usePersistedChannelColumnSort(): [
  DataTableSortState | null,
  (state: DataTableSortState | null) => void,
] {
  const { activeProjectId } = useProjects();
  const scopeKey = activeProjectId ?? '';

  const storedSort = useMemo((): DataTableSortState | null => {
    if (!activeProjectId) return null;
    return loadChannelListColumnSort(activeProjectId);
  }, [activeProjectId]);

  const [trackedScopeKey, setTrackedScopeKey] = useState(scopeKey);
  const [sortOverride, setSortOverride] = useState<DataTableSortState | null | undefined>(
    undefined,
  );

  if (trackedScopeKey !== scopeKey) {
    setTrackedScopeKey(scopeKey);
    setSortOverride(undefined);
  }

  const columnSortOverride = sortOverride === undefined ? storedSort : sortOverride;

  const setColumnSort = useCallback(
    (state: DataTableSortState | null) => {
      setSortOverride(state);
      if (activeProjectId && state) {
        persistChannelListColumnSort(activeProjectId, state);
      }
    },
    [activeProjectId],
  );

  return [columnSortOverride, setColumnSort];
}
