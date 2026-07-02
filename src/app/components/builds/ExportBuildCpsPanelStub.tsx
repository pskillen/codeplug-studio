import { Button, Stack, Text } from '@mantine/core';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import { traitProfileFor } from '@core/models/traits.ts';
import { formatCatalogEntry } from '@core/import-export/registry.ts';
import { formatProfileWireHint } from '@core/import-export/formatProfiles.ts';
import type { FormatId } from '@core/import-export/types.ts';

export interface ExportBuildCpsPanelStubProps {
  build: FormatBuild;
}

/** Placeholder for per-build CPS export — download wiring ships with the export adapter. */
export default function ExportBuildCpsPanelStub({ build }: ExportBuildCpsPanelStubProps) {
  const formatEntry = formatCatalogEntry(build.formatId as FormatId);
  const profileLabel = traitProfileFor(build.profileId)?.label ?? build.profileId;
  const wireHint = formatProfileWireHint(build.formatId as FormatId, build.profileId);

  return (
    <Stack gap="sm">
      <Text size="sm">
        Export this build as{' '}
        <Text span fw={600}>
          {formatEntry?.label ?? build.formatId}
        </Text>{' '}
        CPS files when the format adapter ships.
      </Text>
      <Text size="sm">
        <Text span fw={600}>
          Profile:{' '}
        </Text>
        {profileLabel}
      </Text>
      {wireHint ? (
        <Text size="sm" c="dimmed">
          {wireHint}
        </Text>
      ) : null}
      <Button disabled variant="light">
        Export CPS (coming soon)
      </Button>
      <Text size="sm" c="dimmed">
        Per-file download and ZIP packaging will appear here. Profile override and export warnings
        follow in later Phase 4 slices.
      </Text>
    </Stack>
  );
}
