import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Group, Modal, SegmentedControl, Stack, Text } from '@mantine/core';
import { IconDownload, IconPackage, IconTable } from '@tabler/icons-react';
import type { BuildExportSettings, RadioBuild } from '@core/models/formatBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import { traitProfileFor } from '@core/models/traits.ts';
import {
  formatCatalogEntry,
  getExportAdapter,
  getFormatExportDefaults,
} from '@core/import-export/registry.ts';
import {
  isMultiFileExportAdapter,
  isSingleFileCpsExportAdapter,
} from '@core/import-export/exportAdapter.ts';
import { formatProfileWireHint, getFormatProfiles } from '@core/import-export/formatProfiles.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { resolveChirpExportProfileId } from '@core/import-export/formats/chirp/profiles.ts';
import type { CpsAppExportOptions } from '../../services/buildCpsExportService.ts';
import ExportBuildSettingsSections from './ExportBuildSettingsSections.tsx';
import ProfilePicker from './ProfilePicker.tsx';
import CpsCsvPreviewModal from './CpsCsvPreviewModal.tsx';
import ExportWarningsAlert from './ExportWarningsAlert.tsx';
import Dm32PreferNeonPlugAlert from './Dm32PreferNeonPlugAlert.tsx';
import ChirpUv5rPreferNeonPlugAlert from './ChirpUv5rPreferNeonPlugAlert.tsx';
import Dm32AprsSetupAlert from './Dm32AprsSetupAlert.tsx';
import BuildRadioIoPanel from './BuildRadioIoPanel.tsx';
import { saveDriveLastFolderId, saveDriveLastFolderPath } from '@integrations/cloud/drivePrefs.ts';
import DriveBrowserModal, { type DriveSaveTarget } from '../import-export/DriveBrowserModal.tsx';
import GoogleDriveActionButton from '../import-export/GoogleDriveActionButton.tsx';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import { resolvedBuildExportSettings } from '../../lib/buildExportSettingsUi.ts';
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
  downloadCpsFile,
  downloadCpsSingleFile,
  downloadCpsZip,
  extractNeonplugDonorFromZip,
  isNeonplugDonorBag,
  uploadCpsZipToDrive,
  validateNeonplugDonorBase,
} from '../../services/buildCpsExportService.ts';
import { useBuildCpsExportFileNames } from '../../hooks/useBuildCpsExportFileNames.ts';
import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';

export interface ExportBuildCpsPanelProps {
  build: RadioBuild;
}

const buildService = new BuildService(persistence);

function egressPathLabel(path: EgressPath): string {
  if (path.label?.trim()) return path.label.trim();
  const formatLabel = formatCatalogEntry(path.formatId as FormatId)?.label ?? path.formatId;
  const profile = traitProfileFor(path.profileId)?.label ?? path.profileId;
  return `${formatLabel} — ${profile}`;
}

export default function ExportBuildCpsPanel({ build }: ExportBuildCpsPanelProps) {
  const { activeProjectId, activeProject } = useProjects();
  const { activeEgress, egressPaths, setActiveEgressId, reloadEgressPaths } = useBuildLayout();
  const { withDriveAuthRetry } = useGoogleDrive();
  const { putBuild } = useFormatBuilds();

  const formatId = (activeEgress?.formatId ?? 'opengd77') as FormatId;
  const profileId = activeEgress?.profileId ?? '';
  const formatEntry = formatCatalogEntry(formatId);
  const profileLabel = traitProfileFor(profileId)?.label ?? profileId;
  const wireHint = formatProfileWireHint(formatId, profileId);
  const formatDefaults = getFormatExportDefaults(formatId);
  const resolvedSettings = resolvedBuildExportSettings(build, formatId);

  const [channelCount, setChannelCount] = useState<number | null>(null);
  const [exportWarnings, setExportWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [driveBrowserOpen, setDriveBrowserOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
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
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [pendingDriveTarget, setPendingDriveTarget] = useState<DriveSaveTarget | null>(null);
  const [neonplugBaseBytes, setNeonplugBaseBytes] = useState<Uint8Array | null>(null);
  const [neonplugBaseFileName, setNeonplugBaseFileName] = useState<string | null>(null);
  const [neonplugBaseError, setNeonplugBaseError] = useState<string | null>(null);
  const neonplugBaseInputRef = useRef<HTMLInputElement>(null);
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
        formatId === 'chirp'
          ? defaultCpsSingleFileName(formatId, chirpExportProfileId)
          : undefined,
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
  const isNeonplug = formatId === 'neonplug';
  /** Persist donor retain on the egress path for all NeonPlug profiles (DM32UV + UV5R-Mini). */
  const persistNeonplugDonor = isNeonplug;
  const storedNeonplugDonor = persistNeonplugDonor
    ? isNeonplugDonorBag(activeEgress?.hydration)
      ? activeEgress.hydration
      : null
    : null;
  const hasNeonplugMergeDonor = Boolean(neonplugBaseBytes) || Boolean(storedNeonplugDonor);
  const archiveDownloadLabel = isNeonplug ? 'Download .neonplug' : 'Download ZIP';
  const archiveDriveLabel = isNeonplug ? 'Save .neonplug to Drive' : 'Save ZIP to Drive';
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

  function mergeWarnings(warnings: string[]) {
    if (warnings.length) {
      setExportWarnings((prev) => [...new Set([...prev, ...warnings])]);
    }
  }

  async function handleExportSettingsPatch(
    patch: Partial<BuildExportSettings>,
    expectedRevision = build.revision,
  ): Promise<boolean> {
    setSavingSettings(true);
    setSettingsError(null);
    const next = buildService.withExportSettings(build, patch);
    const result = await putBuild(next, expectedRevision);
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

  async function handleDownloadSingleFile() {
    if (!activeProjectId) return;
    setExporting(true);
    setError(null);
    try {
      const result = await downloadCpsSingleFile(activeProjectId, build.id, runtimeExportOverrides);
      mergeWarnings(result.warnings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadFile(fileName: string) {
    if (!activeProjectId) return;
    setExporting(true);
    setError(null);
    try {
      const result = await downloadCpsFile(
        activeProjectId,
        build.id,
        fileName,
        runtimeExportOverrides,
      );
      mergeWarnings(result.warnings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadZip(baseNeonplugBytes?: Uint8Array) {
    if (!activeProjectId) return;
    setExporting(true);
    setError(null);
    try {
      const result = await downloadCpsZip(activeProjectId, build.id, {
        ...runtimeExportOverrides,
        fileName: suggestedZipName,
        baseNeonplugBytes,
      });
      mergeWarnings(result.warnings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  async function saveZipToDrive(target: DriveSaveTarget, baseNeonplugBytes?: Uint8Array) {
    if (!activeProjectId) return;
    setExporting(true);
    setError(null);
    try {
      const result = await withDriveAuthRetry(() =>
        uploadCpsZipToDrive(
          activeProjectId,
          build.id,
          {
            folderId: target.folderId,
            fileName: target.fileName,
            existingFileId: target.existingFileId,
          },
          {
            ...runtimeExportOverrides,
            baseNeonplugBytes,
          },
        ),
      );
      mergeWarnings(result.warnings);
      saveDriveLastFolderId(target.folderId);
      saveDriveLastFolderPath(target.path);
      setDriveBrowserOpen(false);
      setOverwriteOpen(false);
      setPendingDriveTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  async function handleNeonplugBaseFileChange(file: File | null) {
    setNeonplugBaseError(null);
    if (!file) {
      setNeonplugBaseBytes(null);
      setNeonplugBaseFileName(null);
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { warnings } = validateNeonplugDonorBase(bytes, profileId);
      mergeWarnings(warnings);
      setNeonplugBaseBytes(bytes);
      setNeonplugBaseFileName(file.name);

      if (persistNeonplugDonor && activeEgress) {
        const bag = extractNeonplugDonorFromZip(bytes, { sourceFileName: file.name });
        setSavingSettings(true);
        setSettingsError(null);
        const next = buildService.withEgressHydration(activeEgress, bag);
        const result = await buildService.putEgressPath(next, activeEgress.revision);
        if (!result.ok) {
          setSettingsError(
            result.reason === 'revision_conflict'
              ? 'Egress changed elsewhere — reload and try again.'
              : 'Could not save donor settings on this pathway.',
          );
        } else {
          await reloadEgressPaths();
        }
        setSavingSettings(false);
      }
    } catch (err) {
      setNeonplugBaseBytes(null);
      setNeonplugBaseFileName(null);
      setNeonplugBaseError(err instanceof Error ? err.message : String(err));
      setSavingSettings(false);
    }
  }

  async function handleClearStoredNeonplugDonor() {
    if (!persistNeonplugDonor || !storedNeonplugDonor || !activeEgress) return;
    setSavingSettings(true);
    setSettingsError(null);
    setNeonplugBaseBytes(null);
    setNeonplugBaseFileName(null);
    try {
      const next = buildService.clearEgressHydration(activeEgress);
      const result = await buildService.putEgressPath(next, activeEgress.revision);
      if (!result.ok) {
        setSettingsError(
          result.reason === 'revision_conflict'
            ? 'Egress changed elsewhere — reload and try again.'
            : 'Could not clear donor settings.',
        );
      } else {
        await reloadEgressPaths();
      }
    } finally {
      setSavingSettings(false);
    }
  }

  function handleDriveSaveTarget(target: DriveSaveTarget) {
    if (target.existingFileId) {
      setPendingDriveTarget(target);
      setOverwriteOpen(true);
      return;
    }
    void saveZipToDrive(target, isNeonplug ? (neonplugBaseBytes ?? undefined) : undefined);
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
    const next = buildService.withDefaultEgressPathId(build, egressId);
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
      <Stack gap={4}>
        <Text size="sm" fw={600}>
          Export pathway
        </Text>
        <SegmentedControl
          value={activeEgress.id}
          data={egressPaths.map((path) => ({
            value: path.id,
            label: egressPathLabel(path),
          }))}
          onChange={(id) => void handleActiveEgressChange(id)}
        />
      </Stack>
    ) : null;

  if (formatId === 'radio-io') {
    return (
      <Stack gap="sm">
        {egressSwitcher}
        <Text size="sm">
          Direct radio via Web Serial for{' '}
          <Text span fw={600}>
            {profileLabel}
          </Text>
          . There is no CPS file export for this pathway — use Connect / Read / Write below. Curate
          channels on the library and this build&apos;s memory list; Write runs assemble into a
          previously Read clone image.
        </Text>
        {wireHint ? (
          <Text size="sm" c="dimmed">
            {wireHint}
          </Text>
        ) : null}
        <ExportBuildSettingsSections
          build={build}
          formatId={formatId}
          profileId={profileId}
          saving={savingSettings}
          settingsError={settingsError}
          profileNameLimit={profileNameLimit}
          resolvedSettings={resolvedSettings}
          formatDefaults={formatDefaults}
          defaultScanValue={defaultScanValue}
          onExportSettingsPatch={(patch) => void handleExportSettingsPatch(patch)}
          onExportInclusionChange={(field, checked) =>
            void handleExportInclusionChange(field, checked)
          }
        />
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

  if (isSingleFileCpsExportAdapter(adapter)) {
    const suggestedCsvName = defaultCpsSingleFileName(formatId, chirpExportProfileId);
    const profileOverridesBuild = chirpExportProfileId !== profileId;

    const showChirpUv5rPreferNeonPlug =
      formatId === 'chirp' && chirpExportProfileId === 'chirp-uv5r';

    return (
      <Stack gap="sm">
        {egressSwitcher}
        {showChirpUv5rPreferNeonPlug ? <ChirpUv5rPreferNeonPlugAlert /> : null}
        <Text size="sm">
          Export as{' '}
          <Text span fw={600}>
            {formatEntry?.label ?? formatId}
          </Text>{' '}
          memory CSV using the profile below.
        </Text>
        <ProfilePicker
          mode="select"
          formatId={formatId}
          value={chirpExportProfileId}
          onChange={setExportProfileId}
          description="CHIRP memory layout and power ladder for target hardware"
        />
        {profileOverridesBuild ? (
          <Text size="sm" c="dimmed">
            Export uses {traitProfileFor(chirpExportProfileId)?.label ?? chirpExportProfileId}; pathway
            default is {profileLabel}.
          </Text>
        ) : null}
        <ExportBuildSettingsSections
          build={build}
          formatId={formatId}
          profileId={profileId}
          saving={savingSettings}
          settingsError={settingsError}
          profileNameLimit={profileNameLimit}
          resolvedSettings={resolvedSettings}
          formatDefaults={formatDefaults}
          defaultScanValue={defaultScanValue}
          onExportSettingsPatch={(patch) => void handleExportSettingsPatch(patch)}
          onExportInclusionChange={(field, checked) =>
            void handleExportInclusionChange(field, checked)
          }
        />
        {!hasChannels ? (
          <Text size="sm" c="dimmed">
            Add channels to the library and memory list before exporting this build.
          </Text>
        ) : null}
        {error ? <Alert color="red">{error}</Alert> : null}
        {exportWarnings.length > 0 ? <ExportWarningsAlert warnings={exportWarnings} /> : null}
        {showChirpUv5rPreferNeonPlug ? <ChirpUv5rPreferNeonPlugAlert /> : null}
        <Group gap="xs">
          <Button
            leftSection={<IconDownload size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
            variant="filled"
            disabled={!hasChannels || exporting}
            loading={exporting}
            onClick={() => void handleDownloadSingleFile()}
          >
            Download CSV
          </Button>
          <Button
            variant="outline"
            leftSection={<IconTable size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
            disabled={!hasChannels || exporting}
            onClick={() => setPreviewOpen(true)}
          >
            Preview CSV
          </Button>
        </Group>
        <Text size="sm" c="dimmed">
          Only analogue FM/AM channels are exported. Digital modes are skipped with a warning.
          Suggested filename: {suggestedCsvName}
        </Text>
        <Text size="sm" c="dimmed">
          Export name settings match the Channels page. Reorder memories on Channels.
        </Text>
        <CpsCsvPreviewModal
          opened={previewOpen}
          onClose={() => setPreviewOpen(false)}
          build={build}
          formatId={formatId}
          profileId={profileId}
          exportOptions={runtimeExportOverrides}
        />
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
      <ExportBuildSettingsSections
        build={build}
        formatId={formatId}
        profileId={profileId}
        saving={savingSettings}
        settingsError={settingsError}
        profileNameLimit={profileNameLimit}
        resolvedSettings={resolvedSettings}
        formatDefaults={formatDefaults}
        defaultScanValue={defaultScanValue}
        onExportSettingsPatch={(patch) => void handleExportSettingsPatch(patch)}
        onExportInclusionChange={(field, checked) =>
          void handleExportInclusionChange(field, checked)
        }
      />
      {!hasChannels ? (
        <Text size="sm" c="dimmed">
          Add channels to the library before exporting this build.
        </Text>
      ) : null}
      {error ? <Alert color="red">{error}</Alert> : null}
      {showDm32PreferNeonPlug ? <Dm32AprsSetupAlert exportFileNames={exportFileNames} /> : null}
      {exportWarnings.length > 0 ? <ExportWarningsAlert warnings={exportWarnings} /> : null}
      {isNeonplug ? (
        <Stack gap="md">
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Merge into radio-read base
            </Text>
            <Text size="sm">
              Merge Studio channels and organisation into a radio-read donor so NeonPlug keeps
              settings and operator DMR IDs:
            </Text>
            <Text size="sm" component="div">
              <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                <li>In NeonPlug, read the codeplug from the radio.</li>
                <li>
                  Export a <code>.neonplug</code> file from NeonPlug.
                </li>
                <li>Upload that donor file here.</li>
                <li>Download the merged file for radio write.</li>
                <li>Import the merged file in NeonPlug.</li>
                <li>Write the codeplug back to the radio.</li>
              </ol>
            </Text>
            <input
              ref={neonplugBaseInputRef}
              type="file"
              accept=".neonplug,application/zip"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void handleNeonplugBaseFileChange(file);
                event.target.value = '';
              }}
            />
            <Group gap="xs">
              <Button
                variant="light"
                size="sm"
                disabled={exporting || savingSettings}
                onClick={() => neonplugBaseInputRef.current?.click()}
              >
                {neonplugBaseFileName || storedNeonplugDonor
                  ? 'Replace donor .neonplug'
                  : 'Upload donor .neonplug'}
              </Button>
              {neonplugBaseFileName ? (
                <Text size="sm" c="dimmed">
                  Session: {neonplugBaseFileName}
                </Text>
              ) : storedNeonplugDonor ? (
                <Text size="sm" c="dimmed">
                  Stored
                  {storedNeonplugDonor.sourceFileName
                    ? `: ${storedNeonplugDonor.sourceFileName}`
                    : ' on this egress'}
                  {storedNeonplugDonor.capturedAt
                    ? ` (${new Date(storedNeonplugDonor.capturedAt).toLocaleString()})`
                    : ''}
                </Text>
              ) : null}
              {persistNeonplugDonor && storedNeonplugDonor ? (
                <Button
                  variant="subtle"
                  color="red"
                  size="compact-sm"
                  disabled={exporting || savingSettings}
                  loading={savingSettings}
                  onClick={() => void handleClearStoredNeonplugDonor()}
                >
                  Clear stored donor
                </Button>
              ) : null}
            </Group>
            {persistNeonplugDonor ? (
              <Text size="sm" c="dimmed">
                Donor settings are saved on this NeonPlug egress pathway for repeat exports. Upload
                once, then download for radio write without re-selecting the file.
              </Text>
            ) : null}
            {neonplugBaseError ? <Alert color="red">{neonplugBaseError}</Alert> : null}
            <Group gap="xs">
              <Button
                leftSection={<IconPackage size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
                variant="filled"
                disabled={!hasChannels || !hasNeonplugMergeDonor || exporting}
                loading={exporting}
                onClick={() => void handleDownloadZip(neonplugBaseBytes ?? undefined)}
              >
                Download for radio write
              </Button>
              <GoogleDriveActionButton
                disabled={!hasChannels || !hasNeonplugMergeDonor || exporting}
                loading={exporting}
                onClick={() => setDriveBrowserOpen(true)}
              >
                Save for radio write to Drive
              </GoogleDriveActionButton>
            </Group>
          </Stack>
          <Stack gap="xs">
            <Alert color="yellow" title="Greenfield download (not for radio write)">
              A Studio-only <code>.neonplug</code> omits radio settings, operator DMR IDs, and other
              unmodelled NeonPlug fields. Safe for browsing in NeonPlug — not safe to write back
              without merging into a donor base first.
            </Alert>
            <Button
              leftSection={<IconDownload size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
              variant="subtle"
              size="compact-sm"
              disabled={!hasChannels || exporting}
              loading={exporting}
              onClick={() => void handleDownloadZip()}
            >
              Download greenfield .neonplug
            </Button>
          </Stack>
          <Text size="sm" c="dimmed">
            NeonPlug export is a single <code>.neonplug</code> ZIP containing{' '}
            <code>codeplug.json</code>.
          </Text>
        </Stack>
      ) : (
        <>
          {showDm32PreferNeonPlug ? <Dm32PreferNeonPlugAlert /> : null}
          <Group gap="xs">
            <Button
              leftSection={<IconPackage size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
              variant="filled"
              disabled={!hasChannels || exporting}
              loading={exporting}
              onClick={() => void handleDownloadZip()}
            >
              {archiveDownloadLabel}
            </Button>
            <GoogleDriveActionButton
              disabled={!hasChannels || exporting}
              loading={exporting}
              onClick={() => setDriveBrowserOpen(true)}
            >
              {archiveDriveLabel}
            </GoogleDriveActionButton>
            <Button
              variant="outline"
              leftSection={<IconTable size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
              disabled={!hasChannels || exporting}
              onClick={() => setPreviewOpen(true)}
            >
              Preview CSV
            </Button>
          </Group>
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              Individual files
            </Text>
            <Group gap="xs">
              {exportFileNames.map((fileName) => (
                <Button
                  key={fileName}
                  size="xs"
                  variant="light"
                  leftSection={<IconDownload size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
                  disabled={!hasChannels || exporting}
                  onClick={() => void handleDownloadFile(fileName)}
                >
                  {fileName}
                </Button>
              ))}
            </Group>
          </Stack>
        </>
      )}
      <Text size="sm" c="dimmed">
        Wire preview pages show the same export settings. Switch export pathway above when this
        radio supports multiple CPS targets.
      </Text>
      <DriveBrowserModal
        opened={driveBrowserOpen}
        onClose={() => setDriveBrowserOpen(false)}
        mode="save"
        interchangeFolderId={interchangeFolderId}
        defaultFileName={suggestedZipName}
        saveConflictKind="zip"
        saving={exporting}
        onSelectFile={() => {}}
        onSaveTarget={handleDriveSaveTarget}
      />
      <CpsCsvPreviewModal
        opened={previewOpen}
        onClose={() => setPreviewOpen(false)}
        build={build}
        formatId={formatId}
        profileId={profileId}
        exportOptions={runtimeExportOverrides}
      />
      <Modal
        opened={overwriteOpen}
        onClose={() => {
          setOverwriteOpen(false);
          setPendingDriveTarget(null);
        }}
        title="Overwrite file?"
        centered
      >
        <Stack gap="sm">
          <Text size="sm">
            {pendingDriveTarget?.fileName} already exists in this folder. Overwrite it?
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setOverwriteOpen(false);
                setPendingDriveTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color="red"
              loading={exporting}
              onClick={() => {
                if (pendingDriveTarget) {
                  void saveZipToDrive(
                    pendingDriveTarget,
                    isNeonplug ? (neonplugBaseBytes ?? undefined) : undefined,
                  );
                }
              }}
            >
              Overwrite
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
