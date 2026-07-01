import { Alert, Anchor, Button, Code, Group, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import JsonTreeViewer from '@app/components/JsonTreeViewer/JsonTreeViewer.tsx';
import { Page, PageHeader } from '@app/components/ui/index.ts';
import {
  decodeStorageKeyParam,
  getStorageKeyDescriptor,
  readStorageEntry,
} from '@integrations/debug/index.ts';

export default function DebugLocalStorageViewerPage() {
  const { storageKey: storageKeyParam } = useParams<{ storageKey: string }>();
  const storageKey = storageKeyParam ? decodeStorageKeyParam(storageKeyParam) : '';
  const descriptor = useMemo(() => getStorageKeyDescriptor(storageKey), [storageKey]);
  const entry = useMemo(() => readStorageEntry(descriptor), [descriptor]);

  const copyJson = async () => {
    if (entry.parsed == null) return;
    const text = JSON.stringify(entry.parsed, null, 2);
    await navigator.clipboard.writeText(text);
  };

  return (
    <Page>
      <PageHeader
        title={descriptor.label}
        description="Parsed JSON from localStorage (read-only)."
      />
      <Stack gap="md">
        <Text size="sm">
          <Anchor component={Link} to="/debug/local-storage">
            ← LocalStorage
          </Anchor>
        </Text>
        <Text size="sm" c="dimmed">
          Key: <Code>{storageKey}</Code>
        </Text>

        {!entry.present ? (
          <Alert color="gray" title="Not set">
            This key has no value in localStorage.
          </Alert>
        ) : null}

        {entry.parseError ? (
          <Alert color="red" title="Invalid JSON">
            {entry.parseError}
          </Alert>
        ) : null}

        {entry.present && entry.parsed != null && entry.parseError == null ? (
          <>
            <Group>
              <Button variant="default" onClick={() => void copyJson()}>
                Copy JSON
              </Button>
            </Group>
            <JsonTreeViewer value={entry.parsed} />
          </>
        ) : null}

        {entry.present && entry.parseError && entry.raw ? <Code block>{entry.raw}</Code> : null}
      </Stack>
    </Page>
  );
}
