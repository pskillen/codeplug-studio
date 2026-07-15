import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import {
  loadChannelListPrefs,
  loadEntityListPrefs,
  mergeChannelListPrefs,
  mergeEntityListPrefs,
  type EntityListEntity,
} from '@integrations/listPrefs/index.ts';
import { hasEntityListUrlParams } from '../lib/listPrefs/urlSync.ts';
import { useProjects } from '../state/useProjects.ts';
import { useDebouncedNameFilter } from './useDebouncedNameFilter.ts';

function searchParamKeyForEntity(entity: EntityListEntity): string {
  if (entity === 'digital-contacts') return 'dq';
  if (entity === 'analog-contacts') return 'aq';
  return 'q';
}

export function useListNameQuery(entity: EntityListEntity): {
  nameFilter: string;
  nameFilterInput: string;
  nameFilterPending: boolean;
  setNameFilter: (value: string) => void;
} {
  const { activeProjectId } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const hydratedKey = useRef<string | null>(null);

  const paramKey = searchParamKeyForEntity(entity);

  useEffect(() => {
    if (!activeProjectId) return;

    const visitKey = `${entity}:${activeProjectId}:${location.search}`;
    if (hydratedKey.current === visitKey) return;

    const currentParams = new URLSearchParams(location.search);
    if (
      currentParams.has(paramKey) ||
      (paramKey === 'q' && hasEntityListUrlParams(currentParams))
    ) {
      hydratedKey.current = visitKey;
      return;
    }

    const stored = loadEntityListPrefs(entity, activeProjectId);
    if (stored?.q) {
      setSearchParams(
        (prev) => {
          const merged = new URLSearchParams(prev);
          merged.set(paramKey, stored.q!);
          return merged;
        },
        { replace: true },
      );
    }
    hydratedKey.current = visitKey;
  }, [activeProjectId, entity, location.search, paramKey, setSearchParams]);

  const committedNameFilter = searchParams.get(paramKey) ?? '';

  const commitNameFilter = useCallback(
    (value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(paramKey, value);
          else next.delete(paramKey);
          return next;
        },
        { replace: true },
      );
      if (!activeProjectId) return;
      mergeEntityListPrefs(entity, activeProjectId, { q: value });
    },
    [activeProjectId, entity, paramKey, setSearchParams],
  );

  const { nameFilter, nameFilterInput, setNameFilter, nameFilterPending } = useDebouncedNameFilter(
    committedNameFilter,
    commitNameFilter,
  );

  return { nameFilter, nameFilterInput, nameFilterPending, setNameFilter };
}

export function filterRowsByName<T>(
  rows: T[],
  nameFilter: string,
  getName: (row: T) => string,
): T[] {
  return filterRowsBySearchFields(rows, nameFilter, [getName]);
}

export function filterRowsBySearchFields<T>(
  rows: T[],
  searchFilter: string,
  getFields: ((row: T) => string)[],
): T[] {
  if (!searchFilter) return rows;
  const lower = searchFilter.toLowerCase();
  return rows.filter((row) =>
    getFields.some((getField) => getField(row).toLowerCase().includes(lower)),
  );
}

export function persistEntityListColumnSort(
  entity: EntityListEntity,
  projectId: string,
  columnSort: import('../lib/dataTable/sort.ts').DataTableSortState | null,
): void {
  if (!columnSort) return;
  mergeEntityListPrefs(entity, projectId, { columnSort });
}

export function loadEntityListColumnSort(
  entity: EntityListEntity,
  projectId: string,
): import('../lib/dataTable/sort.ts').DataTableSortState | null {
  return loadEntityListPrefs(entity, projectId)?.columnSort ?? null;
}

export function persistChannelListColumnSort(
  projectId: string,
  columnSort: import('../lib/dataTable/sort.ts').DataTableSortState | null,
): void {
  mergeChannelListPrefs(projectId, { columnSort });
}

export function loadChannelListColumnSort(
  projectId: string,
): import('../lib/dataTable/sort.ts').DataTableSortState | null {
  const stored = loadChannelListPrefs(projectId)?.columnSort;
  return stored ?? null;
}
