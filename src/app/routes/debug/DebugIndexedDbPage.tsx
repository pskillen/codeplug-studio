import { Anchor, Badge, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '@app/components/ui/DataTable.tsx';
import { Page, PageHeader } from '@app/components/ui/index.ts';
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
      <DataTable<StoreSummary>
        rows={rows}
        rowKey={(row) => row.storeName}
        nameColumn={{
          header: 'Store',
          getName: (row) => row.storeName,
          getPath: (row) => indexedDbStorePath(row.storeName),
        }}
        columns={[
          {
            key: 'total',
            header: 'Rows',
            render: (row) => row.totalRows,
          },
          {
            key: 'projects',
            header: 'Projects',
            render: (row) => (
              <Badge variant="light" color={row.byProject.length > 0 ? 'blue' : 'gray'}>
                {row.byProject.length}
              </Badge>
            ),
          },
          {
            key: 'detail',
            header: 'By project',
            render: (row) =>
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
        ]}
        caption={
          <Text size="sm" c="dimmed">
            Select a store to inspect rows. Values are shown as stored JSON — not native YAML
            interchange.
          </Text>
        }
      />
      <Text size="sm" mt="md">
        <Anchor component={Link} to="/debug">
          ← Debug overview
        </Anchor>
      </Text>
    </Page>
  );
}
