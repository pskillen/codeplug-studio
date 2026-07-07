import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Anchor, Button, Group, Stack, Table, Text } from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import type { BuildExportSettings } from '@core/models/formatBuild.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { overrideByEntityId } from '@core/domain/formatBuildOverrides.ts';
import {
  addFlatMemoryChannel,
  findFlatMemorySection,
  removeFlatMemoryChannel,
  reorderFlatMemoryChannels,
  seedFlatMemoryFromBuild,
} from '@core/domain/flatMemoryLayout.ts';
import { isChirpAnalogueExportable } from '@core/import-export/formats/chirp/channelWire.ts';
import { getFormatProfiles } from '@core/import-export/formatProfiles.ts';
import { getFormatExportDefaults } from '@core/import-export/registry.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { sanitiseAsciiWireString } from '@core/import-export/sanitiseAsciiWireString.ts';
import type { Channel, ScanInclusion } from '@core/models/library.ts';
import { mergeExportOptions } from '@core/services/exportBuild.ts';
import { previewGeneratedChannelWireName } from '@core/services/previewChannelWireName.ts';
import DefaultScanInclusionSegment from '../../components/builds/DefaultScanInclusionSegment.tsx';
import ExportNameModeSelect from '../../components/builds/ExportNameModeSelect.tsx';
import UseChannelAbbreviationSwitch from '../../components/builds/UseChannelAbbreviationSwitch.tsx';
import { WireNameOverrideInput } from '../../components/builds/WirePreviewTable.tsx';
import ScanInclusionSegment from '../../components/channels/ScanInclusionSegment.tsx';
import UnsavedChangesModal from '../../components/ui/UnsavedChangesModal.tsx';
import { FormPage } from '../../components/ui/index.ts';
import { useUnsavedNavigationGuard } from '../../hooks/useUnsavedNavigationGuard.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import { resolvedBuildExportSettings } from '../../lib/buildExportSettingsUi.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';
import { useProjects } from '../../state/useProjects.ts';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';

const buildService = new BuildService(persistence);

function analogueChannels(channels: Channel[]): Channel[] {
  return channels.filter((channel) => isChirpAnalogueExportable(channel));
}

export default function BuildFlatMemoryChannelsPage() {
  const { build } = useBuildLayout();
  const buildRef = useRef(build);
  const { activeProjectId } = useProjects();
  const { putBuild } = useFormatBuilds();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [dirtyWireNameKeys, setDirtyWireNameKeys] = useState<Set<string>>(() => new Set());
  const hasUnsavedWireNames = dirtyWireNameKeys.size > 0;
  const seededRef = useRef(false);
  const { modalOpen, stay, leave } = useUnsavedNavigationGuard(hasUnsavedWireNames);

  useEffect(() => {
    buildRef.current = build;
  }, [build]);

  const exportOptions = useMemo(() => mergeExportOptions(build), [build]);
  const exportSettings = resolvedBuildExportSettings(build);
  const formatDefaults = getFormatExportDefaults(build.formatId);
  const defaultScanValue =
    exportSettings.defaultScanInclusion ?? formatDefaults.defaultScanInclusion;

  const nameLimit = useMemo(() => {
    const options = getFormatProfiles(build.formatId as FormatId);
    return options.find((option) => option.profileId === build.profileId)?.nameLimit;
  }, [build.formatId, build.profileId]);

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    setChannelsLoaded(false);
    void persistence.listChannels(activeProjectId).then((rows) => {
      if (!cancelled) {
        setChannels(rows);
        setChannelsLoaded(true);
      }
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

  const persistedSection = useMemo(() => findFlatMemorySection(build), [build]);

  const memorySection = useMemo(() => {
    if (persistedSection) return persistedSection;
    return seedFlatMemoryFromBuild(build, librarySlice);
  }, [persistedSection, build, librarySlice]);

  const channelById = useMemo(() => new Map(channels.map((ch) => [ch.id, ch])), [channels]);

  const memoryChannelIds = useMemo(
    () =>
      memorySection.channelIds.filter((channelId) => {
        const channel = channelById.get(channelId);
        if (!channel) return true;
        return isChirpAnalogueExportable(channel);
      }),
    [memorySection.channelIds, channelById],
  );

  const persistSection = useCallback(
    async (nextSection: typeof memorySection) => {
      const current = buildRef.current;
      setSaving(true);
      setError(null);
      const next = buildService.withFlatMemorySection(current, nextSection);
      const result = await putBuild(next, current.revision);
      setSaving(false);
      if (!result.ok) {
        setError(
          result.reason === 'revision_conflict'
            ? 'Build changed elsewhere — reload and try again.'
            : 'Could not save memory list.',
        );
      }
    },
    [putBuild],
  );

  useEffect(() => {
    seededRef.current = false;
  }, [build.id]);

  useEffect(() => {
    if (!channelsLoaded || persistedSection || seededRef.current) return;

    const seed = seedFlatMemoryFromBuild(buildRef.current, librarySlice);
    if (seed.channelIds.length === 0) return;

    seededRef.current = true;
    void persistSection(seed);
  }, [channelsLoaded, persistedSection, librarySlice, persistSection]);

  useEffect(() => {
    if (!channelsLoaded || !persistedSection) return;

    const digitalIds = persistedSection.channelIds.filter((channelId) => {
      const channel = channelById.get(channelId);
      return channel != null && !isChirpAnalogueExportable(channel);
    });
    if (digitalIds.length === 0) return;

    const nextIds = persistedSection.channelIds.filter((id) => !digitalIds.includes(id));
    void persistSection(reorderFlatMemoryChannels(persistedSection, nextIds));
  }, [channelsLoaded, persistedSection, channelById, persistSection]);

  const notInList = useMemo(() => {
    const inList = new Set(memoryChannelIds);
    return analogueChannels(channels).filter((ch) => !inList.has(ch.id));
  }, [channels, memoryChannelIds]);

  async function handleExportSettingsPatch(patch: Partial<BuildExportSettings>) {
    setSavingSettings(true);
    setSettingsError(null);
    const next = buildService.withExportSettings(buildRef.current, patch);
    const result = await putBuild(next, buildRef.current.revision);
    setSavingSettings(false);
    if (!result.ok) {
      setSettingsError(
        result.reason === 'revision_conflict'
          ? 'Build changed elsewhere — reload and try again.'
          : 'Could not save export settings.',
      );
    }
  }

  async function updateChannelScan(channel: Channel, scanInclusion: ScanInclusion) {
    if (!activeProjectId || channel.scanInclusion === scanInclusion) return;
    setSaving(true);
    setError(null);
    const result = await persistence.putChannel({ ...channel, scanInclusion }, channel.revision);
    setSaving(false);
    if (!result.ok) {
      setError(
        result.reason === 'revision_conflict'
          ? 'Channel changed elsewhere — reload and try again.'
          : 'Could not save scan setting.',
      );
      return;
    }
    setChannels((prev) =>
      prev.map((row) =>
        row.id === channel.id ? { ...row, scanInclusion, revision: result.revision! } : row,
      ),
    );
  }

  function wirePreviewRow(channel: Channel) {
    const channelOverride = overrideByEntityId(build.channelOverrides)
      .get(channel.id)
      ?.wireName?.trim();
    const generatedWireName = previewGeneratedChannelWireName(channel, build, exportOptions);
    return {
      key: channel.id,
      libraryEntityId: channel.id,
      entityKind: 'channel' as const,
      displayLabel: channelDisplayLabel(channel),
      generatedWireName: sanitiseAsciiWireString(generatedWireName),
      effectiveWireName: sanitiseAsciiWireString(channelOverride ?? generatedWireName),
      hasWireNameOverride: Boolean(channelOverride),
      excluded: false,
    };
  }

  function setRowWireName(channel: Channel, wireName: string) {
    void (async () => {
      const current = buildRef.current;
      setSaving(true);
      setError(null);
      const next = buildService.withWireNameOverride(
        current,
        'channelOverrides',
        channel.id,
        wireName,
      );
      const result = await putBuild(next, current.revision);
      setSaving(false);
      if (result.ok) {
        setDirtyWireNameKeys((prev) => {
          if (!prev.has(channel.id)) return prev;
          const nextKeys = new Set(prev);
          nextKeys.delete(channel.id);
          return nextKeys;
        });
      } else {
        setError(
          result.reason === 'revision_conflict'
            ? 'Build changed elsewhere — reload and try again.'
            : 'Could not save wire name override.',
        );
      }
    })();
  }

  function moveChannel(channelId: string, direction: 'up' | 'down') {
    const ids = [...memoryChannelIds];
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
      title="Channels"
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
          All analogue FM/AM library channels are included by default. Remove channels to exclude
          them from export. Location numbers (1…n) follow this list. Digital modes are not exported.
        </Text>
        <ExportNameModeSelect
          value={exportSettings.nameModeOverride}
          disabled={savingSettings}
          onChange={(nameModeOverride) => void handleExportSettingsPatch({ nameModeOverride })}
          description="Fallback style for channels without an explicit wire name override on this build."
        />
        <UseChannelAbbreviationSwitch
          shortenNames={exportSettings.shortenNames}
          value={exportSettings.useChannelAbbreviation}
          disabled={savingSettings}
          onChange={(useChannelAbbreviation) =>
            void handleExportSettingsPatch({ useChannelAbbreviation })
          }
        />
        <DefaultScanInclusionSegment
          value={defaultScanValue}
          formatDefault={formatDefaults.defaultScanInclusion}
          disabled={savingSettings}
          onChange={(defaultScanInclusion) =>
            void handleExportSettingsPatch({ defaultScanInclusion })
          }
        />
        {settingsError ? (
          <Text size="sm" c="red">
            {settingsError}
          </Text>
        ) : null}
        {error ? (
          <Text size="sm" c="red">
            {error}
          </Text>
        ) : null}

        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={72}>Location</Table.Th>
              <Table.Th>Library name</Table.Th>
              <Table.Th>Export name</Table.Th>
              <Table.Th>Scan</Table.Th>
              <Table.Th w={120}>Order</Table.Th>
              <Table.Th w={48} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {memoryChannelIds.map((channelId, index) => {
              const channel = channelById.get(channelId);
              const previewRow = channel ? wirePreviewRow(channel) : null;
              return (
                <Table.Tr key={channelId}>
                  <Table.Td>{index + 1}</Table.Td>
                  <Table.Td>
                    {channel ? (
                      <Stack gap={2}>
                        <Text size="sm">{channelDisplayLabel(channel)}</Text>
                        <Anchor component={Link} to={`/library/channels/${channel.id}`} size="xs">
                          Edit in library
                        </Anchor>
                      </Stack>
                    ) : (
                      <Text size="sm" c="dimmed">
                        Loading…
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {previewRow ? (
                      <WireNameOverrideInput
                        key={`${channelId}:${previewRow.effectiveWireName}`}
                        row={previewRow}
                        nameLimit={nameLimit}
                        excluded={false}
                        clickableDefaultWireName
                        onWireNameChange={(_row, wireName) => setRowWireName(channel!, wireName)}
                        onDirtyChange={(dirty) => {
                          setDirtyWireNameKeys((prev) => {
                            const has = prev.has(channelId);
                            if (dirty === has) return prev;
                            const nextKeys = new Set(prev);
                            if (dirty) nextKeys.add(channelId);
                            else nextKeys.delete(channelId);
                            return nextKeys;
                          });
                        }}
                      />
                    ) : null}
                  </Table.Td>
                  <Table.Td>
                    {channel ? (
                      <ScanInclusionSegment
                        compact
                        disabled={saving}
                        value={channel.scanInclusion}
                        onChange={(scanInclusion) => void updateChannelScan(channel, scanInclusion)}
                      />
                    ) : null}
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
                        disabled={saving || index === memoryChannelIds.length - 1}
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
                      aria-label="Exclude from export"
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
              Include excluded channel
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
      <UnsavedChangesModal
        opened={modalOpen}
        onStay={stay}
        onLeave={leave}
        title="Unsaved wire name changes"
        message="You have unsaved wire name edits. Leave without saving?"
      />
    </FormPage>
  );
}
