import { useMemo } from 'react';
import { Text } from '@mantine/core';
import type { RxGroupList } from '@core/models/library.ts';
import EntityListDeleteAction from '../../../components/library/EntityListDeleteAction.tsx';
import { DataTable, ListPage } from '../../../components/ui/index.ts';
import type { DataTableColumn } from '../../../components/ui/DataTable.tsx';
import { filterRowsByName, useListNameQuery } from '../../../hooks/useListNameQuery.ts';
import { usePersistedEntityListSort } from '../../../hooks/usePersistedEntityListSort.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../../lib/dataTable/sort.ts';
import { formatReferenceCount, buildReferenceCountIndex, referenceCountFromIndex } from '../../../lib/listReferences.ts';
import { useLibrary } from '../../../state/useLibrary.ts';

export default function RxGroupListsListPage() {
  const { library, loading } = useLibrary();
  const { rxGroupLists } = library;
  const { nameFilter, nameFilterInput, nameFilterPending, setNameFilter } =
    useListNameQuery('rx-group-lists');
  const [sort, setSort] = usePersistedEntityListSort('rx-group-lists', {
    columnKey: DATATABLE_NAME_SORT_KEY,
    direction: 'asc',
  });
  const filtered = useMemo(
    () => filterRowsByName(rxGroupLists, nameFilter, (r) => r.name),
    [rxGroupLists, nameFilter],
  );
  const referenceIndex = useMemo(() => buildReferenceCountIndex(library), [library]);

  const columns = useMemo((): DataTableColumn<RxGroupList>[] => {
    return [
      {
        key: 'members',
        header: 'Members',
        render: (r) => r.members.length,
        sortValue: (r) => r.members.length,
      },
      {
        key: 'channels',
        header: 'Channels using',
        render: (r) =>
          formatReferenceCount(
            referenceCountFromIndex(referenceIndex, { kind: 'rxGroupList', id: r.id }),
          ),
        sortValue: (r) =>
          referenceCountFromIndex(referenceIndex, { kind: 'rxGroupList', id: r.id }),
      },
      {
        key: 'actions',
        header: '',
        hideable: false,
        render: (r) => <EntityListDeleteAction kind="rxGroupList" entityId={r.id} label={r.name} />,
      },
    ];
  }, [referenceIndex]);

  if (loading) {
    return (
      <ListPage title="RX group lists">
        <Text>Loading library…</Text>
      </ListPage>
    );
  }

  return (
    <ListPage title="RX group lists">
      <DataTable
        variant="list"
        rows={filtered}
        totalRowCount={rxGroupLists.length}
        search={nameFilterInput}
        searchPending={nameFilterPending}
        onSearchChange={setNameFilter}
        searchPlaceholder="Filter name…"
        sort={sort}
        onSortChange={setSort}
        rowKey={(r) => r.id}
        nameColumn={{
          getName: (r) => r.name,
          getPath: (r) => `/library/rx-group-lists/${r.id}`,
        }}
        columns={columns}
      />
    </ListPage>
  );
}
