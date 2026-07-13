import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { IconDownload, IconPackage, IconTable } from '@tabler/icons-react';
import type { BuildExportSettings, FormatBuild } from '@core/models/formatBuild.ts';
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
import { mergeExportOptions } from '@core/services/exportBuild.ts';
import ExportBuildSettingsSections from './ExportBuildSettingsSections.tsx';
import ProfilePicker from './ProfilePicker.tsx';
import CpsCsvPreviewModal from './CpsCsvPreviewModal.tsx';
import ExportWarningsAlert from './ExportWarningsAlert.tsx';
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
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';
import {
  defaultCpsSingleFileName,
  defaultCpsZipFileName,
  downloadCpsFile,
  downloadCpsSingleFile,
  downloadCpsZip,
  uploadCpsZipToDrive,
} from '../../services/buildCpsExportService.ts';
import { useBuildCpsExportFileNames } from '../../hooks/useBuildCpsExportFileNames.ts';
import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';

export interface ExportBuildCpsPanelProps {
  build: FormatBuild;
}

const buildService = new BuildService(persistence);

export default function ExportBuildCpsPanel({ build }: ExportBuildCpsPanelProps) {
  const { activeProjectId, activeProject } = useProjects();
  const { withDriveAuthRetry } = useGoogleDrive();
  const { putBuild } = useFormatBuilds();
  const formatEntry = formatCatalogEntry(build.formatId as FormatId);
  const profileLabel = traitProfileFor(build.profileId)?.label ?? build.profileId;
  const wireHint = formatProfileWireHint(build.formatId as FormatId, build.profileId);
  const formatDefaults = getFormatExportDefaults(build.formatId);
  const resolvedSettings = resolvedBuildExportSettings(build);

  const [channelCount, setChannelCount] = useState<number | null>(null);
  const [exportWarnings, setExportWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [driveBrowserOpen, setDriveBrowserOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportProfileId, setExportProfileId] = useState(build.profileId);
  const [lastBuildProfileId, setLastBuildProfileId] = useState(build.profileId);
  if (build.profileId !== lastBuildProfileId) {
    setLastBuildProfileId(build.profileId);
    setExportProfileId(build.profileId);
  }
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [pendingDriveTarget, setPendingDriveTarget] = useState<DriveSaveTarget | null>(null);
  const migratedRef = useRef(false);

  const profileNameLimit = useMemo(() => {
    const options = getFormatProfiles(build.formatId as FormatId);
    const profileId = build.formatId === 'chirp' ? exportProfileId : build.profileId;
    return options.find((option) => option.profileId === profileId)?.nameLimit;
  }, [build.formatId, build.profileId, exportProfileId]);

  const exportOptions = useMemo(
    () =>
      mergeExportOptions(build, {
        profileId: exportProfileId,
        fileName:
          build.formatId === 'chirp'
            ? defaultCpsSingleFileName(build.formatId as FormatId, exportProfileId)
            : undefined,
      }),
    [build, exportProfileId],
  );
  const exportFileNames = useBuildCpsExportFileNames(build, exportOptions);
  const hasChannels = Boolean(activeProjectId) && (channelCount ?? 0) > 0;
  const exportShipped = formatEntry?.exportStatus === 'shipped';
  const interchangeFolderId = activeProject?.interchange?.googleDrive?.folderId;
  const suggestedZipName = defaultCpsZipFileName(build.name, build.formatId as FormatId);
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
    field: 'exportUnlinkedChannels' | 'exportUnlinkedTalkGroups' | 'exportUnlinkedRxGroupLists',
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
      const result = await downloadCpsSingleFile(activeProjectId, build.id, exportOptions);
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
      const result = await downloadCpsFile(activeProjectId, build.id, fileName, exportOptions);
      mergeWarnings(result.warnings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadZip() {
    if (!activeProjectId) return;
    setExporting(true);
    setError(null);
    try {
      const result = await downloadCpsZip(activeProjectId, build.id, {
        ...exportOptions,
        fileName: suggestedZipName,
      });
      mergeWarnings(result.warnings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  async function saveZipToDrive(target: DriveSaveTarget) {
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
          exportOptions,
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

  function handleDriveSaveTarget(target: DriveSaveTarget) {
    if (target.existingFileId) {
      setPendingDriveTarget(target);
      setOverwriteOpen(true);
      return;
    }
    void saveZipToDrive(target);
  }

  if (!exportShipped) {
    return (
      <Alert color="gray" title="Export not available yet">
        {formatEntry?.label ?? build.formatId} CPS export is planned. OpenGD77 CSV export is
        available on OpenGD77 builds.
      </Alert>
    );
  }

  let adapter;
  try {
    adapter = getExportAdapter(build.formatId as FormatId);
  } catch {
    return (
      <Alert color="gray" title="Export not available">
        No exporter is registered for {formatEntry?.label ?? build.formatId}.
      </Alert>
    );
  }

  if (isSingleFileCpsExportAdapter(adapter)) {
    const suggestedCsvName = defaultCpsSingleFileName(build.formatId as FormatId, exportProfileId);
    const profileOverridesBuild = exportProfileId !== build.profileId;

    return (
      <Stack gap="sm">
        <Text size="sm">
          Export as{' '}
          <Text span fw={600}>
            {formatEntry?.label ?? build.formatId}
          </Text>{' '}
          memory CSV using the profile below.
        </Text>
        <ProfilePicker
          mode="select"
          formatId={build.formatId as FormatId}
          value={exportProfileId}
          onChange={setExportProfileId}
          description="CHIRP memory layout and power ladder for target hardware"
        />
        {profileOverridesBuild ? (
          <Text size="sm" c="dimmed">
            Export uses {traitProfileFor(exportProfileId)?.label ?? exportProfileId}; build default
            is {profileLabel}.
          </Text>
        ) : null}
        <ExportBuildSettingsSections
          build={build}
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
          exportOptions={exportOptions}
        />
      </Stack>
    );
  }

  if (!isMultiFileExportAdapter(adapter)) {
    return (
      <Alert color="gray" title="Export not available">
        No exporter delivery mode is registered for {formatEntry?.label ?? build.formatId}.
      </Alert>
    );
  }

  return (
    <Stack gap="sm">
      <Text size="sm">
        Export as{' '}
        <Text span fw={600}>
          {formatEntry?.label ?? build.formatId}
        </Text>{' '}
        CPS files using the saved build profile.
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
      <ExportBuildSettingsSections
        build={build}
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
      {exportWarnings.length > 0 ? <ExportWarningsAlert warnings={exportWarnings} /> : null}
      <Group gap="xs">
        <Button
          leftSection={<IconPackage size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
          variant="filled"
          disabled={!hasChannels || exporting}
          loading={exporting}
          onClick={() => void handleDownloadZip()}
        >
          Download ZIP
        </Button>
        <GoogleDriveActionButton
          disabled={!hasChannels || exporting}
          loading={exporting}
          onClick={() => setDriveBrowserOpen(true)}
        >
          Save ZIP to Drive
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
      <Text size="sm" c="dimmed">
        Wire preview pages show the same export settings. Change profile in Overview if needed.
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
        exportOptions={exportOptions}
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
                if (pendingDriveTarget) void saveZipToDrive(pendingDriveTarget);
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
