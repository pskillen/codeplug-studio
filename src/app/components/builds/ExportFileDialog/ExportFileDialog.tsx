import { useRef } from 'react';
import { Alert, Button, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import { IconDownload, IconPackage, IconTable } from '@tabler/icons-react';
import type { RadioBuild } from '@core/models/formatBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { traitProfileFor } from '@core/models/traits.ts';
import { EgressShell, ErrorPanel, WarningsList } from '../../egress/index.ts';
import { Button as V2Button } from '../../v2/index.ts';
import ProfilePicker from '../ProfilePicker.tsx';
import CpsCsvPreviewModal from '../CpsCsvPreviewModal.tsx';
import DriveBrowserModal from '../../import-export/DriveBrowserModal.tsx';
import GoogleDriveActionButton from '../../import-export/GoogleDriveActionButton.tsx';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../../lib/iconSizes.ts';
import type { CpsAppExportOptions } from '../../../services/buildCpsExportService.ts';
import {
  useFileExportFlow,
  type FileExportFlowActions,
  type FileExportFlowConfig,
  type FileExportFlowView,
} from './useFileExportFlow.tsx';
import { fileExportSteps } from './fileExportSteps.ts';
import classes from './ExportFileDialog.module.css';

export interface ExportFileDialogProps {
  open: boolean;
  onClose: () => void;
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

function ChooseStepBody({
  view,
  actions,
  formatId,
}: {
  view: FileExportFlowView;
  actions: FileExportFlowActions;
  formatId: FormatId;
}) {
  const donorInputRef = useRef<HTMLInputElement>(null);
  if (view.isNeonplug) {
    return (
      <Stack gap="sm">
        <Text size="sm" fw={600}>
          Merge into radio-read base
        </Text>
        <Text size="sm">
          Upload a donor <code>.neonplug</code> from a NeonPlug radio read, or export without one
          (greenfield).
        </Text>
        {view.storedDonorFileName ? (
          <Alert color="blue" title="Stored donor on this pathway">
            <Text size="sm">{view.storedDonorFileName}</Text>
            <Group gap="xs" mt="xs">
              <Button
                size="xs"
                variant={view.neonplugDonorChoice.kind === 'stored' ? 'filled' : 'light'}
                onClick={actions.onNeonplugChoiceStored}
              >
                Use stored donor
              </Button>
              <Button
                size="compact-sm"
                color="red"
                variant="subtle"
                onClick={() => void actions.onClearStoredDonor()}
              >
                Clear stored donor
              </Button>
            </Group>
          </Alert>
        ) : null}
        <input
          ref={donorInputRef}
          type="file"
          accept=".neonplug,application/zip"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            void actions.onNeonplugDonorUpload(file);
            event.target.value = '';
          }}
        />
        <Group gap="xs">
          <Button variant="light" onClick={() => donorInputRef.current?.click()}>
            {view.sessionDonorFileName ? 'Replace donor .neonplug' : 'Upload donor .neonplug'}
          </Button>
          {view.sessionDonorFileName ? (
            <Text size="sm" c="dimmed">
              {view.sessionDonorFileName}
            </Text>
          ) : null}
        </Group>
        <Button
          variant={view.neonplugDonorChoice.kind === 'greenfield' ? 'filled' : 'light'}
          onClick={actions.onNeonplugChoiceGreenfield}
        >
          Export without a donor (greenfield)
        </Button>
        {view.neonplugDonorChoice.kind === 'greenfield' ? (
          <Alert color="yellow" title="Greenfield download (not for radio write)">
            A Studio-only <code>.neonplug</code> omits radio settings, operator DMR IDs, and other
            unmodelled NeonPlug fields. Safe for browsing in NeonPlug — not safe to write back
            without merging into a donor base first.
          </Alert>
        ) : null}
        {view.neonplugBaseError ? <Alert color="red">{view.neonplugBaseError}</Alert> : null}
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <Text size="sm">Choose the CHIRP memory layout for this export.</Text>
      <ProfilePicker
        mode="select"
        formatId={formatId}
        value={view.chirpExportProfileId}
        onChange={actions.onChirpProfileChange}
        description="CHIRP memory layout and power ladder for target hardware"
      />
      {view.profileOverridesBuild ? (
        <Text size="sm" c="dimmed">
          Export uses{' '}
          {traitProfileFor(view.chirpExportProfileId)?.label ?? view.chirpExportProfileId}; pathway
          default is {view.buildProfileLabel}.
        </Text>
      ) : null}
    </Stack>
  );
}

function ChecksStepBody({
  view,
  actions,
  build,
  formatId,
  profileId,
  exportOptions,
  exportFileNames,
}: {
  view: FileExportFlowView;
  actions: FileExportFlowActions;
  build: RadioBuild;
  formatId: FormatId;
  profileId: string;
  exportOptions: CpsAppExportOptions;
  exportFileNames: readonly string[];
}) {
  if (view.checkStatus === 'checking') {
    return (
      <Stack align="center" gap="sm" data-testid="export-checks-loading">
        <Loader size="sm" />
        <Text size="sm">Checking export…</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <WarningsList mode="full" warnings={view.warnings} testId="export-warnings-full" />
      <Group gap="xs">
        {view.deliveryKind === 'binary' && view.imageFileName ? (
          <Button
            leftSection={<IconDownload size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
            variant="filled"
            disabled={view.busy || !view.hasChannels}
            loading={view.busy}
            onClick={actions.onDownloadBinary}
            data-testid="export-download-binary"
          >
            Download {view.imageFileName}
          </Button>
        ) : null}
        {view.deliveryKind === 'single-file' ? (
          <Button
            leftSection={<IconDownload size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
            variant="filled"
            disabled={view.busy}
            loading={view.busy}
            onClick={actions.onDownloadSingleFile}
            data-testid="export-download-single"
          >
            Download file
          </Button>
        ) : null}
        {view.deliveryKind === 'zip' || view.deliveryKind === 'neonplug' ? (
          <>
            <Button
              leftSection={<IconPackage size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
              variant="filled"
              disabled={
                view.busy ||
                (view.isNeonplug &&
                  view.neonplugDonorChoice.kind !== 'greenfield' &&
                  !view.hasNeonplugMergeDonor)
              }
              loading={view.busy}
              onClick={actions.onDownloadZip}
              data-testid="export-download-zip"
            >
              {view.isNeonplug && view.neonplugDonorChoice.kind !== 'greenfield'
                ? 'Download for radio write'
                : view.archiveDownloadLabel}
            </Button>
            {view.isNeonplug && view.neonplugDonorChoice.kind === 'greenfield' ? (
              <Button
                variant="subtle"
                disabled={view.busy}
                loading={view.busy}
                onClick={actions.onDownloadZip}
              >
                Download greenfield .neonplug
              </Button>
            ) : null}
          </>
        ) : null}
        {view.deliveryKind !== 'binary' ? (
          <Button
            variant="outline"
            leftSection={<IconTable size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
            disabled={view.busy}
            onClick={actions.onOpenPreview}
          >
            Preview CSV
          </Button>
        ) : null}
        {view.showDriveDelivery ? (
          <GoogleDriveActionButton
            disabled={
              view.busy ||
              (view.isNeonplug &&
                view.neonplugDonorChoice.kind !== 'greenfield' &&
                !view.hasNeonplugMergeDonor)
            }
            loading={view.busy}
            onClick={actions.onSaveToDrive}
          >
            {view.archiveDriveLabel}
          </GoogleDriveActionButton>
        ) : null}
      </Group>
      {view.deliveryKind === 'zip' ? (
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
                disabled={view.busy}
                onClick={() => actions.onDownloadFile(fileName)}
              >
                {fileName}
              </Button>
            ))}
          </Group>
        </Stack>
      ) : null}
      {view.previewOpen ? (
        <CpsCsvPreviewModal
          opened
          onClose={actions.onClosePreview}
          build={build}
          formatId={formatId}
          profileId={profileId}
          exportOptions={exportOptions}
        />
      ) : null}
    </Stack>
  );
}

function DownloadStepBody({ view }: { view: FileExportFlowView }) {
  const saved = view.driveSavedPath;
  const label = saved
    ? `Saved ${view.downloadedFileName ?? 'file'} to Drive`
    : view.downloadedFileName
      ? `Downloaded ${view.downloadedFileName}`
      : 'Download complete';
  return (
    <Stack gap="sm" data-testid="export-done-step">
      <Alert color="green" title={label} />
      <WarningsList mode="recap" warnings={view.warnings} testId="export-warnings-recap" />
    </Stack>
  );
}

function StepFooter({
  view,
  actions,
}: {
  view: FileExportFlowView;
  actions: FileExportFlowActions;
}) {
  if (view.step === 'choose') {
    return (
      <Group justify="flex-end">
        <V2Button variant="secondary" onClick={actions.onClose}>
          Cancel
        </V2Button>
        <V2Button variant="primary" onClick={actions.onChooseContinue}>
          Continue
        </V2Button>
      </Group>
    );
  }
  if (view.step === 'download') {
    return (
      <Group justify="flex-end">
        <V2Button variant="secondary" onClick={actions.onClose}>
          Close
        </V2Button>
        <V2Button variant="primary" onClick={actions.onDownloadAnother}>
          Export again
        </V2Button>
      </Group>
    );
  }
  return (
    <Group justify="flex-end">
      <V2Button variant="secondary" onClick={actions.onClose} disabled={view.busy}>
        Cancel
      </V2Button>
    </Group>
  );
}

export default function ExportFileDialog(props: ExportFileDialogProps) {
  const {
    open,
    onClose,
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
    exportFileNames,
    hasChannels,
    interchangeFolderId,
    reloadEgressPaths,
  } = props;

  const flowConfig: FileExportFlowConfig = {
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
    exportFileNames,
    hasChannels,
    interchangeFolderId,
    reloadEgressPaths,
  };

  const { view, actions } = useFileExportFlow(flowConfig, onClose);
  const errorStep = view.errorOutcome ? view.step : null;
  const steps = fileExportSteps(view.step, view.showChooseStep, errorStep);

  const body =
    view.step === 'choose' ? (
      <ChooseStepBody view={view} actions={actions} formatId={formatId} />
    ) : view.step === 'checks' ? (
      <ChecksStepBody
        view={view}
        actions={actions}
        build={build}
        formatId={formatId}
        profileId={buildProfileId}
        exportOptions={runtimeExportOverrides}
        exportFileNames={exportFileNames}
      />
    ) : (
      <DownloadStepBody view={view} />
    );

  return (
    <>
      <EgressShell
        open={open}
        onClose={onClose}
        title={`Export · ${formatLabel}`}
        dismissible={!view.busy}
        steps={steps}
        busy={view.busy}
        error={
          view.errorOutcome ? (
            <ErrorPanel
              title="The export failed"
              testId="export-error-panel"
              outcome={view.errorOutcome}
              retryLabel={view.retryLabel}
              onRetry={actions.onRetry}
            />
          ) : null
        }
        footer={<StepFooter view={view} actions={actions} />}
      >
        <div className={classes.body}>{body}</div>
      </EgressShell>
      <DriveBrowserModal
        opened={view.driveBrowserOpen}
        onClose={actions.onCloseDriveBrowser}
        mode="save"
        interchangeFolderId={interchangeFolderId}
        defaultFileName={suggestedZipName}
        saveConflictKind="zip"
        saving={view.busy}
        onSelectFile={() => {}}
        onSaveTarget={actions.onDriveSaveTarget}
      />
      <Modal
        opened={view.overwriteOpen}
        onClose={actions.onCancelDriveOverwrite}
        title="Overwrite file?"
        centered
      >
        <Stack gap="sm">
          <Text size="sm">
            {view.pendingDriveTarget?.fileName} already exists in this folder. Overwrite it?
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={actions.onCancelDriveOverwrite}>
              Cancel
            </Button>
            <Button color="red" loading={view.busy} onClick={actions.onConfirmDriveOverwrite}>
              Overwrite
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
