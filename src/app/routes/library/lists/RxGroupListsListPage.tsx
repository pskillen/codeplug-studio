import { useMemo } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import type { RxGroupList } from '@core/models/library.ts';
import EntityListRowDeleteAction from '../../../components/library/EntityListRowDeleteAction.tsx';
import LibraryInventoryHeader from '../../../components/library/LibraryInventoryHeader.tsx';
import {
  Button,
  DataTable,
  DesignSystemV2Provider,
  type DataTableColumn,
} from '../../../components/v2/index.ts';
import { filterRowsByName, useListNameQuery } from '../../../hooks/useListNameQuery.ts';
import { usePersistedEntityListSort } from '../../../hooks/usePersistedEntityListSort.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../../lib/dataTable/sort.ts';
import { createNameColumn, v1SortToV2, v2SortToV1 } from '../../../lib/libraryListTable.tsx';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import {
  formatReferenceCount,
  buildReferenceCountIndex,
  referenceCountFromIndex,
} from '../../../lib/listReferences.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
import classes from '../../../components/library/LibraryInventoryPage.module.css';

export default function RxGroupListsListPage() {
  const navigate = useNavigate();
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
      createNameColumn<RxGroupList>({
        getName: (r) => r.name,
        getPath: (r) => `/library/rx-group-lists/${r.id}`,
      }),
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
        width: '52px',
        render: (r) => (
          <EntityListRowDeleteAction kind="rxGroupList" entityId={r.id} label={r.name} />
        ),
      },
    ];
  }, [referenceIndex]);

  const listActions = (
    <Button
      variant="primary"
      leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
      onClick={() => navigate('/library/rx-group-lists/new')}
    >
      New receive group list
    </Button>
  );

  if (loading) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.page}>
          <LibraryInventoryHeader title="Receive group lists" subtitle="Loading library…" />
        </div>
      </DesignSystemV2Provider>
    );
  }

  const countLabel =
    rxGroupLists.length === 1
      ? '1 receive group list in this project'
      : `${rxGroupLists.length} receive group lists in this project`;

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <LibraryInventoryHeader
          title="Receive group lists"
          subtitle={countLabel}
          actions={listActions}
        />

        <DataTable
          columns={columns}
          rows={filtered}
          getRowId={(r) => r.id}
          totalRowCount={rxGroupLists.length}
          search={{
            value: nameFilterInput,
            onChange: setNameFilter,
            placeholder: 'Filter name…',
            pending: nameFilterPending,
          }}
          sort={v1SortToV2(sort)}
          onSortChange={(next) => {
            const v1 = v2SortToV1(next);
            if (v1) setSort(v1);
          }}
          emptyMessage="No receive group lists in this project yet."
          filteredEmptyMessage={
            nameFilter.trim()
              ? `No receive group lists match “${nameFilter.trim()}”.`
              : 'No receive group lists match your filter.'
          }
          onRowActivate={(r) => navigate(`/library/rx-group-lists/${r.id}`)}
        />
      </div>
    </DesignSystemV2Provider>
  );
}
