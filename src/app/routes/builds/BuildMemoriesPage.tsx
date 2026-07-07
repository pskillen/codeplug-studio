import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionIcon, Button, Group, Stack, Table, Text } from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import {
  addFlatMemoryChannel,
  removeFlatMemoryChannel,
  reorderFlatMemoryChannels,
  resolveFlatMemorySection,
  seedFlatMemoryFromBuild,
} from '@core/domain/flatMemoryLayout.ts';
import { buildScanContext, resolveEffectiveScanInclusion } from '@core/import-export/scanInclusion/resolve.ts';
import { getFormatExportDefaults } from '@core/import-export/registry.ts';
import type { Channel } from '@core/models/library.ts';
import { FormPage } from '../../components/ui/index.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import { resolvedBuildExportSettings } from '../../lib/buildExportSettingsUi.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';
import { useProjects } from '../../state/useProjects.ts';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';

const buildService = new BuildService(persistence);

function channelHasChirpAnalogueProfile(channel: Channel): boolean {
  return channel.modeProfiles.some((profile) => profile.mode === 'fm' || profile.mode === 'am');
}

export default function BuildMemoriesPage() {
  const { build } = useBuildLayout();
  const { activeProjectId } = useProjects();
  const { putBuild } = useFormatBuilds();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    void persistence.listChannels(activeProjectId).then((rows) => {
      if (!cancelled) setChannels(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, build.id]);

  const librarySlice = useMemo(
    () => ({
      channels,
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
    }),
    [channels],
  );

  const memorySection = useMemo(() => {
    const existing = resolveFlatMemorySection(build, librarySlice);
    if (build.layout.sections.some((s) => s.kind === 'flatMemory')) {
      return existing;
    }
    return seedFlatMemoryFromBuild(build, librarySlice);
  }, [build, librarySlice]);

  const channelById = useMemo(() => new Map(channels.map((ch) => [ch.id, ch])), [channels]);

  const scanContext = useMemo(
    () =>
      buildScanContext(
        resolvedBuildExportSettings(build),
        getFormatExportDefaults(build.formatId),
      ),
    [build],
  );

  const notInList = useMemo(() => {
    const inList = new Set(memorySection.channelIds);
    return channels.filter((ch) => !inList.has(ch.id));
  }, [channels, memorySection.channelIds]);

  const persistSection = useCallback(
    async (nextSection: typeof memorySection) => {
      setSaving(true);
      setError(null);
      const next = buildService.withFlatMemorySection(build, nextSection);
      const result = await putBuild(next, build.revision);
      setSaving(false);
      if (!result.ok) {
        setError(
          result.reason === 'revision_conflict'
            ? 'Build changed elsewhere — reload and try again.'
            : 'Could not save memory order.',
        );
      }
    },
    [build, putBuild],
  );

  function moveChannel(channelId: string, direction: 'up' | 'down') {
    const ids = [...memorySection.channelIds];
    const index = ids.indexOf(channelId);
    if (index < 0) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= ids.length) return;
    const nextIds = [...ids];
    [nextIds[index], nextIds[target]] = [nextIds[target]!, nextIds[index]!];
    void persistSection(reorderFlatMemoryChannels(memorySection, nextIds));
  }

  return (
    <FormPage
      title="Memories"
      description={
        <Link
          to={`/builds/${build.id}/overview`}
          style={{ fontSize: 'var(--mantine-font-size-sm)' }}
        >
          ← {build.name}
        </Link>
      }
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Order channels for CHIRP export. Location numbers (1…n) are assigned at export from this
          list. Scan skip is controlled per channel in the library or via export defaults on the
          Export page.
        </Text>
        {error ? (
          <Text size="sm" c="red">
            {error}
          </Text>
        ) : null}

        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={80}>Location</Table.Th>
              <Table.Th>Channel</Table.Th>
              <Table.Th>Scan</Table.Th>
              <Table.Th w={120}>Order</Table.Th>
              <Table.Th w={48} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {memorySection.channelIds.map((channelId, index) => {
              const channel = channelById.get(channelId);
              if (!channel) return null;
              const analogue = channelHasChirpAnalogueProfile(channel);
              const scan = resolveEffectiveScanInclusion(channel, scanContext);
              return (
                <Table.Tr key={channelId} opacity={analogue ? 1 : 0.55}>
                  <Table.Td>{index + 1}</Table.Td>
                  <Table.Td>
                    <Stack gap={0}>
                      <Text size="sm">{channelDisplayLabel(channel)}</Text>
                      {!analogue ? (
                        <Text size="xs" c="dimmed">
                          Digital — skipped on export
                        </Text>
                      ) : null}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{scan === 'skip' ? 'Skip' : 'Scan'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        aria-label="Move up"
                        disabled={saving || index === 0}
                        onClick={() => moveChannel(channelId, 'up')}
                      >
                        <IconArrowUp size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        aria-label="Move down"
                        disabled={saving || index === memorySection.channelIds.length - 1}
                        onClick={() => moveChannel(channelId, 'down')}
                      >
                        <IconArrowDown size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      aria-label="Remove from memories"
                      disabled={saving}
                      onClick={() =>
                        void persistSection(removeFlatMemoryChannel(memorySection, channelId))
                      }
                    >
                      <IconTrash size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>

        {notInList.length > 0 ? (
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Add to memories
            </Text>
            <Group gap="xs">
              {notInList.map((channel) => (
                <Button
                  key={channel.id}
                  size="compact-sm"
                  variant="light"
                  leftSection={<IconPlus size={14} stroke={ICON_STROKE} />}
                  disabled={saving}
                  onClick={() =>
                    void persistSection(addFlatMemoryChannel(memorySection, channel.id))
                  }
                >
                  {channelDisplayLabel(channel)}
                </Button>
              ))}
            </Group>
          </Stack>
        ) : null}
      </Stack>
    </FormPage>
  );
}
