import { Button, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import { formatCatalogEntry } from '@core/import-export/registry.ts';
import type { FormatId } from '@core/import-export/types.ts';
import ProfilePicker from './ProfilePicker.tsx';

export interface ExportBuildCpsPanelStubProps {
  build: FormatBuild;
}

/** Placeholder for per-build CPS export — download wiring ships with the export adapter. */
export default function ExportBuildCpsPanelStub({ build }: ExportBuildCpsPanelStubProps) {
  const formatEntry = formatCatalogEntry(build.formatId as FormatId);
  const [exportProfileId, setExportProfileId] = useState(build.profileId);

  return (
    <Stack gap="sm">
      <Text size="sm">
        Export this build as{' '}
        <Text span fw={600}>
          {formatEntry?.label ?? build.formatId}
        </Text>{' '}
        CPS files when the format adapter ships.
      </Text>
      <ProfilePicker
        formatId={build.formatId as FormatId}
        mode="select"
        value={exportProfileId}
        onChange={setExportProfileId}
        label="Export profile"
        description="Override wire limits for this export without changing the saved build profile"
      />
      <Button disabled variant="light">
        Export CPS (coming soon)
      </Button>
      <Text size="sm" c="dimmed">
        Per-file download and ZIP packaging will appear here. Export warnings follow in later Phase
        4 slices.
      </Text>
    </Stack>
  );
}
