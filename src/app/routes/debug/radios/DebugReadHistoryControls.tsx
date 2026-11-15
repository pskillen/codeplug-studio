import { Button, Group, Select, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import ConfirmModal from '@app/components/v2/ConfirmModal.tsx';
import DesignSystemV2Provider from '@app/components/v2/DesignSystemV2Provider.tsx';
import { downloadZip } from '@integrations/download/browserDownload.ts';
import { backupLabelSummary } from '@app/components/builds/BackupLabelFields.tsx';
import type { RadioDebugDescriptor } from './descriptors.ts';
import { useDebugReadHistory, type DebugReadHistoryStore } from './debugReadHistory.ts';
import { buildDebugReadHistoryZip } from './debugReadHistoryArchive.ts';

export function DebugReadHistoryControls({
  descriptor,
  store,
  onClear,
}: {
  descriptor: Pick<RadioDebugDescriptor, 'slug' | 'archiveModelId'>;
  store: DebugReadHistoryStore;
  onClear?: () => void;
}) {
  const { entries, selectedId, undownloaded } = useDebugReadHistory(store);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();
  if (!entries.length) return null;
  const download = async () => {
    const captured = entries.slice();
    try {
      const result = await downloadZip(
        buildDebugReadHistoryZip(descriptor, captured),
        `${descriptor.slug}-reads.zip`,
      );
      if (result.status === 'failed') throw new Error('Download failed.');
      store.markDownloaded(captured.map((entry) => entry.id));
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    }
  };
  return (
    <Stack>
      <Select
        label="Selected read"
        value={selectedId}
        onChange={(id) => {
          if (id) store.select(id);
        }}
        data={entries.map((entry) => ({
          value: entry.id,
          label: [
            entry.label,
            new Date(entry.readAt).toLocaleString(),
            backupLabelSummary(entry.archive.manifest),
          ]
            .filter(Boolean)
            .join(' · '),
        }))}
      />
      <Text size="sm">
        {undownloaded ? `${undownloaded} reads not downloaded` : 'All reads downloaded'}
      </Text>
      <Group>
        <Button onClick={download}>Download all reads</Button>
        <Button variant="default" onClick={() => setConfirm(true)}>
          Clear history
        </Button>
      </Group>
      {error && (
        <Text c="red" role="alert">
          {error}
        </Text>
      )}
      <DesignSystemV2Provider>
        <ConfirmModal
          open={confirm}
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            store.clear();
            onClear?.();
            setConfirm(false);
          }}
          title="Clear read history?"
          cancelLabel="Cancel"
          confirmLabel="Clear"
          tone="default"
        >
          All reads in this history will be removed from this tab.
        </ConfirmModal>
      </DesignSystemV2Provider>
    </Stack>
  );
}
