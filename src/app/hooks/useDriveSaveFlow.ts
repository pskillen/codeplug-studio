import { useCallback, useState } from 'react';
import type { GoogleDriveInterchange } from '@core/models/interchange.ts';
import type { DriveSaveConflict } from '@core/services/driveSaveConflict.ts';
import {
  defaultLocalExportFileName,
  portableSyncedAt,
  suggestExportDestination,
} from '@core/services/interchangeMeta.ts';
import { importProjectFromYaml } from '../services/projectImportExportService.ts';
import { saveDriveLastFolderId, saveDriveLastFolderPath } from '@integrations/cloud/drivePrefs.ts';
import type { DriveSaveTarget } from '../components/import-export/DriveBrowserModal.tsx';
import { assessDriveSaveConflict } from '../services/driveSaveConflictService.ts';
import {
  exportProjectToYaml,
  recordProjectImportDestination,
} from '../services/projectImportExportService.ts';
import {
  executeSaveProjectToDrive,
  recordDrivePortableSyncAfterWrite,
} from '../services/saveProjectToDriveService.ts';
import { useGoogleDrive } from './useGoogleDrive.ts';
import { useProjectPortableDirty } from './useProjectPortableDirty.ts';
import { useProjects } from '../state/useProjects.ts';

export interface UseDriveSaveFlowOptions {
  onSaved?: () => void;
}

export function useDriveSaveFlow(options: UseDriveSaveFlowOptions = {}) {
  const { activeProjectId, activeProject, refreshProjects } = useProjects();
  const { port, withDriveAuthRetry } = useGoogleDrive();
  const { refresh: refreshDirty } = useProjectPortableDirty(
    activeProjectId,
    activeProject ?? undefined,
  );

  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflict, setConflict] = useState<DriveSaveConflict | null>(null);
  const [pendingDrive, setPendingDrive] = useState<GoogleDriveInterchange | null>(null);
  const [pendingBrowseTarget, setPendingBrowseTarget] = useState<DriveSaveTarget | null>(null);
  const [saveAsBrowserOpen, setSaveAsBrowserOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectId = activeProjectId;
  const projectName = activeProject?.name ?? '';

  const closeConflict = useCallback(() => {
    setConflictOpen(false);
    setConflict(null);
    setPendingDrive(null);
    setPendingBrowseTarget(null);
    setError(null);
  }, []);

  const notifySaved = useCallback(() => {
    options.onSaved?.();
  }, [options]);

  async function runLinkedSave(
    drive: GoogleDriveInterchange,
    force: boolean,
    browseTarget?: DriveSaveTarget,
  ): Promise<boolean> {
    if (!projectId || !activeProject) return false;
    setSaving(true);
    setError(null);
    try {
      if (!force) {
        const assessment = await withDriveAuthRetry(() =>
          assessDriveSaveConflict({
            port,
            localProjectId: projectId,
            localSyncedAt: portableSyncedAt(activeProject),
            drive,
          }),
        );
        if (assessment.conflict) {
          setConflict(assessment.conflict);
          setPendingDrive(drive);
          setPendingBrowseTarget(browseTarget ?? null);
          setConflictOpen(true);
          return false;
        }
      }
      await withDriveAuthRetry(() =>
        executeSaveProjectToDrive(port, { projectId, drive, force: true }),
      );
      if (browseTarget) {
        saveDriveLastFolderId(browseTarget.folderId);
        saveDriveLastFolderPath(browseTarget.path);
      }
      await refreshProjects();
      await refreshDirty();
      closeConflict();
      setSaveAsBrowserOpen(false);
      notifySaved();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function startSaveToDrive(drive: GoogleDriveInterchange) {
    await runLinkedSave(drive, false);
  }

  async function startOverwriteToTarget(
    target: DriveSaveTarget,
    existingFileId: string,
  ): Promise<boolean> {
    if (!activeProject) return false;
    const drive: GoogleDriveInterchange = {
      folderId: target.folderId,
      folderName: target.folderName,
      fileId: existingFileId,
      fileName: target.fileName,
      exportedAt: activeProject.interchange?.googleDrive?.exportedAt ?? '',
    };
    return runLinkedSave(drive, false, target);
  }

  async function confirmSaveAnyway() {
    if (!pendingDrive) return;
    await runLinkedSave(pendingDrive, true, pendingBrowseTarget ?? undefined);
  }

  async function confirmRefreshFromDrive() {
    if (!projectId || !conflict || !pendingDrive) return;
    setSaving(true);
    setError(null);
    try {
      const idMismatch = conflict.kinds.includes('projectIdMismatch');
      const mode = idMismatch
        ? ({ kind: 'adoptRemote', projectId } as const)
        : ({ kind: 'replaceExisting', projectId } as const);
      await importProjectFromYaml(conflict.remoteYaml, mode);
      const metadata = await withDriveAuthRetry(() => port.getFileMetadata(pendingDrive.fileId));
      await recordProjectImportDestination(projectId, {
        destination: 'googleDrive',
        fileName: pendingDrive.fileName,
        folderId: pendingDrive.folderId,
        folderName: pendingDrive.folderName,
        fileId: pendingDrive.fileId,
        syncedAt: metadata.modifiedTime ?? new Date().toISOString(),
        remoteProjectId: conflict.remoteProjectId,
      });
      await refreshProjects();
      await refreshDirty();
      closeConflict();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function openSaveAsNew() {
    setSaveAsBrowserOpen(true);
  }

  async function saveToNewTarget(target: DriveSaveTarget): Promise<boolean> {
    if (!projectId) return false;
    if (target.existingFileId) {
      return startOverwriteToTarget(target, target.existingFileId);
    }
    setSaving(true);
    setError(null);
    try {
      const initialExport = await exportProjectToYaml(projectId, {
        fileName: target.fileName,
      });
      const created = await withDriveAuthRetry(() =>
        port.writeFile({
          parentId: target.folderId,
          fileName: target.fileName,
          content: initialExport.content,
        }),
      );
      const writeResult = await withDriveAuthRetry(() =>
        port.writeFile({
          parentId: target.folderId,
          fileName: target.fileName,
          content: initialExport.content,
          fileId: created.id,
        }),
      );
      await recordDrivePortableSyncAfterWrite(
        port,
        projectId,
        {
          fileName: target.fileName,
          folderId: target.folderId,
          folderName: target.folderName,
          fileId: created.id,
        },
        writeResult,
        projectId,
      );
      saveDriveLastFolderId(target.folderId);
      saveDriveLastFolderPath(target.path);
      await refreshProjects();
      await refreshDirty();
      closeConflict();
      setSaveAsBrowserOpen(false);
      notifySaved();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  const suggestedFileName = activeProject
    ? (suggestExportDestination(activeProject, 'googleDrive')?.fileName ??
      defaultLocalExportFileName(activeProject.name))
    : '';
  const interchangeFolderId = activeProject?.interchange?.googleDrive?.folderId;

  return {
    saving,
    error,
    conflictOpen,
    conflict,
    projectName,
    saveAsBrowserOpen,
    setSaveAsBrowserOpen,
    suggestedFileName,
    interchangeFolderId,
    startSaveToDrive,
    startOverwriteToTarget,
    confirmSaveAnyway,
    confirmRefreshFromDrive,
    openSaveAsNew,
    saveToNewTarget,
    closeConflict,
  };
}
