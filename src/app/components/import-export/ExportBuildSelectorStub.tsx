import { Select, Stack, Text } from '@mantine/core';
import { useMemo, useState } from 'react';
import { traitProfileFor } from '@core/models/traits.ts';
import { formatProfileWireHint } from '@core/import-export/formatProfiles.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';

export default function ExportBuildSelectorStub() {
  const { builds, loading } = useFormatBuilds();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectData = useMemo(
    () =>
      builds.map((b) => ({
        value: b.id,
        label: `${b.name} (${b.formatId})`,
      })),
    [builds],
  );

  const selected = builds.find((b) => b.id === selectedId) ?? null;
  const profileLabel = selected ? (traitProfileFor(selected.profileId)?.label ?? selected.profileId) : null;
  const wireHint =
    selected != null
      ? formatProfileWireHint(selected.formatId as FormatId, selected.profileId)
      : null;

  return (
    <Stack gap="sm">
      <Select
        label="Format build"
        description="Choose a build to export. CPS download wiring ships in a follow-on release."
        placeholder={loading ? 'Loading builds…' : builds.length ? 'Select a build' : 'No builds yet'}
        data={selectData}
        value={selectedId}
        onChange={setSelectedId}
        disabled={loading || builds.length === 0}
        searchable
        clearable
      />
      {selected ? (
        <Stack gap={4}>
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
        </Stack>
      ) : null}
      <Text size="sm" c="dimmed">
        Create builds under Builds → New build, or import a project YAML that includes{' '}
        <Text span ff="monospace">
          formatBuilds[]
        </Text>
        .
      </Text>
    </Stack>
  );
}
