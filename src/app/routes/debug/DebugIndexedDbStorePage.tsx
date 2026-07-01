import { Anchor, Code, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DataTable from '@app/components/ui/DataTable.tsx';
import { Page, PageHeader } from '@app/components/ui/index.ts';
import {
  decodeIndexedDbParam,
  indexedDbRowViewerPath,
  isKnownStoreName,
  listStoreRows,
} from '@integrations/debug/index.ts';

interface IndexedDbRowSummary {
  projectId: string;
  id: string;
  name: string;
}

function summarizeRow(row: unknown): IndexedDbRowSummary | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as { projectId?: unknown; id?: unknown; name?: unknown };
  if (typeof record.projectId !== 'string' || typeof record.id !== 'string') return null;
  const name = typeof record.name === 'string' ? record.name : record.id;
  return { projectId: record.projectId, id: record.id, name };
}

export default function DebugIndexedDbStorePage() {
  const { storeName: storeNameParam } = useParams<{ storeName: string }>();
  const storeName = storeNameParam ? decodeIndexedDbParam(storeNameParam) : '';
  const [rows, setRows] = useState<IndexedDbRowSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeName || !isKnownStoreName(storeName)) {
      setError('Unknown object store');
      setRows([]);
      return;
    }
    let cancelled = false;
    void listStoreRows(storeName)
      .then((loaded) => {
        if (cancelled) return;
        setRows(
          loaded
            .map((row) => summarizeRow(row))
            .filter((row): row is IndexedDbRowSummary => row != null),
        );
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to read store rows');
          setRows([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storeName]);

  const tableRows = useMemo(() => rows, [rows]);

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
      {error ? (
        <Text c="red" size="sm" mb="md">
          {error}
        </Text>
      ) : null}
      <DataTable<IndexedDbRowSummary>
        rows={tableRows}
        rowKey={(row) => `${row.projectId}:${row.id}`}
        nameColumn={{
          header: 'Name',
          getName: (row) => row.name,
          getPath: (row) => indexedDbRowViewerPath(storeName, row.projectId, row.id),
        }}
        columns={[
          {
            key: 'projectId',
            header: 'Project id',
            render: (row) => <Code>{row.projectId}</Code>,
          },
          {
            key: 'id',
            header: 'Entity id',
            render: (row) => <Code>{row.id}</Code>,
          },
        ]}
        caption={
          <Text size="sm" c="dimmed">
            Select a name to open the JSON tree viewer for that row.
          </Text>
        }
      />
    </Page>
  );
}
