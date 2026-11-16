import { ActionIcon, Alert, Button, FileButton, Group, Select, Stack } from '@mantine/core';
import { IconArrowsExchange } from '@tabler/icons-react';
import { backupLabelSummary } from '@app/lib/backupLabelSummary.ts';
import { useDebugReadHistory, type DebugReadHistoryStore } from './debugReadHistory.ts';

/**
 * A and B pickers for the Compare tab, from the read history, with a swap button. Which two reads
 * are shown lives in the history store (`comparePair`), so it survives new reads and navigation.
 */
export function ComparePicker({
  store,
  onOpenArchive,
}: {
  store: DebugReadHistoryStore;
  /** Opens a file into the history (opened archives join it, as everywhere on the page). */
  onOpenArchive?: (file: File | null) => void;
}) {
  const { entries, comparePair } = useDebugReadHistory(store);
  const data = entries.map((entry) => ({
    value: entry.id,
    label: [
      entry.label,
      new Date(entry.readAt).toLocaleString(),
      backupLabelSummary(entry.archive.manifest),
    ]
      .filter(Boolean)
      .join(' · '),
  }));
  const open = onOpenArchive && (
    <FileButton onChange={onOpenArchive} accept=".zip,application/zip">
      {(props) => (
        <Button variant="default" {...props}>
          Open archive
        </Button>
      )}
    </FileButton>
  );
  if (entries.length < 2)
    return (
      <Stack>
        <Alert title="Two reads needed">Read or open a second capture to compare.</Alert>
        {open}
      </Stack>
    );
  return (
    <Stack>
      <Group align="flex-end" wrap="wrap">
        <Select
          label="Compare A"
          allowDeselect={false}
          value={comparePair.a}
          onChange={(id) => id && store.setComparePair({ a: id })}
          data={data}
        />
        <ActionIcon
          variant="default"
          size="lg"
          aria-label="Swap A and B"
          title="Swap A and B"
          onClick={() => store.swapComparePair()}
        >
          <IconArrowsExchange size={18} />
        </ActionIcon>
        <Select
          label="Compare B"
          allowDeselect={false}
          value={comparePair.b}
          onChange={(id) => id && store.setComparePair({ b: id })}
          data={data}
        />
        {open}
      </Group>
      {comparePair.a === comparePair.b && (
        <Alert color="blue" title="Same read on both sides">
          A and B are the same read, so there is nothing to compare. Pick two different reads.
        </Alert>
      )}
    </Stack>
  );
}
