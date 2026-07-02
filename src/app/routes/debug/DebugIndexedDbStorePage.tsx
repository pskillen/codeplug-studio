import { Anchor, Code, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DataTable from '@app/components/ui/DataTable.tsx';
import { Page, PageHeader } from '@app/components/ui/index.ts';
import { DATATABLE_NAME_SORT_KEY } from '@app/lib/dataTable/sort.ts';
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
      <DataTable<IndexedDbRowSummary>
        rows={filteredRows}
        totalRowCount={tableRows.length}
        rowKey={(row) => `${row.projectId}:${row.id}`}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={
          isChannelsStore
            ? 'Filter name, callsign, project id, or entity id…'
            : 'Filter name, project id, or entity id…'
        }
        defaultSort={{ columnKey: DATATABLE_NAME_SORT_KEY, direction: 'asc' }}
        callsignColumn={
          isChannelsStore
            ? {
                getName: (row) => row.callsign || '—',
                getPath: rowViewerPath,
                sortValue: (row) => row.callsign || '',
              }
            : undefined
        }
        nameColumn={{
          header: 'Name',
          getName: (row) => row.name,
          getPath: rowViewerPath,
          sortValue: (row) => row.name,
        }}
        columns={[
          {
            key: 'projectId',
            header: 'Project id',
            render: (row) => <Code>{row.projectId}</Code>,
            sortValue: (row) => row.projectId,
          },
          {
            key: 'id',
            header: 'Entity id',
            render: (row) => <Code>{row.id}</Code>,
            sortValue: (row) => row.id,
          },
        ]}
        caption={
          <Text size="sm" c="dimmed">
            Select a name{isChannelsStore ? ' or callsign' : ''} to open the JSON tree viewer for
            that row.
          </Text>
        }
      />
    </Page>
  );
}
