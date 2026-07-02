import { Alert, Badge, Group, Stack, Text } from '@mantine/core';
import { useEffect, useRef } from 'react';
import type { FormatCatalogEntry } from '@core/import-export/types.ts';

export interface FormatCatalogPanelProps {
  entry: FormatCatalogEntry;
  highlighted?: boolean;
}

function statusBadge(status: 'shipped' | 'planned', kind: 'Import' | 'Export') {
  return (
    <Badge color={status === 'shipped' ? 'green' : 'gray'} variant="light" size="sm">
      {kind}: {status === 'shipped' ? 'Available' : 'Planned'}
    </Badge>
  );
}

/** One interchange format card — import area or planned placeholder. */
export default function FormatCatalogPanel({ entry, highlighted }: FormatCatalogPanelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlighted]);

  return (
    <Stack
      ref={ref}
      gap="sm"
      p="md"
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 'var(--mantine-radius-md)',
        outline: highlighted ? '2px solid var(--mantine-color-blue-filled)' : undefined,
      }}
    >
      <Group justify="space-between" align="flex-start">
        <div>
          <Text fw={600}>{entry.label}</Text>
          <Text size="sm" c="dimmed">
            Format id: {entry.id}
          </Text>
        </div>
        <Group gap="xs">
          {statusBadge(entry.importStatus, 'Import')}
          {statusBadge(entry.exportStatus, 'Export')}
        </Group>
      </Group>

      {entry.importStatus === 'shipped' ? (
        <Text size="sm" c="dimmed">
          Import controls for this format appear here when shipped.
        </Text>
      ) : (
        <Alert color="gray" title="Import coming soon">
          {entry.label} CPS import is planned for a follow-on release.
        </Alert>
      )}
    </Stack>
  );
}
