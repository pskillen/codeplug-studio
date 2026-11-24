import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import type { RadioBuild } from '@core/models/formatBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { FormatId } from '@core/import-export/types.ts';
import {
  isBinaryCpsExportAdapter,
  isSingleFileCpsExportAdapter,
} from '@core/import-export/exportAdapter.ts';
import { getExportAdapter } from '@core/import-export/registry.ts';
import { traitProfileFor } from '@core/models/traits.ts';
import { resolveChirpExportProfileId } from '@core/import-export/formatProfiles.ts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CpsAppExportOptions } from '../../../services/buildCpsExportService.ts';
import {
  checkCpsExport,
  defaultCpsSingleFileName,
  downloadCpsFile,
  downloadCpsSingleFile,
  downloadCpsZip,
  extractNeonplugDonorFromZip,
  isNeonplugDonorBag,
  uploadCpsZipToDrive,
  validateNeonplugDonorBase,
} from '../../../services/buildCpsExportService.ts';
import {
  classifyWriteError,
  reportWriteError,
  type WriteErrorOutcome,
} from '../../../services/egress/writeErrorOutcome.ts';
import { saveDriveLastFolderId, saveDriveLastFolderPath } from '@integrations/cloud/drivePrefs.ts';
import type { DriveSaveTarget } from '../../import-export/DriveBrowserModal.tsx';
import { BuildService } from '../../../state/buildService.ts';
import { persistence } from '../../../state/persistence.ts';
import { useGoogleDrive } from '../../../hooks/useGoogleDrive.ts';
import type { FileExportStep } from './fileExportSteps.ts';

export type FileExportDeliveryKind = 'binary' | 'single-file' | 'zip' | 'neonplug';

export type NeonplugDonorChoice =
  | { kind: 'stored' }
  | { kind: 'session'; fileName: string }
  | { kind: 'greenfield' }
  | { kind: 'pending-upload' };

export interface FileExportFlowConfig {
  build: RadioBuild;
  projectId: string;
  activeEgress: EgressPath;
  formatId: FormatId;
  formatLabel: string;
  buildProfileId: string;
  exportProfileId: string;
  onExportProfileIdChange: (profileId: string) => void;
  runtimeExportOverrides: CpsAppExportOptions;
  suggestedZipName: string;
  exportFileNames: readonly string[];
  hasChannels: boolean;
  interchangeFolderId?: string;
  reloadEgressPaths: () => Promise<void>;
}

export interface FileExportFlowView {
  step: FileExportStep;
  showChooseStep: boolean;
  busy: boolean;
  checkStatus: 'idle' | 'checking' | 'ready' | 'error';
  warnings: ExportWarning[];
  fileNames: string[];
  errorOutcome: WriteErrorOutcome | null;
  retryLabel: string | null;
  downloadedFileName: string | null;
  driveSavedPath: string | null;
  deliveryKind: FileExportDeliveryKind;
  archiveDownloadLabel: string;
  archiveDriveLabel: string;
  imageFileName: string | null;
  chirpExportProfileId: string;
  profileOverridesBuild: boolean;
  buildProfileLabel: string;
  isNeonplug: boolean;
  neonplugDonorChoice: NeonplugDonorChoice;
  neonplugBaseError: string | null;
  storedDonorFileName: string | null;
  hasNeonplugMergeDonor: boolean;
  showDriveDelivery: boolean;
  previewOpen: boolean;
  driveBrowserOpen: boolean;
  overwriteOpen: boolean;
  pendingDriveTarget: DriveSaveTarget | null;
  sessionDonorFileName: string | null;
  hasChannels: boolean;
}

export interface FileExportFlowActions {
  onClose: () => void;
  onOpen: () => void;
  onChooseContinue: () => void;
  onChirpProfileChange: (profileId: string) => void;
  onNeonplugDonorUpload: (file: File | null) => Promise<void>;
  onClearStoredDonor: () => Promise<void>;
  onNeonplugChoiceGreenfield: () => void;
  onNeonplugChoiceStored: () => void;
  onDownloadZip: () => void;
  onDownloadSingleFile: () => void;
  onDownloadBinary: () => void;
  onDownloadFile: (fileName: string) => void;
  onSaveToDrive: () => void;
  onDriveSaveTarget: (target: DriveSaveTarget) => void;
  onConfirmDriveOverwrite: () => void;
  onCancelDriveOverwrite: () => void;
  onCloseDriveBrowser: () => void;
  onOpenPreview: () => void;
  onClosePreview: () => void;
  onRetry: () => void;
  onDownloadAnother: () => void;
}

const buildService = new BuildService(persistence);

function deliveryKindForFormat(formatId: FormatId): FileExportDeliveryKind {
  const adapter = getExportAdapter(formatId);
  if (isBinaryCpsExportAdapter(adapter)) return 'binary';
  if (isSingleFileCpsExportAdapter(adapter)) return 'single-file';
  if (formatId === 'neonplug') return 'neonplug';
  return 'zip';
}

function initialStep(showChoose: boolean): FileExportStep {
  return showChoose ? 'choose' : 'checks';
}

function baseNeonplugBytesForChoice(
  choice: NeonplugDonorChoice,
  sessionBytes: Uint8Array | null,
): Uint8Array | undefined {
  if (
    choice.kind === 'greenfield' ||
    choice.kind === 'pending-upload' ||
    choice.kind === 'stored'
  ) {
    return undefined;
  }
  if (choice.kind === 'session' && sessionBytes) return sessionBytes;
  return undefined;
}

export function useFileExportFlow(
  config: FileExportFlowConfig,
  onDialogClose: () => void,
): { view: FileExportFlowView; actions: FileExportFlowActions } {
  const { withDriveAuthRetry } = useGoogleDrive();
  const {
    build,
    projectId,
    activeEgress,
    formatId,
    formatLabel,
    buildProfileId,
    exportProfileId,
    onExportProfileIdChange,
    runtimeExportOverrides,
    suggestedZipName,
    hasChannels,
    interchangeFolderId,
    reloadEgressPaths,
  } = config;

  const isNeonplug = formatId === 'neonplug';
  const isChirp = formatId === 'chirp';
  const showChooseStep = isChirp || isNeonplug;
  const chirpExportProfileId = isChirp
    ? resolveChirpExportProfileId(exportProfileId, buildProfileId)
    : buildProfileId;
  const deliveryKind = deliveryKindForFormat(formatId);
  const buildProfileLabel = traitProfileFor(buildProfileId)?.label ?? buildProfileId;
  const profileOverridesBuild = isChirp && chirpExportProfileId !== buildProfileId;

  const storedNeonplugDonor =
    isNeonplug && isNeonplugDonorBag(activeEgress.hydration) ? activeEgress.hydration : null;
  const [step, setStep] = useState<FileExportStep>(() => initialStep(showChooseStep));
  const [busy, setBusy] = useState(false);
  const [checkStatus, setCheckStatus] = useState<FileExportFlowView['checkStatus']>('idle');
  const [warnings, setWarnings] = useState<ExportWarning[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [errorOutcome, setErrorOutcome] = useState<WriteErrorOutcome | null>(null);
  const [downloadedFileName, setDownloadedFileName] = useState<string | null>(null);
  const [driveSavedPath, setDriveSavedPath] = useState<string | null>(null);
  const [neonplugDonorChoice, setNeonplugDonorChoice] = useState<NeonplugDonorChoice>(
    storedNeonplugDonor ? { kind: 'stored' } : { kind: 'greenfield' },
  );
  const [neonplugBaseBytes, setNeonplugBaseBytes] = useState<Uint8Array | null>(null);
  const [sessionDonorFileName, setSessionDonorFileName] = useState<string | null>(null);
  const [neonplugBaseError, setNeonplugBaseError] = useState<string | null>(null);
  const [donorValidationWarnings, setDonorValidationWarnings] = useState<ExportWarning[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [driveBrowserOpen, setDriveBrowserOpen] = useState(false);
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [pendingDriveTarget, setPendingDriveTarget] = useState<DriveSaveTarget | null>(null);
  const checkGeneration = useRef(0);

  const exportOptions = useMemo((): CpsAppExportOptions => {
    return {
      ...runtimeExportOverrides,
      profileId: isChirp ? chirpExportProfileId : runtimeExportOverrides.profileId,
      fileName: isChirp
        ? defaultCpsSingleFileName(formatId, chirpExportProfileId)
        : runtimeExportOverrides.fileName,
    };
  }, [runtimeExportOverrides, isChirp, chirpExportProfileId, formatId]);

  const archiveDownloadLabel = isNeonplug ? 'Download .neonplug' : 'Download ZIP';
  const archiveDriveLabel = isNeonplug ? 'Save .neonplug to Drive' : 'Save ZIP to Drive';
  const showDriveDelivery =
    Boolean(interchangeFolderId) && (deliveryKind === 'zip' || deliveryKind === 'neonplug');
  const hasNeonplugMergeDonor =
    neonplugDonorChoice.kind === 'stored' || neonplugDonorChoice.kind === 'session';

  let imageFileName: string | null = null;
  try {
    const adapter = getExportAdapter(formatId);
    if (isBinaryCpsExportAdapter(adapter)) {
      imageFileName = adapter.defaultFileName;
    }
  } catch {
    imageFileName = null;
  }

  const runCheck = useCallback(async () => {
    const gen = ++checkGeneration.current;
    setCheckStatus('checking');
    setErrorOutcome(null);
    try {
      const baseBytes = isNeonplug
        ? baseNeonplugBytesForChoice(neonplugDonorChoice, neonplugBaseBytes)
        : undefined;
      const result = await checkCpsExport(projectId, build.id, {
        ...exportOptions,
        fileName:
          deliveryKind === 'zip' || deliveryKind === 'neonplug' ? suggestedZipName : undefined,
        baseNeonplugBytes: baseBytes,
      });
      if (gen !== checkGeneration.current) return;
      const merged = [...donorValidationWarnings, ...result.warnings];
      setWarnings(merged);
      setFileNames([...result.fileNames]);
      setCheckStatus('ready');
    } catch (err) {
      if (gen !== checkGeneration.current) return;
      const outcome = classifyWriteError(err, {
        phase: 'write',
        transmitStarted: false,
        userCancelled: false,
        radioLabel: formatLabel,
        profileId: buildProfileId,
      });
      reportWriteError(outcome);
      setErrorOutcome(outcome);
      setCheckStatus('error');
    }
  }, [
    projectId,
    build.id,
    exportOptions,
    suggestedZipName,
    deliveryKind,
    formatLabel,
    buildProfileId,
    isNeonplug,
    neonplugDonorChoice,
    neonplugBaseBytes,
    donorValidationWarnings,
  ]);

  const resetForOpen = useCallback(() => {
    setStep(initialStep(showChooseStep));
    setBusy(false);
    setCheckStatus('idle');
    setWarnings([]);
    setFileNames([]);
    setErrorOutcome(null);
    setDownloadedFileName(null);
    setDriveSavedPath(null);
    setNeonplugBaseError(null);
    setDonorValidationWarnings([]);
    setPreviewOpen(false);
    setDriveBrowserOpen(false);
    setOverwriteOpen(false);
    setPendingDriveTarget(null);
    setNeonplugDonorChoice(storedNeonplugDonor ? { kind: 'stored' } : { kind: 'greenfield' });
    setNeonplugBaseBytes(null);
    setSessionDonorFileName(null);
  }, [showChooseStep, storedNeonplugDonor]);

  useEffect(() => {
    if (step === 'checks') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount check when dialog opens on Checks
      void runCheck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount: dialog is conditionally rendered
  }, []);

  useEffect(() => {
    if (step !== 'checks' || !isChirp) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-check when CHIRP profile changes on Checks
    void runCheck();
  }, [chirpExportProfileId, step, isChirp, runCheck]);

  useEffect(() => {
    if (step !== 'checks' || !isNeonplug) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-check when NeonPlug donor changes
    void runCheck();
  }, [neonplugDonorChoice, step, isNeonplug, runCheck]);

  const handleExportError = useCallback(
    (err: unknown) => {
      const outcome = classifyWriteError(err, {
        phase: 'write',
        transmitStarted: false,
        userCancelled: false,
        radioLabel: formatLabel,
        profileId: buildProfileId,
      });
      reportWriteError(outcome);
      setErrorOutcome(outcome);
    },
    [formatLabel, buildProfileId],
  );

  const afterDownload = useCallback((fileName: string, newWarnings: ExportWarning[]) => {
    setWarnings(newWarnings);
    setDownloadedFileName(fileName);
    setStep('download');
    setErrorOutcome(null);
  }, []);

  const onDownloadZip = useCallback(() => {
    setBusy(true);
    setErrorOutcome(null);
    const baseBytes = isNeonplug
      ? baseNeonplugBytesForChoice(neonplugDonorChoice, neonplugBaseBytes)
      : undefined;
    void downloadCpsZip(projectId, build.id, {
      ...exportOptions,
      fileName: suggestedZipName,
      baseNeonplugBytes: baseBytes,
    })
      .then((result) => afterDownload(suggestedZipName, result.warnings))
      .catch(handleExportError)
      .finally(() => setBusy(false));
  }, [
    projectId,
    build.id,
    exportOptions,
    suggestedZipName,
    afterDownload,
    handleExportError,
    isNeonplug,
    neonplugDonorChoice,
    neonplugBaseBytes,
  ]);

  const onDownloadSingleFile = useCallback(() => {
    setBusy(true);
    setErrorOutcome(null);
    const name = exportOptions.fileName ?? defaultCpsSingleFileName(formatId, chirpExportProfileId);
    void downloadCpsSingleFile(projectId, build.id, exportOptions)
      .then((result) => afterDownload(name, result.warnings))
      .catch(handleExportError)
      .finally(() => setBusy(false));
  }, [
    projectId,
    build.id,
    exportOptions,
    formatId,
    chirpExportProfileId,
    afterDownload,
    handleExportError,
  ]);

  const onDownloadBinary = useCallback(() => {
    if (!imageFileName) return;
    setBusy(true);
    setErrorOutcome(null);
    void downloadCpsZip(projectId, build.id, exportOptions)
      .then((result) => afterDownload(imageFileName, result.warnings))
      .catch(handleExportError)
      .finally(() => setBusy(false));
  }, [projectId, build.id, exportOptions, imageFileName, afterDownload, handleExportError]);

  const onDownloadFile = useCallback(
    (fileName: string) => {
      setBusy(true);
      setErrorOutcome(null);
      void downloadCpsFile(projectId, build.id, fileName, exportOptions)
        .then((result) => afterDownload(fileName, result.warnings))
        .catch(handleExportError)
        .finally(() => setBusy(false));
    },
    [projectId, build.id, exportOptions, afterDownload, handleExportError],
  );

  const saveZipToDrive = useCallback(
    async (target: DriveSaveTarget) => {
      setBusy(true);
      setErrorOutcome(null);
      try {
        const baseBytes = isNeonplug
          ? baseNeonplugBytesForChoice(neonplugDonorChoice, neonplugBaseBytes)
          : undefined;
        const result = await withDriveAuthRetry(() =>
          uploadCpsZipToDrive(
            projectId,
            build.id,
            {
              folderId: target.folderId,
              fileName: target.fileName,
              existingFileId: target.existingFileId,
            },
            {
              ...exportOptions,
              baseNeonplugBytes: baseBytes,
            },
          ),
        );
        setWarnings(result.warnings);
        setDriveSavedPath(`${target.path}/${target.fileName}`);
        setDownloadedFileName(target.fileName);
        setStep('download');
        saveDriveLastFolderId(target.folderId);
        saveDriveLastFolderPath(target.path);
        setDriveBrowserOpen(false);
        setOverwriteOpen(false);
        setPendingDriveTarget(null);
      } catch (err) {
        handleExportError(err);
      } finally {
        setBusy(false);
      }
    },
    [
      projectId,
      build.id,
      exportOptions,
      withDriveAuthRetry,
      handleExportError,
      isNeonplug,
      neonplugDonorChoice,
      neonplugBaseBytes,
    ],
  );

  const onNeonplugDonorUpload = useCallback(
    async (file: File | null) => {
      setNeonplugBaseError(null);
      if (!file) {
        setNeonplugBaseBytes(null);
        setSessionDonorFileName(null);
        setNeonplugDonorChoice({ kind: 'pending-upload' });
        return;
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { warnings } = validateNeonplugDonorBase(bytes, buildProfileId);
        setDonorValidationWarnings(warnings);
        setNeonplugBaseBytes(bytes);
        setSessionDonorFileName(file.name);
        setNeonplugDonorChoice({ kind: 'session', fileName: file.name });

        const bag = extractNeonplugDonorFromZip(bytes, { sourceFileName: file.name });
        const next = buildService.withEgressHydration(activeEgress, bag);
        const result = await buildService.putEgressPath(next, activeEgress.revision);
        if (!result.ok) {
          setNeonplugBaseError(
            result.reason === 'revision_conflict'
              ? 'Egress changed elsewhere — reload and try again.'
              : 'Could not save donor settings on this pathway.',
          );
        } else {
          await reloadEgressPaths();
        }
      } catch (err) {
        setNeonplugBaseBytes(null);
        setSessionDonorFileName(null);
        setNeonplugBaseError(err instanceof Error ? err.message : String(err));
      }
    },
    [activeEgress, buildProfileId, reloadEgressPaths],
  );

  const onClearStoredDonor = useCallback(async () => {
    if (!storedNeonplugDonor) return;
    setNeonplugBaseBytes(null);
    setSessionDonorFileName(null);
    try {
      const next = buildService.clearEgressHydration(activeEgress);
      const result = await buildService.putEgressPath(next, activeEgress.revision);
      if (!result.ok) {
        setNeonplugBaseError(
          result.reason === 'revision_conflict'
            ? 'Egress changed elsewhere — reload and try again.'
            : 'Could not clear donor settings.',
        );
      } else {
        await reloadEgressPaths();
        setNeonplugDonorChoice({ kind: 'greenfield' });
      }
    } catch (err) {
      setNeonplugBaseError(err instanceof Error ? err.message : String(err));
    }
  }, [activeEgress, storedNeonplugDonor, reloadEgressPaths]);

  const view: FileExportFlowView = {
    step,
    showChooseStep,
    busy,
    checkStatus,
    warnings,
    fileNames,
    errorOutcome,
    retryLabel: errorOutcome?.kind === 'error' ? 'Try again' : null,
    downloadedFileName,
    driveSavedPath,
    deliveryKind,
    archiveDownloadLabel,
    archiveDriveLabel,
    imageFileName,
    chirpExportProfileId,
    profileOverridesBuild,
    buildProfileLabel,
    isNeonplug,
    neonplugDonorChoice,
    neonplugBaseError,
    storedDonorFileName: storedNeonplugDonor?.sourceFileName ?? null,
    hasNeonplugMergeDonor,
    showDriveDelivery,
    previewOpen,
    driveBrowserOpen,
    overwriteOpen,
    pendingDriveTarget,
    sessionDonorFileName,
    hasChannels,
  };

  const actions: FileExportFlowActions = {
    onClose: onDialogClose,
    onOpen: () => {},
    onChooseContinue: () => {
      setStep('checks');
      void runCheck();
    },
    onChirpProfileChange: (profileId) => {
      onExportProfileIdChange(profileId);
    },
    onNeonplugDonorUpload: (file) => onNeonplugDonorUpload(file),
    onClearStoredDonor: () => onClearStoredDonor(),
    onNeonplugChoiceGreenfield: () => setNeonplugDonorChoice({ kind: 'greenfield' }),
    onNeonplugChoiceStored: () => setNeonplugDonorChoice({ kind: 'stored' }),
    onDownloadZip,
    onDownloadSingleFile,
    onDownloadBinary,
    onDownloadFile,
    onSaveToDrive: () => setDriveBrowserOpen(true),
    onDriveSaveTarget: (target) => {
      if (target.existingFileId) {
        setPendingDriveTarget(target);
        setOverwriteOpen(true);
        return;
      }
      void saveZipToDrive(target);
    },
    onConfirmDriveOverwrite: () => {
      if (pendingDriveTarget) void saveZipToDrive(pendingDriveTarget);
    },
    onCancelDriveOverwrite: () => {
      setOverwriteOpen(false);
      setPendingDriveTarget(null);
    },
    onCloseDriveBrowser: () => setDriveBrowserOpen(false),
    onOpenPreview: () => setPreviewOpen(true),
    onClosePreview: () => setPreviewOpen(false),
    onRetry: () => {
      setErrorOutcome(null);
      if (step === 'checks') {
        void runCheck();
        return;
      }
      setStep('checks');
      void runCheck();
    },
    onDownloadAnother: () => {
      resetForOpen();
      const start = initialStep(showChooseStep);
      setStep(start);
      if (start === 'checks') void runCheck();
    },
  };

  return { view, actions };
}
