import { useMemo } from 'react';
import { Text } from '@mantine/core';
import type { AprsConfiguration } from '@core/models/aprs.ts';
import EntityListDeleteAction from '../../../components/library/EntityListDeleteAction.tsx';
import { DataTable, ListPage } from '../../../components/ui/index.ts';
import type { DataTableColumn } from '../../../components/ui/DataTable.tsx';
import { filterRowsByName, useListNameQuery } from '../../../hooks/useListNameQuery.ts';
import { usePersistedEntityListSort } from '../../../hooks/usePersistedEntityListSort.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../../lib/dataTable/sort.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
import { describeEntity } from '../registry.ts';

export default function AprsConfigurationsListPage() {
  const { library, loading } = useLibrary();
  const { aprsConfigurations } = library;
  const { nameFilter, nameFilterInput, nameFilterPending, setNameFilter } =
    useListNameQuery('aprs-configurations');
  const [sort, setSort] = usePersistedEntityListSort('aprs-configurations', {
    columnKey: DATATABLE_NAME_SORT_KEY,
    direction: 'asc',
  });
  const filtered = useMemo(
    () => filterRowsByName(aprsConfigurations, nameFilter, (r) => r.name),
    [aprsConfigurations, nameFilter],
  );

  const columns = useMemo((): DataTableColumn<AprsConfiguration>[] => {
    return [
      {
        key: 'summary',
        header: 'Details',
        render: (r) => describeEntity(library, 'aprsConfiguration', r.id),
        sortValue: (r) => describeEntity(library, 'aprsConfiguration', r.id),
      },
      {
        key: 'actions',
        header: '',
        hideable: false,
        render: (r) => (
          <EntityListDeleteAction kind="aprsConfiguration" entityId={r.id} label={r.name} />
        ),
      },
    ];
  }, [library]);

  if (loading) {
    return (
      <ListPage title="APRS configurations">
        <Text>Loading library…</Text>
      </ListPage>
    );
  }

  return (
    <ListPage title="APRS configurations">
      <DataTable
        variant="list"
        rows={filtered}
        totalRowCount={aprsConfigurations.length}
        search={nameFilterInput}
        searchPending={nameFilterPending}
        onSearchChange={setNameFilter}
        searchPlaceholder="Filter name…"
        sort={sort}
        onSortChange={setSort}
        rowKey={(r) => r.id}
        nameColumn={{
          getName: (r) => r.name,
          getPath: (r) => `/library/aprs-configurations/${r.id}`,
        }}
        columns={columns}
      />
    </ListPage>
  );
}
