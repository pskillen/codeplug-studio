import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { DataTableColumn, DataTableSortState as V2Sort } from '../components/v2/DataTable.tsx';
import type { DataTableSortState as V1Sort } from './dataTable/sort.ts';
import { DATATABLE_NAME_SORT_KEY } from './dataTable/sort.ts';
import { loadStringArray, saveStringArray } from '@integrations/listPrefs/columnVisibility.ts';
import { useCallback, useMemo, useState } from 'react';

export function v1SortToV2(sort: V1Sort): V2Sort {
  return { key: sort.columnKey, direction: sort.direction };
}

export function v2SortToV1(sort: V2Sort | null): V1Sort | null {
  if (!sort) return null;
  return { columnKey: sort.key, direction: sort.direction };
}

export interface NameColumnOptions<T> {
  getName: (row: T) => string;
  getPath: (row: T) => string;
  header?: ReactNode;
  sortValue?: (row: T) => string | number | null;
  hideOnMobile?: boolean;
  render?: (row: T) => ReactNode;
}

export function createNameColumn<T>(options: NameColumnOptions<T>): DataTableColumn<T> {
  const { getName, getPath, header = 'Name', sortValue, hideOnMobile, render } = options;
  return {
    key: DATATABLE_NAME_SORT_KEY,
    header,
    sortable: true,
    sortValue: sortValue ?? ((row) => getName(row)),
    hideOnMobile,
    render: (row) => {
      if (render) return render(row);
      const name = getName(row);
      return (
        <Link to={getPath(row)} className="libraryListNameLink">
          {name}
        </Link>
      );
    },
  };
}

export function usePersistedColumnVisibility(
  storageKey: string | undefined,
  hideableColumns: { key: string; defaultVisible?: boolean }[],
  load?: () => string[],
): [string[], (keys: string[]) => void] {
  const validKeys = useMemo(
    () => new Set(hideableColumns.map((col) => col.key)),
    [hideableColumns],
  );
  const defaultKeys = useMemo(
    () => hideableColumns.filter((col) => col.defaultVisible !== false).map((col) => col.key),
    [hideableColumns],
  );

  const storedKeys = useMemo(() => {
    if (load) return load().filter((key) => validKeys.has(key));
    if (!storageKey) return defaultKeys;
    return loadStringArray(storageKey, validKeys, defaultKeys);
  }, [defaultKeys, load, storageKey, validKeys]);

  const [override, setOverride] = useState<string[] | null>(null);
  const visibleKeys = override ?? storedKeys;

  const setVisibleKeys = useCallback(
    (keys: string[]) => {
      const filtered = keys.filter((key) => validKeys.has(key));
      setOverride(filtered);
      if (storageKey) saveStringArray(storageKey, filtered);
    },
    [storageKey, validKeys],
  );

  return [visibleKeys, setVisibleKeys];
}
