import { Group, Stack, Text } from '@mantine/core';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { BandPillsForFrequencies } from '../../pills/BandPill.tsx';

/** Library label column for wire preview tables — includes expansion context (e.g. talk group). */
export default function WirePreviewListNameCell({ row }: { row: WirePreviewRow }) {
  return (
    <Stack gap={2}>
      <Group gap="xs" wrap="wrap" align="center">
        <Text size="sm" fw={500}>
          {row.displayLabel}
        </Text>
        {row.entityKind === 'channel' ? (
          <BandPillsForFrequencies
            rxFrequency={row.rxFrequency ?? null}
            txFrequency={row.txFrequency ?? null}
            size="xs"
          />
        ) : null}
      </Group>
      {row.displayDetails
        ?.filter((line) => line.label !== 'Channel')
        .map((line) => (
          <Text key={line.label} size="xs" c="dimmed">
            {line.label}: {line.value}
          </Text>
        ))}
      {row.expansionNote && !row.displayDetails?.length ? (
        <Text size="xs" c="dimmed">
          {row.expansionNote}
        </Text>
      ) : null}
    </Stack>
  );
}
