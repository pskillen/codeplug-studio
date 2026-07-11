import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImportProjectYamlMode } from '@core/services/importProjectYaml.ts';
import { portableSyncedAt } from '@core/services/interchangeMeta.ts';
import { isRemotePortableNewer } from '@core/services/projectSyncSummary.ts';
import { buildImportOverwriteDiff } from '../services/yamlImportResolverService.ts';
import { parseYamlImportPreview } from '../services/yamlImportResolverService.ts';
import {
  importProjectFromYaml,
  recordProjectImportDestination,
} from '../services/projectImportExportService.ts';
import { persistence } from '../state/persistence.ts';
import { useGoogleDrive } from './useGoogleDrive.ts';
import { useProjects } from '../state/useProjects.ts';
import type { DriveOpenSelection } from '../components/import-export/DriveBrowserModal.tsx';

export interface LocalYamlImportSource {
  kind: 'localFile';
  fileName: string;
}

export interface DriveYamlImportSource {
  kind: 'googleDrive';
  fileId: string;
  fileName: string;
  folderId: string;
  folderName?: string;
  modifiedTime?: string;
}

export type YamlImportSource = LocalYamlImportSource | DriveYamlImportSource;

export interface UseYamlImportResolverOptions {
  /** When set, imports always target this project (replace-active panel). */
  activeProjectId?: string | null;
  onImported?: (projectId: string) => void;
}

export function useYamlImportResolver(options: UseYamlImportResolverOptions = {}) {
  const { projects, refreshProjects, switchProject } = useProjects();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [overwriteTitle, setOverwriteTitle] = useState('Overwrite local project?');
  const [overwriteProjectName, setOverwriteProjectName] = useState('');
  const [diffLines, setDiffLines] = useState<string[]>([]);
  const [idMismatch, setIdMismatch] = useState(false);
  const [localProjectId, setLocalProjectId] = useState('');
  const [remoteProjectId, setRemoteProjectId] = useState('');
  const pendingRef = useRef<{
    preview: ReturnType<typeof parseYamlImportPreview>;
    source: YamlImportSource;
    targetProjectId: string;
  } | null>(null);

  const resetOverwrite = useCallback(() => {
    setOverwriteOpen(false);
    pendingRef.current = null;
    setDiffLines([]);
    setIdMismatch(false);
    setLocalProjectId('');
    setRemoteProjectId('');
    setError(null);
  }, []);

  async function recordSource(projectId: string, source: YamlImportSource) {
    if (source.kind === 'localFile') {
      await recordProjectImportDestination(projectId, {
        destination: 'localFile',
        fileName: source.fileName,
      });
      return;
    }
    await recordProjectImportDestination(projectId, {
      destination: 'googleDrive',
      fileName: source.fileName,
      folderId: source.folderId,
      folderName: source.folderName,
      fileId: source.fileId,
      syncedAt: source.modifiedTime,
    });
  }

  async function runImport(
    yamlText: string,
    mode: ImportProjectYamlMode,
    source: YamlImportSource,
  ) {
    setImporting(true);
    setError(null);
    try {
      const result = await importProjectFromYaml(yamlText, mode);
      await recordSource(result.projectId, source);
      await refreshProjects();
      options.onImported?.(result.projectId);
      if (mode.kind === 'createNew') {
        switchProject(result.projectId);
      }
      resetOverwrite();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setImporting(false);
    }
  }

  async function handleYamlContent(yamlText: string, source: YamlImportSource) {
    setError(null);
    const preview = parseYamlImportPreview(yamlText);
    const activeId = options.activeProjectId ?? null;

    if (activeId) {
      const mismatch = preview.projectId !== activeId;
      const lines = await buildImportOverwriteDiff(activeId, preview.remoteSummary);
      pendingRef.current = { preview, source, targetProjectId: activeId };
      setIdMismatch(mismatch);
      setLocalProjectId(activeId);
      setRemoteProjectId(preview.projectId);
      setOverwriteProjectName(preview.projectName);
      setOverwriteTitle('Replace active project?');
      setDiffLines(lines);
      setOverwriteOpen(true);
      return;
    }

    const exists = projects.some((project) => project.projectId === preview.projectId);
    if (exists) {
      const lines = await buildImportOverwriteDiff(preview.projectId, preview.remoteSummary);
      pendingRef.current = { preview, source, targetProjectId: preview.projectId };
      setOverwriteProjectName(preview.projectName);
      setOverwriteTitle('Overwrite existing project?');
      setDiffLines(lines);
      setOverwriteOpen(true);
      return;
    }

    await runImport(yamlText, { kind: 'createNew' }, source);
  }

  async function confirmOverwrite() {
    const pending = pendingRef.current;
    if (!pending) return;
    const mode: ImportProjectYamlMode = idMismatch
      ? { kind: 'adoptRemote', projectId: pending.targetProjectId }
      : { kind: 'replaceExisting', projectId: pending.targetProjectId };
    try {
      await runImport(pending.preview.yamlText, mode, pending.source);
    } catch {
      // runImport sets error; keep modal open
    }
  }

  async function confirmImportAsNew() {
    const pending = pendingRef.current;
    if (!pending) return;
    try {
      await runImport(pending.preview.yamlText, { kind: 'createNew' }, pending.source);
    } catch {
      // runImport sets error; keep modal open
    }
  }

  function handleDriveSelection(
    selection: DriveOpenSelection & { folderId?: string; folderName?: string },
  ) {
    void handleYamlContent(selection.content, {
      kind: 'googleDrive',
      fileId: selection.fileId,
      fileName: selection.fileName,
      folderId: selection.folderId ?? 'root',
      folderName: selection.folderName,
      modifiedTime: selection.modifiedTime,
    });
  }

  function handleLocalFile(fileName: string, text: string) {
    void handleYamlContent(text, { kind: 'localFile', fileName });
  }

  return {
    importing,
    error,
    overwriteOpen,
    overwriteTitle,
    diffLines,
    projectName: overwriteProjectName,
    idMismatch,
    localProjectId,
    remoteProjectId,
    setOverwriteOpen,
    resetOverwrite,
    confirmOverwrite,
    confirmImportAsNew,
    handleDriveSelection,
    handleLocalFile,
    handleYamlContent,
  };
}

export function useRefreshFromDrivePrompt() {
  const { activeProject, refreshProjects, switchProject } = useProjects();
  const { port, withDriveAuthRetry, connected } = useGoogleDrive();
  const [bannerOpen, setBannerOpen] = useState(false);
  const [diffLines, setDiffLines] = useState<string[]>([]);
  const [remoteYaml, setRemoteYaml] = useState<string | null>(null);
  const [remoteProjectId, setRemoteProjectId] = useState<string | null>(null);
  const [idMismatch, setIdMismatch] = useState(false);
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());

  const drive = activeProject?.interchange?.googleDrive;
  const projectId = activeProject?.projectId;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!projectId || !drive || !connected) {
        if (!cancelled) setBannerOpen(false);
        return;
      }
      if (dismissedRef.current.has(projectId)) {
        return;
      }
      try {
        const metadata = await withDriveAuthRetry(() => port.getFileMetadata(drive.fileId));
        if (cancelled) return;
        const freshMeta = await persistence.loadProjectMeta(projectId);
        const localSyncedAt = freshMeta
          ? portableSyncedAt(freshMeta)
          : portableSyncedAt(activeProject);
        const remoteTime = metadata.modifiedTime;
        if (!isRemotePortableNewer(remoteTime, localSyncedAt)) {
          if (!cancelled) setBannerOpen(false);
          return;
        }
        const content = await withDriveAuthRetry(() => port.readFile(drive.fileId));
        if (cancelled) return;
        const preview = parseYamlImportPreview(content);
        const remoteSummary = {
          ...preview.remoteSummary,
          lastModifiedAt: remoteTime ?? preview.remoteSummary.portableSyncedAt,
        };
        const lines = await buildImportOverwriteDiff(projectId, remoteSummary);
        if (cancelled) return;
        setDiffLines(lines);
        setRemoteYaml(content);
        setRemoteProjectId(preview.projectId);
        setIdMismatch(preview.projectId !== projectId);
        setError(null);
        setBannerOpen(true);
      } catch {
        if (!cancelled) setBannerOpen(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProject, connected, drive, port, projectId, withDriveAuthRetry]);

  async function recordDriveSync() {
    if (!projectId || !drive) return;
    const metadata = await withDriveAuthRetry(() => port.getFileMetadata(drive.fileId));
    await recordProjectImportDestination(projectId, {
      destination: 'googleDrive',
      fileName: drive.fileName,
      folderId: drive.folderId,
      folderName: drive.folderName,
      fileId: drive.fileId,
      syncedAt: metadata.modifiedTime ?? new Date().toISOString(),
    });
  }

  async function recordDriveSyncForProject(
    targetProjectId: string,
    source: { fileName: string; folderId: string; folderName?: string; fileId: string },
    syncedAt?: string,
  ) {
    await recordProjectImportDestination(targetProjectId, {
      destination: 'googleDrive',
      fileName: source.fileName,
      folderId: source.folderId,
      folderName: source.folderName,
      fileId: source.fileId,
      syncedAt,
    });
  }

  function closeRefreshUi() {
    setBannerOpen(false);
    setOverwriteOpen(false);
    setError(null);
  }

  async function confirmRefresh() {
    if (!projectId || !remoteYaml || !drive) return;
    setImporting(true);
    setError(null);
    try {
      const mode = idMismatch
        ? ({ kind: 'adoptRemote', projectId } as const)
        : ({ kind: 'replaceExisting', projectId } as const);
      await importProjectFromYaml(remoteYaml, mode);
      await recordDriveSync();
      await refreshProjects();
      closeRefreshUi();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  async function confirmImportAsNew() {
    if (!remoteYaml || !drive) return;
    setImporting(true);
    setError(null);
    try {
      const metadata = await withDriveAuthRetry(() => port.getFileMetadata(drive.fileId));
      const result = await importProjectFromYaml(remoteYaml, { kind: 'createNew' });
      await recordDriveSyncForProject(
        result.projectId,
        {
          fileName: drive.fileName,
          folderId: drive.folderId,
          folderName: drive.folderName,
          fileId: drive.fileId,
        },
        metadata.modifiedTime ?? new Date().toISOString(),
      );
      await refreshProjects();
      switchProject(result.projectId);
      closeRefreshUi();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  function dismissBanner() {
    if (projectId) {
      dismissedRef.current.add(projectId);
    }
    setBannerOpen(false);
  }

  function openOverwrite() {
    setError(null);
    setOverwriteOpen(true);
  }

  function closeOverwrite() {
    setOverwriteOpen(false);
    setError(null);
  }

  return {
    bannerOpen,
    diffLines,
    overwriteOpen,
    importing,
    error,
    idMismatch,
    localProjectId: projectId ?? '',
    remoteProjectId: remoteProjectId ?? '',
    setOverwriteOpen,
    dismissBanner,
    openOverwrite,
    closeOverwrite,
    confirmRefresh,
    confirmImportAsNew,
    projectName: activeProject?.name ?? '',
  };
}
