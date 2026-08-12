import { Anchor, Badge, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable, DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { Page, PageHeader } from '@app/components/ui/index.ts';
import { createNameColumn } from '@app/lib/libraryListTable.tsx';
import {
  indexedDbStorePath,
  listStoreSummaries,
  type StoreSummary,
} from '@integrations/debug/index.ts';

export default function DebugIndexedDbPage() {
  const [summaries, setSummaries] = useState<StoreSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listStoreSummaries()
      .then((rows) => {
        if (!cancelled) setSummaries(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to read IndexedDB');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => summaries, [summaries]);

  const columns = useMemo(
    () => [
      createNameColumn<StoreSummary>({
        header: 'Store',
        getName: (row) => row.storeName,
        getPath: (row) => indexedDbStorePath(row.storeName),
      }),
      {
        key: 'total',
        header: 'Rows',
        sortable: true,
        sortValue: (row: StoreSummary) => row.totalRows,
        render: (row: StoreSummary) => row.totalRows,
      },
      {
        key: 'projects',
        header: 'Projects',
        sortable: true,
        sortValue: (row: StoreSummary) => row.byProject.length,
        render: (row: StoreSummary) => (
          <Badge variant="light" color={row.byProject.length > 0 ? 'blue' : 'gray'}>
            {row.byProject.length}
          </Badge>
        ),
      },
      {
        key: 'detail',
        header: 'By project',
        render: (row: StoreSummary) =>
          row.byProject.length === 0 ? (
            <Text size="sm" c="dimmed">
              —
            </Text>
          ) : (
            <Text size="sm" c="dimmed">
              {row.byProject.map((entry) => `${entry.projectId} (${entry.count})`).join(', ')}
            </Text>
          ),
      },
    ],
    [],
  );

  return (
    <Page>
      <PageHeader
        title="IndexedDB"
        description="Object stores in the codeplug-studio database (read-only)."
      />
      {error ? (
        <Text c="red" size="sm" mb="md">
          {error}
        </Text>
      ) : null}
      <DesignSystemV2Provider>
        <DataTable<StoreSummary>
          rows={rows}
          getRowId={(row) => row.storeName}
          columns={columns}
          caption={
            <Text size="sm" c="dimmed">
              Select a store to inspect rows. Values are shown as stored JSON — not native YAML
              interchange.
            </Text>
          }
        />
      </DesignSystemV2Provider>
      <Text size="sm" mt="md">
        <Anchor component={Link} to="/debug">
          ← Debug overview
        </Anchor>
      </Text>
    </Page>
  );
}
