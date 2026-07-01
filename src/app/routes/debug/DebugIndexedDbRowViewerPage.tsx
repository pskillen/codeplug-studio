import { Alert, Anchor, Button, Code, Group, Stack, Text } from '@mantine/core';
import { dump as dumpYaml } from 'js-yaml';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import JsonTreeViewer from '@app/components/JsonTreeViewer/JsonTreeViewer.tsx';
import { Page, PageHeader } from '@app/components/ui/index.ts';
import {
  decodeIndexedDbParam,
  getStoreRow,
  indexedDbStorePath,
  isKnownStoreName,
} from '@integrations/debug/index.ts';

export default function DebugIndexedDbRowViewerPage() {
  const { storeName: storeNameParam, projectId: projectIdParam, id: idParam } = useParams<{
    storeName: string;
    projectId: string;
    id: string;
  }>();
  const storeName = storeNameParam ? decodeIndexedDbParam(storeNameParam) : '';
  const projectId = projectIdParam ? decodeIndexedDbParam(projectIdParam) : '';
  const id = idParam ? decodeIndexedDbParam(idParam) : '';
  const [row, setRow] = useState<unknown | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeName || !projectId || !id || !isKnownStoreName(storeName)) {
      setError('Invalid row reference');
      setRow(null);
      setMissing(false);
      return;
    }
    let cancelled = false;
    void getStoreRow(storeName, projectId, id)
      .then((loaded) => {
        if (cancelled) return;
        setRow(loaded);
        setMissing(loaded == null);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to read row');
          setRow(null);
          setMissing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storeName, projectId, id]);

  const title = useMemo(() => {
    if (row && typeof row === 'object' && 'name' in row && typeof row.name === 'string') {
      return row.name;
    }
    return id || 'IndexedDB row';
  }, [row, id]);

  const copyJson = async () => {
    if (row == null) return;
    await navigator.clipboard.writeText(JSON.stringify(row, null, 2));
  };

  const copyYaml = async () => {
    if (row == null) return;
    const text = dumpYaml(row, { lineWidth: 120 });
    await navigator.clipboard.writeText(text);
  };

  return (
    <Page>
      <PageHeader title={title} description="Storage row as JSON (read-only)." />
      <Stack gap="md">
        <Text size="sm">
          <Anchor component={Link} to={indexedDbStorePath(storeName)}>
            ← {storeName}
          </Anchor>
        </Text>
        <Text size="sm" c="dimmed">
          Store: <Code>{storeName}</Code> · Project: <Code>{projectId}</Code> · Id:{' '}
          <Code>{id}</Code>
        </Text>

        {error ? (
          <Alert color="red" title="Read error">
            {error}
          </Alert>
        ) : null}

        {missing ? (
          <Alert color="gray" title="Not found">
            No row exists for this key in IndexedDB.
          </Alert>
        ) : null}

        {row != null && !missing && error == null ? (
          <>
            <Alert color="blue" title="Storage rows as YAML">
              Copy as YAML dumps the persisted JSON row for debugging. This is not the native YAML
              interchange format.
            </Alert>
            <Group>
              <Button variant="default" onClick={() => void copyJson()}>
                Copy JSON
              </Button>
              <Button variant="default" onClick={() => void copyYaml()}>
                Copy YAML
              </Button>
            </Group>
            <JsonTreeViewer value={row} />
          </>
        ) : null}
      </Stack>
    </Page>
  );
}
