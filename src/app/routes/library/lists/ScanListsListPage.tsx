import { useMemo } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import type { ScanList } from '@core/models/library.ts';
import EntityListDeleteAction from '../../../components/library/EntityListDeleteAction.tsx';
import { Button, DesignSystemV2Provider } from '../../../components/v2/index.ts';
import { DataTable } from '../../../components/ui/index.ts';
import type { DataTableColumn } from '../../../components/ui/DataTable.tsx';
import { filterRowsByName, useListNameQuery } from '../../../hooks/useListNameQuery.ts';
import { usePersistedEntityListSort } from '../../../hooks/usePersistedEntityListSort.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../../lib/dataTable/sort.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
import classes from './LibraryListPage.module.css';

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
          <h1 className={classes.title}>Scan lists</h1>
          <p className={classes.description}>Loading library…</p>
        </div>
      </DesignSystemV2Provider>
    );
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <div className={classes.headerRow}>
          <div>
            <h1 className={classes.title}>Scan lists</h1>
            <p className={classes.description}>
              Named channel sequences for scan-capable builds. Open one to edit membership order.
            </p>
          </div>
          <div className={classes.toolbarActions}>{listActions}</div>
        </div>

        <DataTable
          variant="list"
          selectionChrome="v2"
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
      </div>
    </DesignSystemV2Provider>
  );
}
