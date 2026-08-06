import { useMemo } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import type { ScanList } from '@core/models/library.ts';
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

export default function ScanListsListPage() {
  const navigate = useNavigate();
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
  const referenceIndex = useMemo(() => buildReferenceCountIndex(library), [library]);

  const columns = useMemo((): DataTableColumn<ScanList>[] => {
    return [
      createNameColumn<ScanList>({
        getName: (r) => r.name,
        getPath: (r) => `/library/scan-lists/${r.id}`,
      }),
      {
        key: 'members',
        header: 'Members',
        render: (r) => r.memberChannelIds.length,
        sortValue: (r) => r.memberChannelIds.length,
      },
      {
        key: 'channels',
        header: 'Channels using',
        render: (r) =>
          formatReferenceCount(
            referenceCountFromIndex(referenceIndex, { kind: 'scanList', id: r.id }),
          ),
        sortValue: (r) => referenceCountFromIndex(referenceIndex, { kind: 'scanList', id: r.id }),
      },
      {
        key: 'actions',
        header: '',
        hideable: false,
        width: '40px',
        render: (r) => <EntityListRowDeleteAction kind="scanList" entityId={r.id} label={r.name} />,
      },
    ];
  }, [referenceIndex]);

  const listActions = (
    <Button
      variant="primary"
      leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
      onClick={() => navigate('/library/scan-lists/new')}
    >
      New scan list
    </Button>
  );

  if (loading) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.page}>
          <LibraryInventoryHeader title="Scan lists" subtitle="Loading library…" />
        </div>
      </DesignSystemV2Provider>
    );
  }

  const countLabel =
    scanLists.length === 1
      ? '1 scan list in this project'
      : `${scanLists.length} scan lists in this project`;

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <LibraryInventoryHeader title="Scan lists" subtitle={countLabel} actions={listActions} />

        <DataTable
          columns={columns}
          rows={filtered}
          getRowId={(r) => r.id}
          totalRowCount={scanLists.length}
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
          emptyMessage="No scan lists in this project yet. Scan lists group channels for scan-capable builds."
          filteredEmptyMessage={
            nameFilter.trim()
              ? `No scan lists match “${nameFilter.trim()}”.`
              : 'No scan lists match your filter.'
          }
          onRowActivate={(r) => navigate(`/library/scan-lists/${r.id}`)}
        />
      </div>
    </DesignSystemV2Provider>
  );
}
