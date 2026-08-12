import { Anchor, Code, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DataTable, DesignSystemV2Provider, type DataTableSortState } from '@app/components/v2/index.ts';
import { Page, PageHeader } from '@app/components/ui/index.ts';
import {
  DATATABLE_CALLSIGN_SORT_KEY,
  DATATABLE_NAME_SORT_KEY,
} from '@app/lib/dataTable/sort.ts';
import { createNameColumn } from '@app/lib/libraryListTable.tsx';
import {
  decodeIndexedDbParam,
  filterIndexedDbRowSummaries,
  indexedDbRowViewerPath,
  isKnownStoreName,
  listStoreRows,
  summarizeIndexedDbRow,
  type IndexedDbRowSummary,
} from '@integrations/debug/index.ts';

const CHANNELS_STORE = 'channels';

export default function DebugIndexedDbStorePage() {
  const { storeName: storeNameParam } = useParams<{ storeName: string }>();
  const storeName = storeNameParam ? decodeIndexedDbParam(storeNameParam) : '';
  const validationError =
    !storeName || !isKnownStoreName(storeName) ? 'Unknown object store' : null;
  const [rows, setRows] = useState<IndexedDbRowSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const displayError = validationError ?? loadError;
  const isChannelsStore = storeName === CHANNELS_STORE;
  const [sort, setSort] = useState<DataTableSortState | null>({
    key: DATATABLE_NAME_SORT_KEY,
    direction: 'asc',
  });

  useEffect(() => {
    if (validationError) return;
    let cancelled = false;
    void listStoreRows(storeName)
      .then((loaded) => {
        if (cancelled) return;
        setRows(
          loaded
            .map((row) => summarizeIndexedDbRow(row))
            .filter((row): row is IndexedDbRowSummary => row != null),
        );
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to read store rows');
          setRows([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storeName, validationError]);

  const tableRows = useMemo(() => (validationError ? [] : rows), [rows, validationError]);
  const filteredRows = useMemo(
    () => filterIndexedDbRowSummaries(tableRows, search),
    [tableRows, search],
  );

  const rowViewerPath = (row: IndexedDbRowSummary) =>
    indexedDbRowViewerPath(storeName, row.projectId, row.id);

  const columns = useMemo(() => {
    const cols = [
      createNameColumn<IndexedDbRowSummary>({
        header: 'Name',
        getName: (row) => row.name,
        getPath: rowViewerPath,
        sortValue: (row) => row.name,
      }),
      ...(isChannelsStore
        ? [
            {
              key: DATATABLE_CALLSIGN_SORT_KEY,
              header: 'Callsign',
              sortable: true,
              sortValue: (row: IndexedDbRowSummary) => row.callsign || '',
              render: (row: IndexedDbRowSummary) => row.callsign || '—',
            },
          ]
        : []),
      {
        key: 'projectId',
        header: 'Project id',
        sortable: true,
        sortValue: (row: IndexedDbRowSummary) => row.projectId,
        render: (row: IndexedDbRowSummary) => <Code>{row.projectId}</Code>,
      },
      {
        key: 'id',
        header: 'Entity id',
        sortable: true,
        sortValue: (row: IndexedDbRowSummary) => row.id,
        render: (row: IndexedDbRowSummary) => <Code>{row.id}</Code>,
      },
    ];
    return cols;
  }, [isChannelsStore, storeName]);

  return (
    <Page>
      <PageHeader
        title={storeName || 'IndexedDB store'}
        description="Rows in this object store (read-only)."
      />
      <Text size="sm" mb="md">
        <Anchor component={Link} to="/debug/indexed-db">
          ← IndexedDB
        </Anchor>
      </Text>
      {displayError ? (
        <Text c="red" size="sm" mb="md">
          {displayError}
        </Text>
      ) : null}
      <DesignSystemV2Provider>
        <DataTable<IndexedDbRowSummary>
          rows={filteredRows}
          totalRowCount={tableRows.length}
          getRowId={(row) => `${row.projectId}:${row.id}`}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: isChannelsStore
              ? 'Filter name, callsign, project id, or entity id…'
              : 'Filter name, project id, or entity id…',
          }}
          sort={sort}
          onSortChange={setSort}
          columns={columns}
          caption={
            <Text size="sm" c="dimmed">
              Select a name{isChannelsStore ? ' or callsign' : ''} to open the JSON tree viewer for
              that row.
            </Text>
          }
        />
      </DesignSystemV2Provider>
    </Page>
  );
}
