import { useMemo } from 'react';
import { Text } from '@mantine/core';
import type { ScanList } from '@core/models/library.ts';
import EntityListDeleteAction from '../../../components/library/EntityListDeleteAction.tsx';
import { DataTable, ListPage } from '../../../components/ui/index.ts';
import type { DataTableColumn } from '../../../components/ui/DataTable.tsx';
import { filterRowsByName, useListNameQuery } from '../../../hooks/useListNameQuery.ts';
import { usePersistedEntityListSort } from '../../../hooks/usePersistedEntityListSort.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../../lib/dataTable/sort.ts';
import { useLibrary } from '../../../state/useLibrary.ts';

export default function ScanListsListPage() {
  const { library, loading } = useLibrary();
  const { scanLists } = library;
  const { nameFilter, nameFilterInput, nameFilterPending, setNameFilter } =
    useListNameQuery('scan-lists');
  const [sort, setSort] = usePersistedEntityListSort('scan-lists', {
    columnKey: DATATABLE_NAME_SORT_KEY,
    direction: 'asc',
  });
  const filtered = useMemo(
    () => filterRowsByName(scanLists, nameFilter, (r) => r.name),
    [scanLists, nameFilter],
  );

  const columns = useMemo((): DataTableColumn<ScanList>[] => {
    return [
      {
        key: 'members',
        header: 'Channel members',
        render: (r) => r.memberChannelIds.length,
        sortValue: (r) => r.memberChannelIds.length,
      },
      {
        key: 'actions',
        header: '',
        hideable: false,
        render: (r) => <EntityListDeleteAction kind="scanList" entityId={r.id} label={r.name} />,
      },
    ];
  }, []);

  if (loading) {
    return (
      <ListPage title="Scan lists">
        <Text>Loading library…</Text>
      </ListPage>
    );
  }

  return (
    <ListPage title="Scan lists">
      <DataTable
        variant="list"
        rows={filtered}
        totalRowCount={scanLists.length}
        search={nameFilterInput}
        searchPending={nameFilterPending}
        onSearchChange={setNameFilter}
        searchPlaceholder="Filter name…"
        sort={sort}
        onSortChange={setSort}
        rowKey={(r) => r.id}
        nameColumn={{
          getName: (r) => r.name,
          getPath: (r) => `/library/scan-lists/${r.id}`,
        }}
        columns={columns}
      />
    </ListPage>
  );
}
