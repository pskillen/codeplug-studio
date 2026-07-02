import { useState } from 'react';
import { Alert, Button, Modal, Stack, Text } from '@mantine/core';
import {
  defaultLocalExportFileName,
  suggestExportDestination,
} from '@core/services/interchangeMeta.ts';
import { googleDrivePort } from '@integrations/cloud/index.ts';
import { saveDriveLastFolderId, saveDriveLastFolderPath } from '@integrations/cloud/drivePrefs.ts';
import { exportProjectToYaml } from '../../services/projectImportExportService.ts';
import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';
import { useProjects } from '../../state/useProjects.ts';
import DriveBrowserModal, { type DriveSaveTarget } from './DriveBrowserModal.tsx';

export default function ExportToDrivePanel() {
  const { activeProjectId, activeProject, refreshProjects } = useProjects();
  const { connected, isConfigured } = useGoogleDrive();
  const [browserOpen, setBrowserOpen] = useState(false);
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<DriveSaveTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const suggestedFileName = activeProject
    ? (suggestExportDestination(activeProject, 'googleDrive')?.fileName ??
      defaultLocalExportFileName(activeProject.name))
    : '';
  const interchangeFolderId = activeProject?.interchange?.googleDrive?.folderId;

  async function saveToDrive(target: DriveSaveTarget, existingFileId?: string) {
    if (!activeProjectId) return;
    setSaving(true);
    setError(null);
    try {
      let fileId = existingFileId;
      let content: string;

      if (fileId) {
        const exportResult = await exportProjectToYaml(activeProjectId, {
          fileName: target.fileName,
          recordDestination: 'googleDrive',
          driveDestination: {
            folderId: target.folderId,
            folderName: target.folderName,
            fileId,
          },
        });
        content = exportResult.content;
      } else {
        const initialExport = await exportProjectToYaml(activeProjectId, {
          fileName: target.fileName,
        });
        const created = await googleDrivePort.writeFile({
          parentId: target.folderId,
          fileName: target.fileName,
          content: initialExport.content,
        });
        fileId = created.id;
        const finalExport = await exportProjectToYaml(activeProjectId, {
          fileName: target.fileName,
          recordDestination: 'googleDrive',
          driveDestination: {
            folderId: target.folderId,
            folderName: target.folderName,
            fileId,
          },
        });
        content = finalExport.content;
      }

      await googleDrivePort.writeFile({
        parentId: target.folderId,
        fileName: target.fileName,
        content,
        fileId,
      });

      saveDriveLastFolderId(target.folderId);
      saveDriveLastFolderPath(target.path);
      await refreshProjects();
      setBrowserOpen(false);
      setOverwriteOpen(false);
      setPendingTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function handleSaveTarget(target: DriveSaveTarget) {
    if (target.existingFileId) {
      setPendingTarget(target);
      setOverwriteOpen(true);
      return;
    }
    void saveToDrive(target);
  }

  if (!activeProjectId) {
    return <Alert color="gray">Select a project to export.</Alert>;
  }

  return (
    <Stack gap="sm">
      {!isConfigured ? (
        <Alert color="yellow">Google Drive is not configured for this build.</Alert>
      ) : null}
      {connected ? null : (
        <Alert color="gray">Connect Google Drive in Settings before saving files.</Alert>
      )}
      {error ? <Alert color="red">{error}</Alert> : null}
      <Button disabled={!connected || saving} onClick={() => setBrowserOpen(true)}>
        Save to Drive
      </Button>
      <DriveBrowserModal
        opened={browserOpen}
        onClose={() => setBrowserOpen(false)}
        mode="save"
        interchangeFolderId={interchangeFolderId}
        defaultFileName={suggestedFileName}
        onSelectFile={() => undefined}
        onSaveTarget={handleSaveTarget}
      />
      <Modal
        opened={overwriteOpen}
        onClose={() => {
          if (!saving) {
            setOverwriteOpen(false);
            setPendingTarget(null);
          }
        }}
        title="Overwrite file on Drive?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            <strong>{pendingTarget?.fileName}</strong> already exists in this folder. Overwrite it?
          </Text>
          <Button
            color="red"
            loading={saving}
            onClick={() => {
              if (pendingTarget?.existingFileId) {
                void saveToDrive(pendingTarget, pendingTarget.existingFileId);
              }
            }}
          >
            Overwrite
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
