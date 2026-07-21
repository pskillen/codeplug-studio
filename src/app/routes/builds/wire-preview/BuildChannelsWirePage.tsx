import { Stack, Text } from '@mantine/core';
import { buildUsesFlatMemoryList } from '@core/domain/exportOrderOrSlot.ts';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { ChannelsBulkEditAction } from '../../../components/builds/BuildEntityExportSettingsCard.tsx';
import BuildFlatMemoryChannelsPage from '../BuildFlatMemoryChannelsPage.tsx';
import BuildWirePreviewListPage from './BuildWirePreviewListPage.tsx';
import { useBuildLayout } from '../BuildLayoutContext.tsx';

function ChannelExpansionContext({ row }: { row: WirePreviewRow }) {
  if (!row.displayDetails?.length && !row.expansionNote) return null;
  return (
    <Stack gap={4}>
      <Text size="sm" fw={600}>
        Expansion context
      </Text>
      {row.displayDetails?.map((line) => (
        <Text key={line.label} size="sm" c="dimmed">
          {line.label}: {line.value}
        </Text>
      ))}
      {row.expansionNote && !row.displayDetails?.length ? (
        <Text size="sm" c="dimmed">
          {row.expansionNote}
        </Text>
      ) : null}
      <Text size="xs" c="dimmed">
        Read-only — expansion is driven by library fields and build export settings.
      </Text>
    </Stack>
  );
}

export default function BuildChannelsWirePage() {
  const { build } = useBuildLayout();

  if (buildUsesFlatMemoryList(build)) {
    return <BuildFlatMemoryChannelsPage />;
  }

  return (
    <BuildWirePreviewListPage
      title="Channels"
      entityKind="channel"
      description="Review exported channels. Click a row to edit overrides."
      showExportNameMode
      showLibraryAbbreviations
      headerActions={<ChannelsBulkEditAction buildId={build.id} />}
      modalExtraSections={(row) => <ChannelExpansionContext row={row} />}
    />
  );
}
