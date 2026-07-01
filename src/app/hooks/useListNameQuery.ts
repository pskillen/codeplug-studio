import type { DataTableSortState } from '../lib/dataTable/sort.ts';
import { loadChannelListPrefs, mergeChannelListPrefs } from '../lib/listPrefs/storage.ts';

export function persistChannelListColumnSort(
  projectId: string,
  columnSort: DataTableSortState | null,
): void {
  mergeChannelListPrefs(projectId, { columnSort });
}

export function loadChannelListColumnSort(projectId: string): DataTableSortState | null {
  const stored = loadChannelListPrefs(projectId)?.columnSort;
  return stored ?? null;
}
