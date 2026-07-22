import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Group, Stack, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import type { BuildExportSettings, FormatBuild } from '@core/models/formatBuild.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import {
  isEntityExcluded,
  overrideByEntityId,
  overrideOrderOrSlot,
  overrideScanInclusion,
} from '@core/domain/formatBuildOverrides.ts';
import {
  applyDenseChannelOrderOrSlots,
  chirpMemoryChannelIds,
  clearAllOrderOrSlots,
  exportOrderResetConfirmMessage,
  hasAnyOrderOrSlotOverride,
  isChirpFlatMemoryChannel,
} from '@core/domain/exportOrderOrSlot.ts';
import {
  buildExportSortConfirmMessage,
  sortChannelIdsByMode,
  type MembershipSortMode,
} from '@core/domain/membershipSort.ts';
import { getFormatProfiles } from '@core/import-export/formatProfiles.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { sanitiseAsciiWireString } from '@core/import-export/sanitiseAsciiWireString.ts';
import type { Channel } from '@core/models/library.ts';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { mergeExportOptions } from '@core/services/exportBuild.ts';
import { loadLibrarySlice } from '../../lib/loadLibrarySlice.ts';
import { resolveOptimisticBuild } from '../../lib/resolveOptimisticBuild.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { previewGeneratedChannelWireName } from '@core/services/previewChannelWireName.ts';
import BuildEntityExportSettingsCard, {
  ChannelsBulkEditAction,
} from '../../components/builds/BuildEntityExportSettingsCard.tsx';
import MembershipSortMenu from '../../components/library/MembershipSortMenu.tsx';
import ExportOrderOverrideBanner from '../../components/builds/wirePreview/ExportOrderOverrideBanner.tsx';
import WirePreviewDataTable from '../../components/builds/wirePreview/WirePreviewDataTable.tsx';
import WirePreviewOverrideModal from '../../components/builds/wirePreview/WirePreviewOverrideModal.tsx';
import { useSyncedWirePreviewRow } from '../../components/builds/wirePreview/useSyncedWirePreviewRow.ts';
import ChirpChannelScanSection from '../../components/builds/wirePreview/overrideModalSections/ChirpChannelScanSection.tsx';
import { FormPage } from '../../components/ui/index.ts';
import { ICON_STROKE } from '../../lib/iconSizes.ts';
import { resolvedBuildExportSettings } from '../../lib/buildExportSettingsUi.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';
import { useProjects } from '../../state/useProjects.ts';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';

const buildService = new BuildService(persistence);

function analogueChannels(channels: Channel[]): Channel[] {
  return channels.filter((channel) => isChirpFlatMemoryChannel(channel));
}

function toWirePreviewRow(
  channel: Channel,
  build: ReturnType<typeof useBuildLayout>['build'],
  exportOptions: ReturnType<typeof mergeExportOptions>,
): WirePreviewRow {
  const channelOverride = overrideByEntityId(build.channelOverrides)
    .get(channel.id)
    ?.wireName?.trim();
  const generatedWireName = previewGeneratedChannelWireName(channel, build, exportOptions);
  return {
    key: channel.id,
    libraryEntityId: channel.id,
    entityKind: 'channel',
    displayLabel: channelDisplayLabel(channel),
    generatedWireName: sanitiseAsciiWireString(generatedWireName),
    effectiveWireName: sanitiseAsciiWireString(channelOverride ?? generatedWireName),
    hasWireNameOverride: Boolean(channelOverride),
    hasOrderOrSlotOverride: overrideOrderOrSlot(build.channelOverrides, channel.id) != null,
    excluded: isEntityExcluded(build.channelOverrides, channel.id),
    rxFrequency: channel.rxFrequency,
    txFrequency: channel.txFrequency,
  };
}

export default function BuildFlatMemoryChannelsPage() {
  const { build: contextBuild } = useBuildLayout();
  const buildRef = useRef(contextBuild);
  const [savedBuild, setSavedBuild] = useState<FormatBuild | null>(null);
  const build = resolveOptimisticBuild(contextBuild, savedBuild);
  const { activeProjectId } = useProjects();
  const { putBuild } = useFormatBuilds();
  const [librarySlice, setLibrarySlice] = useState<LibrarySlice>({
    channels: [],
    zones: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    buildRef.current = build;
  }, [build]);

  const exportOptions = useMemo(
    () => mergeExportOptions(build, undefined, librarySlice),
    [build, librarySlice],
  );
  const exportSettings = resolvedBuildExportSettings(build);

  const nameLimit = useMemo(() => {
    const options = getFormatProfiles(build.formatId as FormatId);
    return options.find((option) => option.profileId === build.profileId)?.nameLimit;
  }, [build.formatId, build.profileId]);

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    void loadLibrarySlice(persistence, activeProjectId).then((slice) => {
      if (!cancelled) {
        setLibrarySlice(slice);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, build.id]);

  const channels = librarySlice.channels;

  const channelById = useMemo(() => new Map(channels.map((ch) => [ch.id, ch])), [channels]);

  const memoryChannelIds = useMemo(
    () => chirpMemoryChannelIds(build, librarySlice),
    [build, librarySlice],
  );

  const previewRows = useMemo(
    () =>
      memoryChannelIds
        .map((id) => channelById.get(id))
        .filter((channel): channel is Channel => channel != null)
        .map((channel) => toWirePreviewRow(channel, build, exportOptions)),
    [memoryChannelIds, channelById, build, exportOptions],
  );

  const activeRow = useSyncedWirePreviewRow(selectedRowKey, previewRows);

  const locationByKey = useMemo(
    () => new Map(memoryChannelIds.map((id, index) => [id, index + 1])),
    [memoryChannelIds],
  );

  const persistBuild = useCallback(
    async (next: typeof build) => {
      const current = buildRef.current;
      setSaving(true);
      setError(null);
      const result = await putBuild(next, current.revision);
      setSaving(false);
      if (result.ok) {
        const saved = { ...next, revision: result.revision };
        buildRef.current = saved;
        setSavedBuild(saved);
      } else {
        setError(
          result.reason === 'revision_conflict'
            ? 'Build changed elsewhere — reload and try again.'
            : 'Could not save build.',
        );
      }
    },
    [putBuild],
  );

  const excludedChannelIds = useMemo(
    () =>
      analogueChannels(channels)
        .filter((channel) => isEntityExcluded(build.channelOverrides, channel.id))
        .map((channel) => channel.id),
    [channels, build.channelOverrides],
  );

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

  async function updateChannelScan(channelId: string, scanInclusion: Channel['scanInclusion']) {
    const current =
      overrideScanInclusion(buildRef.current.channelOverrides, channelId) ??
      channelById.get(channelId)?.scanInclusion;
    if (current === scanInclusion) return;
    const next = buildService.withScanInclusionOverride(buildRef.current, channelId, scanInclusion);
    await persistBuild(next);
  }

  function setRowWireName(row: WirePreviewRow, wireName: string) {
    const current = buildRef.current;
    void persistBuild(
      buildService.withWireNameOverride(current, 'channelOverrides', row.libraryEntityId, wireName),
    );
  }

  function setRowExcluded(row: WirePreviewRow, excluded: boolean) {
    const current = buildRef.current;
    void persistBuild(
      buildService.withEntityExcluded(current, 'channelOverrides', row.libraryEntityId, excluded),
    );
  }

  function setChannelOrder(orderedChannelIds: string[]) {
    const current = buildRef.current;
    const nextOverrides = applyDenseChannelOrderOrSlots(
      current.channelOverrides,
      orderedChannelIds,
    );
    void persistBuild({ ...current, channelOverrides: nextOverrides });
  }

  function clearChannelOrderOverrides() {
    if (!window.confirm(exportOrderResetConfirmMessage())) return;
    const current = buildRef.current;
    void persistBuild({
      ...current,
      channelOverrides: clearAllOrderOrSlots(current.channelOverrides),
    });
  }

  function moveChannel(rowKey: string, direction: 'up' | 'down') {
    const ids = [...memoryChannelIds];
    const index = ids.indexOf(rowKey);
    if (index < 0) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setChannelOrder(ids);
  }

  function handleSortChannelsForBuild(mode: MembershipSortMode) {
    setChannelOrder(sortChannelIdsByMode(memoryChannelIds, channelById, mode));
  }

  function includeChannel(channelId: string) {
    const current = buildRef.current;
    void persistBuild(
      buildService.withEntityExcluded(current, 'channelOverrides', channelId, false),
    );
  }

  const selectedChannel = activeRow ? channelById.get(activeRow.libraryEntityId) : undefined;
  const channelOrderOverridden = hasAnyOrderOrSlotOverride(build.channelOverrides);

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
          All analogue FM/AM library channels are included by default. Click a row to edit
          overrides. Location numbers (1…n) follow export order. Digital modes are not exported.
          Choose which memories scan on the{' '}
          <Link to={`/builds/${build.id}/scan-list`}>Scan list</Link> page.
        </Text>
        <BuildEntityExportSettingsCard
          build={build}
          entityKind="channel"
          saving={savingSettings}
          exportSettings={exportSettings}
          showExportNameMode
          showLibraryAbbreviations
          onExportSettingsPatch={(patch) => void handleExportSettingsPatch(patch)}
          onExportInclusionChange={(field, checked) =>
            void handleExportSettingsPatch({ [field]: checked })
          }
          actions={<ChannelsBulkEditAction buildId={build.id} />}
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

        <Group gap="sm" align="center">
          <MembershipSortMenu
            label="Sort channels…"
            disabled={saving || memoryChannelIds.length < 2}
            confirmMessage={buildExportSortConfirmMessage}
            onSort={handleSortChannelsForBuild}
          />
          <Text size="xs" c="dimmed">
            Sorts this build’s memory locations only — not your library.
          </Text>
        </Group>

        <ExportOrderOverrideBanner
          visible={channelOrderOverridden}
          disabled={saving}
          onReset={clearChannelOrderOverrides}
          message="Memory location order on this build differs from the library default. Reset clears channel orderOrSlot overrides."
        />

        <WirePreviewDataTable
          rows={previewRows}
          search={search}
          onSearchChange={setSearch}
          onRowActivate={(row) => setSelectedRowKey(row.key)}
          locationByKey={locationByKey}
          inclusionColumn={{
            saving,
            onExcludedChange: setRowExcluded,
          }}
          reorder={{
            orderedKeys: memoryChannelIds,
            onMove: moveChannel,
            disabled: saving,
          }}
        />

        {excludedChannelIds.length > 0 ? (
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Include excluded channel
            </Text>
            <Group gap="xs">
              {excludedChannelIds.map((channelId) => {
                const channel = channelById.get(channelId);
                if (!channel) return null;
                return (
                  <Button
                    key={channelId}
                    size="compact-sm"
                    variant="light"
                    leftSection={<IconPlus size={14} stroke={ICON_STROKE} />}
                    disabled={saving}
                    onClick={() => includeChannel(channelId)}
                  >
                    {channelDisplayLabel(channel)}
                  </Button>
                );
              })}
            </Group>
          </Stack>
        ) : null}
      </Stack>
      <WirePreviewOverrideModal
        opened={selectedRowKey !== null}
        onClose={() => setSelectedRowKey(null)}
        row={activeRow}
        build={build}
        entityKind="channel"
        nameLimit={nameLimit}
        onExcludedChange={setRowExcluded}
        onWireNameChange={setRowWireName}
        extraSections={
          selectedChannel ? (
            <ChirpChannelScanSection
              value={
                overrideScanInclusion(build.channelOverrides, selectedChannel.id) ??
                selectedChannel.scanInclusion
              }
              saving={saving}
              onScanChange={(scanInclusion) =>
                void updateChannelScan(selectedChannel.id, scanInclusion)
              }
            />
          ) : null
        }
      />
    </FormPage>
  );
}
