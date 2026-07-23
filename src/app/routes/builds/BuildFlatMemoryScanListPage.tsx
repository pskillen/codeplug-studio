import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Group, Stack, Text } from '@mantine/core';
import { Link, Navigate } from 'react-router-dom';
import type { BuildExportSettings, RadioBuild } from '@core/models/radioBuild.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import {
  chirpMemoryChannelIds,
  isChirpFlatMemoryChannel,
  resolveChirpChannelMemorySlots,
} from '@core/domain/exportOrderOrSlot.ts';
import { overrideScanInclusion } from '@core/domain/formatBuildOverrides.ts';
import {
  buildScanContext,
  resolveChannelScanInclusionForExport,
} from '@core/import-export/scanInclusion/index.ts';
import type { Channel, ScanInclusion } from '@core/models/library.ts';
import { radioTargetHasTrait } from '@core/radio-targets/index.ts';
import { BuildCapabilityTrait } from '@core/models/traits.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import DefaultScanInclusionSegment from '../../components/builds/DefaultScanInclusionSegment.tsx';
import ScanInclusionSegment from '../../components/channels/ScanInclusionSegment.tsx';
import { BandPillForChannel } from '../../components/pills/BandPill.tsx';
import { FormPage, FormSection } from '../../components/ui/index.ts';
import DataTable from '../../components/ui/DataTable.tsx';
import { loadLibrarySlice } from '../../lib/loadLibrarySlice.ts';
import { resolveOptimisticBuild } from '../../lib/resolveOptimisticBuild.ts';
import {
  radioBuildFormatExportDefaults,
  resolvedBuildExportSettings,
} from '../../lib/buildExportSettingsUi.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';
import { useProjects } from '../../state/useProjects.ts';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';

const buildService = new BuildService(persistence);

interface ScanListRow {
  id: string;
  slot: number;
  channel: Channel;
  /** Build override when set; otherwise library value for the segment. */
  scanInclusion: ScanInclusion;
}

/**
 * Flat-memory builds: configure the radio’s single scan list via per-channel flags.
 * No memory order, wire names, or skip-from-export here — those stay on Channels.
 */
export default function BuildFlatMemoryScanListPage() {
  const { build: contextBuild } = useBuildLayout();
  const buildRef = useRef(contextBuild);
  const [savedBuild, setSavedBuild] = useState<RadioBuild | null>(null);
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
  const [search, setSearch] = useState('');

  useEffect(() => {
    buildRef.current = build;
  }, [build]);

  const exportSettings = resolvedBuildExportSettings(build);
  const formatDefaults = radioBuildFormatExportDefaults(build);
  const defaultScanValue =
    exportSettings.defaultScanInclusion ?? formatDefaults.defaultScanInclusion;
  const scanContext = buildScanContext({ defaultScanInclusion: defaultScanValue }, formatDefaults);

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

  const channelById = useMemo(
    () => new Map(librarySlice.channels.map((ch) => [ch.id, ch])),
    [librarySlice.channels],
  );

  const rows = useMemo((): ScanListRow[] => {
    const slots = resolveChirpChannelMemorySlots(build, librarySlice);
    const out: ScanListRow[] = [];
    for (const slot of slots) {
      if (slot.channelId == null) continue;
      const channel = channelById.get(slot.channelId);
      if (!channel || !isChirpFlatMemoryChannel(channel)) continue;
      const scanInclusion =
        overrideScanInclusion(build.channelOverrides, channel.id) ?? channel.scanInclusion;
      out.push({ id: channel.id, slot: slot.slot, channel, scanInclusion });
    }
    return out;
  }, [build, librarySlice, channelById]);

  const memoryCount = useMemo(
    () => chirpMemoryChannelIds(build, librarySlice).length,
    [build, librarySlice],
  );

  if (!radioTargetHasTrait(build.radioTargetId, BuildCapabilityTrait.PerChannelScanFlag)) {
    return <Navigate to={`/builds/${build.id}/channels`} replace />;
  }

  async function handleExportSettingsPatch(patch: Partial<BuildExportSettings>) {
    setSavingSettings(true);
    setSettingsError(null);
    const next = buildService.withExportSettings(buildRef.current, patch);
    const result = await putBuild(next, buildRef.current.revision);
    setSavingSettings(false);
    if (result.ok) {
      const saved = { ...next, revision: result.revision };
      buildRef.current = saved;
      setSavedBuild(saved);
    } else {
      setSettingsError(
        result.reason === 'revision_conflict'
          ? 'Build changed elsewhere — reload and try again.'
          : 'Could not save scan default.',
      );
    }
  }

  async function updateChannelScan(channelId: string, scanInclusion: ScanInclusion) {
    const current =
      overrideScanInclusion(buildRef.current.channelOverrides, channelId) ??
      channelById.get(channelId)?.scanInclusion;
    if (current === scanInclusion) return;
    setSaving(true);
    setError(null);
    const next = buildService.withScanInclusionOverride(buildRef.current, channelId, scanInclusion);
    const result = await putBuild(next, buildRef.current.revision);
    setSaving(false);
    if (result.ok) {
      const saved = { ...next, revision: result.revision };
      buildRef.current = saved;
      setSavedBuild(saved);
    } else {
      setError(
        result.reason === 'revision_conflict'
          ? 'Build changed elsewhere — reload and try again.'
          : 'Could not save scan setting.',
      );
    }
  }

  return (
    <FormPage
      title="Scan list"
      description={
        <Text size="sm" component="span">
          Choose which memories are included when this radio scans. Memory order and names are set
          on <Link to={`/builds/${build.id}/channels`}>Channels</Link>.
        </Text>
      }
    >
      <Stack gap="lg">
        <FormSection
          title="Default for this build"
          description="Used when a channel’s scan setting is Default."
        >
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
        </FormSection>

        <FormSection
          title="Per channel"
          description={
            memoryCount === 0
              ? 'Add analogue channels on the Channels page first.'
              : 'Skip scan keeps a memory out of scanning. Always scan forces it in. Default follows the setting above. Changes apply to this build only — not the library channel.'
          }
        >
          {error ? (
            <Text size="sm" c="red">
              {error}
            </Text>
          ) : null}
          <DataTable
            rows={rows}
            rowKey={(row) => row.id}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search channels…"
            emptyState={
              <Text size="sm" c="dimmed">
                No analogue memories on this build yet.
              </Text>
            }
            nameColumn={{
              header: 'Channel',
              getName: (row) => channelDisplayLabel(row.channel),
              getPath: () => '#',
              sortable: true,
              sortValue: (row) => channelDisplayLabel(row.channel).toLowerCase(),
              render: (row) => (
                <Group gap="xs" wrap="wrap" align="center">
                  <Text size="sm" fw={500}>
                    {channelDisplayLabel(row.channel)}
                  </Text>
                  <BandPillForChannel channel={row.channel} size="xs" />
                </Group>
              ),
            }}
            columns={[
              {
                key: 'slot',
                header: 'Memory',
                sortable: true,
                sortValue: (row) => row.slot,
                render: (row) => row.slot,
              },
              {
                key: 'scan',
                header: 'Scan',
                hideable: false,
                render: (row) => (
                  <ScanInclusionSegment
                    compact
                    disabled={saving}
                    value={row.scanInclusion}
                    onChange={(scanInclusion) => void updateChannelScan(row.id, scanInclusion)}
                  />
                ),
              },
              {
                key: 'effective',
                header: 'On export',
                render: (row) => {
                  const override = overrideScanInclusion(build.channelOverrides, row.id);
                  const effective = resolveChannelScanInclusionForExport(
                    row.channel,
                    override,
                    scanContext,
                  );
                  return effective === 'scan' ? (
                    <Badge color="green" variant="light">
                      Scans
                    </Badge>
                  ) : (
                    <Badge color="gray" variant="light">
                      Skipped
                    </Badge>
                  );
                },
              },
            ]}
          />
        </FormSection>
      </Stack>
    </FormPage>
  );
}
