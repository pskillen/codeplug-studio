import { useEffect, useState } from 'react';
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { IconDownload, IconPackage } from '@tabler/icons-react';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import { traitProfileFor } from '@core/models/traits.ts';
import { formatCatalogEntry } from '@core/import-export/registry.ts';
import { getExportAdapter } from '@core/import-export/registry.ts';
import { isMultiFileExportAdapter } from '@core/import-export/exportAdapter.ts';
import { formatProfileWireHint } from '@core/import-export/formatProfiles.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { saveDriveLastFolderId, saveDriveLastFolderPath } from '@integrations/cloud/drivePrefs.ts';
import DriveBrowserModal, { type DriveSaveTarget } from '../import-export/DriveBrowserModal.tsx';
import GoogleDriveButton from '../import-export/GoogleDriveButton.tsx';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';
import { useProjects } from '../../state/useProjects.ts';
import { persistence } from '../../state/persistence.ts';
import {
  defaultCpsZipFileName,
  downloadCpsFile,
  downloadCpsZip,
  uploadCpsZipToDrive,
} from '../../services/buildCpsExportService.ts';

export interface ExportBuildCpsPanelProps {
  build: FormatBuild;
}

export default function ExportBuildCpsPanel({ build }: ExportBuildCpsPanelProps) {
  const { activeProjectId, activeProject } = useProjects();
  const { connected, isConfigured } = useGoogleDrive();
  const formatEntry = formatCatalogEntry(build.formatId as FormatId);
  const profileLabel = traitProfileFor(build.profileId)?.label ?? build.profileId;
  const wireHint = formatProfileWireHint(build.formatId as FormatId, build.profileId);

  const [channelCount, setChannelCount] = useState<number | null>(null);
  const [exportWarnings, setExportWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [driveBrowserOpen, setDriveBrowserOpen] = useState(false);
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [pendingDriveTarget, setPendingDriveTarget] = useState<DriveSaveTarget | null>(null);

  const exportOptions = { profileId: build.profileId };
  const hasChannels = Boolean(activeProjectId) && (channelCount ?? 0) > 0;
  const exportShipped = formatEntry?.exportStatus === 'shipped';
  const interchangeFolderId = activeProject?.interchange?.googleDrive?.folderId;
  const suggestedZipName = defaultCpsZipFileName(build.name, build.formatId as FormatId);

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    void persistence.listChannels(activeProjectId).then((channels) => {
      if (!cancelled) setChannelCount(channels.length);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, build.id]);

  function mergeWarnings(warnings: string[]) {
    if (warnings.length) {
      setExportWarnings((prev) => [...new Set([...prev, ...warnings])]);
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
      const result = await uploadCpsZipToDrive(
        activeProjectId,
        build.id,
        {
          folderId: target.folderId,
          fileName: target.fileName,
          existingFileId: target.existingFileId,
        },
        exportOptions,
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

  if (!isMultiFileExportAdapter(adapter)) {
    return (
      <Alert color="gray">
        {formatEntry?.label ?? build.formatId} uses a single-file export path — not wired on build
        detail yet.
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
      {!hasChannels ? (
        <Text size="sm" c="dimmed">
          Add channels to the library before exporting this build.
        </Text>
      ) : null}
      {error ? <Alert color="red">{error}</Alert> : null}
      {exportWarnings.length > 0 ? (
        <Alert color="yellow" title="Export warnings">
          <Stack gap={4}>
            {exportWarnings.map((warning) => (
              <Text key={warning} size="sm">
                {warning}
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}
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
        {!isConfigured ? (
          <Alert color="yellow" p="xs">
            Google Drive is not configured for this build.
          </Alert>
        ) : connected ? (
          <GoogleDriveButton
            disabled={!hasChannels || exporting}
            loading={exporting}
            onClick={() => setDriveBrowserOpen(true)}
          >
            Save ZIP to Drive
          </GoogleDriveButton>
        ) : (
          <Text size="sm" c="dimmed">
            Connect Google Drive in Settings to upload exports.
          </Text>
        )}
      </Group>
      <Stack gap={4}>
        <Text size="sm" fw={600}>
          Individual files
        </Text>
        <Group gap="xs">
          {adapter.fileNames.map((fileName) => (
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
        Change profile in the Target section above if needed. Zone grouping and name shortening
        follow in later slices.
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
