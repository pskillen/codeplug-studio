import { useCallback, useEffect, useMemo, useState } from 'react';
import { Select, Stack, Table, Text } from '@mantine/core';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { ScanListsLayout } from '@core/models/traitLayout.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { overrideByEntityId } from '@core/domain/formatBuildOverrides.ts';
import { useBuildLayout } from '../../routes/builds/BuildLayoutContext.tsx';
import { useProjects } from '../../state/useProjects.ts';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';
import { persistence } from '../../state/persistence.ts';
import { BuildService } from '../../state/buildService.ts';
import { loadLibrarySlice } from '../../lib/loadLibrarySlice.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';

const buildService = new BuildService(persistence);

function scanListsSection(build: FormatBuild): ScanListsLayout | undefined {
  return build.layout.sections.find(
    (section): section is ScanListsLayout => section.kind === 'scanLists',
  );
}

export default function BuildChannelScanListPanel() {
  const { build } = useBuildLayout();
  const { activeProjectId } = useProjects();
  const { putBuild } = useFormatBuilds();
  const [library, setLibrary] = useState<LibrarySlice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    void loadLibrarySlice(persistence, activeProjectId).then((slice) => {
      if (!cancelled) setLibrary(slice);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, build.updatedAt]);

  const scanLists = useMemo(
    () => scanListsSection(build)?.scanLists ?? [],
    [build.layout.sections],
  );

  const scanListOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...scanLists.map((entry) => ({ value: entry.id, label: entry.name })),
    ],
    [scanLists],
  );

  const channelOverrides = useMemo(
    () => overrideByEntityId(build.channelOverrides),
    [build.channelOverrides],
  );

  const assignScanList = useCallback(
    async (channelId: string, scanListId: string | undefined) => {
      setSaving(true);
      const result = await putBuild(
        buildService.withChannelScanListId(build, channelId, scanListId),
        build.revision,
      );
      setSaving(false);
      if (!result.ok) {
        setError(
          result.reason === 'revision_conflict'
            ? 'Build changed elsewhere — reload.'
            : 'Save failed.',
        );
      } else {
        setError(null);
      }
    },
    [build, putBuild],
  );

  if (build.formatId !== 'anytone' || !library || library.channels.length === 0) {
    return null;
  }

  return (
    <Stack gap="sm">
      <Text size="sm" fw={500}>
        Scan list assignment
      </Text>
      <Text size="sm" c="dimmed">
        Maps each channel to a scan list on Channel.CSV. Create lists on the Scan lists page.
      </Text>
      {error ? (
        <Text size="sm" c="red">
          {error}
        </Text>
      ) : null}
      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Channel</Table.Th>
            <Table.Th>Scan list</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {library.channels.map((channel) => (
            <Table.Tr key={channel.id}>
              <Table.Td>
                <Text size="sm">{channelDisplayLabel(channel)}</Text>
              </Table.Td>
              <Table.Td>
                <Select
                  size="xs"
                  data={scanListOptions}
                  value={channelOverrides.get(channel.id)?.scanListId ?? ''}
                  disabled={saving || scanLists.length === 0}
                  onChange={(value) =>
                    void assignScanList(channel.id, value && value.length > 0 ? value : undefined)
                  }
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
