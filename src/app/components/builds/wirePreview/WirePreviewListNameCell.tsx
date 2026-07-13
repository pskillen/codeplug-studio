import { Stack, Text } from '@mantine/core';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';

/** Library label column for wire preview tables — includes expansion context (e.g. talk group). */
export default function WirePreviewListNameCell({ row }: { row: WirePreviewRow }) {
  return (
    <Stack gap={2}>
      <Text size="sm" fw={500}>
        {row.displayLabel}
      </Text>
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
