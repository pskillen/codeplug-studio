import { useCallback, useMemo, useState } from 'react';
import type { DataTableSortState } from '../lib/dataTable/sort.ts';
import type { EntityListEntity } from '../lib/listPrefs/types.ts';
import { useProjects } from '../state/useProjects.ts';
import { loadEntityListColumnSort, persistEntityListColumnSort } from './useListNameQuery.ts';

export function usePersistedEntityListSort(
  entity: EntityListEntity,
  defaultSort: DataTableSortState,
): [DataTableSortState, (state: DataTableSortState | null) => void] {
  const { activeProjectId } = useProjects();
  const scopeKey = `${activeProjectId ?? ''}:${entity}`;

  const storedSort = useMemo((): DataTableSortState => {
    if (!activeProjectId) return defaultSort;
    return loadEntityListColumnSort(entity, activeProjectId) ?? defaultSort;
  }, [activeProjectId, defaultSort, entity]);

  const [trackedScopeKey, setTrackedScopeKey] = useState(scopeKey);
  const [sortOverride, setSortOverride] = useState<DataTableSortState | null>(null);

  if (trackedScopeKey !== scopeKey) {
    setTrackedScopeKey(scopeKey);
    setSortOverride(null);
  }

  const sort = sortOverride ?? storedSort;

  const setSort = useCallback(
    (state: DataTableSortState | null) => {
      if (!state) return;
      setSortOverride(state);
      if (activeProjectId) {
        persistEntityListColumnSort(entity, activeProjectId, state);
      }
    },
    [activeProjectId, entity],
  );

  return [sort, setSort];
}
