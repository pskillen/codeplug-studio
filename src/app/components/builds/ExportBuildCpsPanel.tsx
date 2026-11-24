import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, FileButton, List, Stack, Text } from '@mantine/core';
import type { BuildExportSettings, RadioBuild } from '@core/models/formatBuild.ts';
import { prepareBuildForFrequencyRangeExportPatch } from '../../lib/frequencyRangeExportSettingsPatch.ts';
import { traitProfileFor } from '@core/models/traits.ts';
import { formatCatalogEntry, getExportAdapter } from '@core/import-export/registry.ts';
import {
  isBinaryCpsExportAdapter,
  isMultiFileExportAdapter,
  isSingleFileCpsExportAdapter,
} from '@core/import-export/exportAdapter.ts';
import {
  formatProfileWireHint,
  getFormatProfiles,
  resolveChirpExportProfileId,
} from '@core/import-export/formatProfiles.ts';
import type { FormatId } from '@core/import-export/types.ts';
import type { CpsAppExportOptions } from '../../services/buildCpsExportService.ts';
import ExportBuildSettingsSections from './ExportBuildSettingsSections.tsx';
import EgressPathwayCards from './EgressPathwayCards.tsx';
import ExportFileDialog from './ExportFileDialog/ExportFileDialog.tsx';
import Dm32PreferNeonPlugAlert from './Dm32PreferNeonPlugAlert.tsx';
import Dm32AprsSetupAlert from './Dm32AprsSetupAlert.tsx';
import BuildRadioIoPanel from './BuildRadioIoPanel.tsx';
import {
  resolvedBuildExportSettings,
  radioBuildFormatExportDefaults,
} from '../../lib/buildExportSettingsUi.ts';
import {
  buildNeedsLegacyExportSettingsMigration,
  clearLegacyExportSettingsLocalStorage,
  legacyExportSettingsFromLocalStorage,
} from '../../lib/migrateLegacyExportSettings.ts';
import { useProjects } from '../../state/useProjects.ts';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';
import { useBuildLayout } from '../../routes/builds/BuildLayoutContext.tsx';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';
import {
  defaultCpsSingleFileName,
  defaultCpsZipFileName,
} from '../../services/buildCpsExportService.ts';
import { useBuildCpsExportFileNames } from '../../hooks/useBuildCpsExportFileNames.ts';
import { loadLibrarySlice } from '../../lib/loadLibrarySlice.ts';
import { importRadioFoundryCodeplug } from '../../services/radiofoundryCodeplugImportService.ts';

function describeCodeplugImport(channelCount: number, zoneCount: number): string {
  const channels = channelCount === 1 ? '1 channel' : `${channelCount} channels`;
  const zones = zoneCount === 1 ? '1 zone' : `${zoneCount} zones`;
  return `Imported ${channels} and ${zones}.`;
}

export interface ExportBuildCpsPanelProps {
  build: RadioBuild;
  /** When `settings`, only projection/inclusion controls; default is pathway delivery UI. */
  panelMode?: 'delivery' | 'settings';
}

const buildService = new BuildService(persistence);

export default function ExportBuildCpsPanel({
  build,
  panelMode = 'delivery',
}: ExportBuildCpsPanelProps) {
  const { activeProjectId, activeProject } = useProjects();
  const { activeEgress, egressPaths, setActiveEgressId, reloadEgressPaths } = useBuildLayout();
  const { putBuild } = useFormatBuilds();

  const formatId = (activeEgress?.formatId ?? 'opengd77') as FormatId;
  const profileId = activeEgress?.profileId ?? '';
  const formatEntry = formatCatalogEntry(formatId);
  const profileLabel = traitProfileFor(profileId)?.label ?? profileId;
  const wireHint = formatProfileWireHint(formatId, profileId);
  const formatDefaults = radioBuildFormatExportDefaults(build);
  const resolvedSettings = resolvedBuildExportSettings(build);

  const [channelCount, setChannelCount] = useState<number | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importingCodeplug, setImportingCodeplug] = useState(false);
  const [codeplugImportMessage, setCodeplugImportMessage] = useState<string | null>(null);
  const [codeplugImportFailed, setCodeplugImportFailed] = useState(false);
  const [codeplugImportWarnings, setCodeplugImportWarnings] = useState<string[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  /** CHIRP-only runtime profile override — must not absorb NeonPlug / radio-io profile ids. */
  const [exportProfileId, setExportProfileId] = useState(profileId);
  const [lastChirpEgressId, setLastChirpEgressId] = useState(
    formatId === 'chirp' ? (activeEgress?.id ?? null) : null,
  );
  if (formatId === 'chirp' && activeEgress && activeEgress.id !== lastChirpEgressId) {
    setLastChirpEgressId(activeEgress.id);
    setExportProfileId(profileId);
  } else if (formatId !== 'chirp' && lastChirpEgressId !== null) {
    setLastChirpEgressId(null);
  }
  const chirpExportProfileId =
    formatId === 'chirp' ? resolveChirpExportProfileId(exportProfileId, profileId) : profileId;
  const migratedRef = useRef(false);

  const profileNameLimit = useMemo(() => {
    const options = getFormatProfiles(formatId);
    const resolvedProfileId = formatId === 'chirp' ? chirpExportProfileId : profileId;
    return options.find((option) => option.profileId === resolvedProfileId)?.nameLimit;
  }, [formatId, profileId, chirpExportProfileId]);

  const runtimeExportOverrides = useMemo(
    (): CpsAppExportOptions => ({
      egressId: activeEgress?.id,
      profileId: formatId === 'chirp' ? chirpExportProfileId : undefined,
      fileName:
        formatId === 'chirp' ? defaultCpsSingleFileName(formatId, chirpExportProfileId) : undefined,
    }),
    [activeEgress?.id, formatId, chirpExportProfileId],
  );
  const exportFileNames = useBuildCpsExportFileNames(
    build,
    formatId,
    profileId,
    runtimeExportOverrides,
  );
  const hasChannels = Boolean(activeProjectId) && (channelCount ?? 0) > 0;
  const exportShipped = formatEntry?.exportStatus === 'shipped';
  const interchangeFolderId = activeProject?.interchange?.googleDrive?.folderId;
  const suggestedZipName = defaultCpsZipFileName(build.name, formatId);
  const defaultScanValue =
    resolvedSettings.defaultScanInclusion ?? formatDefaults.defaultScanInclusion;

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    void persistence.listChannels(activeProjectId).then((channels) => {
      if (!cancelled) {
        setChannelCount(channels.length);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, build.id]);

  useEffect(() => {
    if (migratedRef.current || !buildNeedsLegacyExportSettingsMigration(build)) return;
    migratedRef.current = true;
    const legacy = legacyExportSettingsFromLocalStorage();
    void (async () => {
      const ok = await handleExportSettingsPatch(legacy, build.revision);
      if (ok) clearLegacyExportSettingsLocalStorage();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time migration on mount
  }, [build.id]);

  async function handleExportSettingsPatch(
    patch: Partial<BuildExportSettings>,
    expectedRevision = build.revision,
  ): Promise<boolean> {
    setSavingSettings(true);
    setSettingsError(null);

    const prepared = await prepareBuildForFrequencyRangeExportPatch(build, patch, {
      buildService,
      loadLibrary: async () =>
        activeProjectId ? loadLibrarySlice(persistence, activeProjectId) : null,
    });
    if (prepared.status === 'cancelled') {
      setSavingSettings(false);
      return false;
    }
    if (prepared.status === 'error') {
      setSettingsError(prepared.message);
      setSavingSettings(false);
      return false;
    }

    const result = await putBuild(prepared.build, expectedRevision);
    setSavingSettings(false);
    if (!result.ok) {
      setSettingsError(
        result.reason === 'revision_conflict'
          ? 'Build changed elsewhere — reload and try again.'
          : 'Could not save export settings.',
      );
      return false;
    }
    return true;
  }

  async function handleExportInclusionChange(
    field:
      | 'exportUnlinkedChannels'
      | 'exportUnlinkedTalkGroups'
      | 'exportUnlinkedRxGroupLists'
      | 'exportUnlinkedDigitalContacts'
      | 'exportUnlinkedAnalogContacts',
    checked: boolean,
  ) {
    setSavingSettings(true);
    setSettingsError(null);
    const next = buildService.withExportInclusionFlags(build, { [field]: checked });
    const result = await putBuild(next, build.revision);
    setSavingSettings(false);
    if (!result.ok) {
      setSettingsError(
        result.reason === 'revision_conflict'
          ? 'Build changed elsewhere — reload and try again.'
          : 'Could not save export settings.',
      );
    }
  }

  async function handleImportCodeplug(file: File | null) {
    if (!file || !activeProjectId) return;
    setImportingCodeplug(true);
    setCodeplugImportMessage(null);
    setCodeplugImportFailed(false);
    setCodeplugImportWarnings([]);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await importRadioFoundryCodeplug(
        activeProjectId,
        bytes,
        undefined,
        profileId || undefined,
      );
      if (!result.ok) {
        setCodeplugImportFailed(true);
        setCodeplugImportMessage(result.message);
        return;
      }
      setCodeplugImportMessage(describeCodeplugImport(result.channelCount, result.zoneCount));
      setCodeplugImportWarnings(result.warnings);
      const channels = await persistence.listChannels(activeProjectId);
      setChannelCount(channels.length);
    } catch (err) {
      setCodeplugImportFailed(true);
      setCodeplugImportMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setImportingCodeplug(false);
    }
  }

  if (!activeEgress) {
    return (
      <Alert color="gray" title="No export pathway">
        This build has no active egress pathway. Reload the page or open Setup to restore pathways
        for this radio.
      </Alert>
    );
  }

  async function handleActiveEgressChange(egressId: string) {
    setActiveEgressId(egressId);
    if (build.defaultEgressPathId === egressId) return;
    const egress = egressPaths.find((path) => path.id === egressId);
    if (!egress) return;
    const next = buildService.withDefaultEgressPathId(build, egress);
    const result = await putBuild(next, build.revision);
    if (!result.ok) {
      setSettingsError(
        result.reason === 'revision_conflict'
          ? 'This build was changed elsewhere. Reload and reselect the export pathway.'
          : 'Could not save the preferred export pathway.',
      );
    }
  }

  const egressSwitcher =
    egressPaths.length > 1 ? (
      <EgressPathwayCards
        egressPaths={egressPaths}
        activeEgressId={activeEgress.id}
        onSelect={(id) => void handleActiveEgressChange(id)}
      />
    ) : null;

  const exportDialog =
    activeProjectId && activeEgress && exportDialogOpen ? (
      <ExportFileDialog
        open
        onClose={() => setExportDialogOpen(false)}
        build={build}
        projectId={activeProjectId}
        activeEgress={activeEgress}
        formatId={formatId}
        formatLabel={formatEntry?.label ?? formatId}
        buildProfileId={profileId}
        exportProfileId={exportProfileId}
        onExportProfileIdChange={setExportProfileId}
        runtimeExportOverrides={runtimeExportOverrides}
        suggestedZipName={suggestedZipName}
        exportFileNames={exportFileNames}
        hasChannels={hasChannels}
        interchangeFolderId={interchangeFolderId}
        reloadEgressPaths={reloadEgressPaths}
      />
    ) : null;

  const settingsSections = (
    <ExportBuildSettingsSections
      build={build}
      formatId={formatId}
      profileId={formatId === 'chirp' ? chirpExportProfileId : profileId}
      saving={savingSettings}
      settingsError={settingsError}
      profileNameLimit={profileNameLimit}
      resolvedSettings={resolvedSettings}
      formatDefaults={formatDefaults}
      defaultScanValue={defaultScanValue}
      onExportSettingsPatch={(patch) => void handleExportSettingsPatch(patch)}
      onExportInclusionChange={(field, checked) => void handleExportInclusionChange(field, checked)}
    />
  );

  if (panelMode === 'settings') {
    if (!activeEgress) {
      return (
        <Alert color="gray" title="No export pathway">
          This build has no active egress pathway. Reload the page or open Setup to restore pathways
          for this radio.
        </Alert>
      );
    }
    return <Stack gap="sm">{settingsSections}</Stack>;
  }

  if (formatId === 'radio-io') {
    return (
      <Stack gap="sm">
        {egressSwitcher}
        <Text size="sm">
          Direct radio via Web Serial for{' '}
          <Text span fw={600}>
            {profileLabel}
          </Text>
          . There is no CPS file export for this pathway: Write sends this build to the radio you
          connect. Curate channels on the library and this build&apos;s memory list; Write overlays
          them onto a read of the radio taken in the same session.
        </Text>
        {wireHint ? (
          <Text size="sm" c="dimmed">
            {wireHint}
          </Text>
        ) : null}
        <BuildRadioIoPanel build={build} egress={activeEgress} />
      </Stack>
    );
  }

  if (!exportShipped) {
    return (
      <Alert color="gray" title="Export not available yet">
        {formatEntry?.label ?? formatId} CPS export is planned. OpenGD77 CSV export is available on
        OpenGD77 builds.
      </Alert>
    );
  }

  let adapter;
  try {
    adapter = getExportAdapter(formatId);
  } catch {
    return (
      <Alert color="gray" title="Export not available">
        No exporter is registered for {formatEntry?.label ?? formatId}.
      </Alert>
    );
  }

  if (isBinaryCpsExportAdapter(adapter)) {
    const imageFileName = adapter.defaultFileName;
    return (
      <Stack gap="sm">
        {egressSwitcher}
        <Text size="sm">
          Export as{' '}
          <Text span fw={600}>
            {formatEntry?.label ?? formatId}
          </Text>
          . This downloads one <code>{imageFileName}</code> image.
        </Text>
        {wireHint ? (
          <Text size="sm" c="dimmed">
            {wireHint}
          </Text>
        ) : null}
        {!hasChannels ? (
          <Text size="sm" c="dimmed">
            Add channels to the library before exporting this build.
          </Text>
        ) : null}
        <Button variant="filled" disabled={!hasChannels} onClick={() => setExportDialogOpen(true)}>
          Export…
        </Button>
        {exportDialog}
        <Text size="sm">
          Import a <code>{imageFileName}</code> into this project. Channels, zones, and the other
          library rows in the file are added.
        </Text>
        <FileButton
          onChange={(file) => void handleImportCodeplug(file)}
          accept=".bin,application/octet-stream"
          disabled={importingCodeplug || !activeProjectId}
        >
          {(props) => (
            <Button {...props} variant="light" loading={importingCodeplug}>
              Import {imageFileName}
            </Button>
          )}
        </FileButton>
        {codeplugImportMessage ? (
          <Text size="sm" c={codeplugImportFailed ? 'red' : undefined}>
            {codeplugImportMessage}
          </Text>
        ) : null}
        {codeplugImportWarnings.length > 0 ? (
          <Alert color="orange" title="Check these after the import">
            <List size="sm" spacing="xs">
              {codeplugImportWarnings.map((warning) => (
                <List.Item key={warning}>{warning}</List.Item>
              ))}
            </List>
          </Alert>
        ) : null}
      </Stack>
    );
  }

  if (isSingleFileCpsExportAdapter(adapter)) {
    const suggestedCsvName = defaultCpsSingleFileName(formatId, chirpExportProfileId);

    return (
      <Stack gap="sm">
        {egressSwitcher}
        <Text size="sm">
          Export as{' '}
          <Text span fw={600}>
            {formatEntry?.label ?? formatId}
          </Text>{' '}
          memory CSV. Choose the runtime profile in the export dialog when it opens.
        </Text>
        {!hasChannels ? (
          <Text size="sm" c="dimmed">
            Add channels to the library and memory list before exporting this build.
          </Text>
        ) : null}
        <Button variant="filled" disabled={!hasChannels} onClick={() => setExportDialogOpen(true)}>
          Export…
        </Button>
        {exportDialog}
        <Text size="sm" c="dimmed">
          Only analogue FM/AM channels are exported. Digital modes are skipped with a warning.
          Suggested filename: {suggestedCsvName}
        </Text>
        <Text size="sm" c="dimmed">
          Export name settings match the Channels page. Reorder memories on Channels.
        </Text>
      </Stack>
    );
  }

  if (!isMultiFileExportAdapter(adapter)) {
    return (
      <Alert color="gray" title="Export not available">
        No exporter delivery mode is registered for {formatEntry?.label ?? formatId}.
      </Alert>
    );
  }

  const showDm32PreferNeonPlug = formatId === 'dm32';

  return (
    <Stack gap="sm">
      {egressSwitcher}
      {showDm32PreferNeonPlug ? <Dm32PreferNeonPlugAlert /> : null}
      <Text size="sm">
        Export as{' '}
        <Text span fw={600}>
          {formatEntry?.label ?? formatId}
        </Text>{' '}
        CPS files using the active export pathway.
      </Text>
      {egressPaths.length <= 1 ? (
        <Text size="sm">
          <Text span fw={600}>
            Profile:{' '}
          </Text>
          {profileLabel}
        </Text>
      ) : null}
      {wireHint ? (
        <Text size="sm" c="dimmed">
          {wireHint}
        </Text>
      ) : null}
      {!hasChannels ? (
        <Text size="sm" c="dimmed">
          Add channels to the library before exporting this build.
        </Text>
      ) : null}
      {showDm32PreferNeonPlug ? <Dm32AprsSetupAlert exportFileNames={exportFileNames} /> : null}
      <Button variant="filled" disabled={!hasChannels} onClick={() => setExportDialogOpen(true)}>
        Export…
      </Button>
      {exportDialog}
      {formatId === 'neonplug' ? (
        <Text size="sm" c="dimmed">
          NeonPlug export is a single <code>.neonplug</code> ZIP containing{' '}
          <code>codeplug.json</code>. Upload a radio-read donor in the export dialog when merging
          for radio write.
        </Text>
      ) : null}
      <Text size="sm" c="dimmed">
        Wire preview pages show the same export settings. Switch export pathway above when this
        radio supports multiple CPS targets.
      </Text>
    </Stack>
  );
}
