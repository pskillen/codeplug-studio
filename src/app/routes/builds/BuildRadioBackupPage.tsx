/**
 * Per-build Backup / Restore tab — zip on disk and inspect in memory.
 * Read into library is the only section that saves library and build rows.
 */

import { useContext, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Alert, FileButton, Group, Stack, Table, Text } from '@mantine/core';
import type { PlannedStage, ProgressUpdate, RadioSession } from '@integrations/radio-io/types.ts';
import { planForOperation } from '@integrations/radio-io/plannedStages.ts';
import { FormPage, FormSection } from '../../components/ui/index.ts';
import BackupLabelFields from '../../components/builds/BackupLabelFields.tsx';
import { backupLabelSummary } from '../../lib/backupLabelSummary.ts';
import type { RadioBackupLabels } from '@integrations/radio-io/backup/index.ts';
import RadioCloneSummaryView from '../../components/builds/RadioCloneSummaryView.tsx';
import RadioIoProgressModal, {
  type RadioIoOperation,
  type RadioIoProgressPhase,
} from '../../components/builds/RadioIoProgressModal.tsx';
import WebSerialExperimentalAlert from '../../components/builds/WebSerialExperimentalAlert.tsx';
import { findAttribution } from '../../lib/attributions.ts';
import { findRadioIoEgress } from '../../lib/buildEgressUi.ts';
import { createProgressCoalescer, type ProgressCoalescer } from '../../lib/progressCoalescer.ts';
import { useUnsavedNavigationGuard } from '../../hooks/useUnsavedNavigationGuard.ts';
import {
  closeRadioSession,
  descriptorsForEgress,
  getRadioSerialUnsupportedMessage,
  isRadioSerialSupported,
  openRadioSessionForEgress,
} from '../../services/radioIoSession.ts';
import {
  backupLiveRadioSession,
  defaultRestorableRegionIds,
  descriptorSupportsRestore,
  downloadRadioBackupZip,
  isRestoreHiddenForProfile,
  openRadioBackupZip,
  relabelRadioBackupSession,
  RADIO_RESTORE_PROD_DISABLED_MESSAGE,
  restoreRegionUnavailableReason,
  type RadioBackupSession,
} from '../../services/radioBackupRestore.ts';
import {
  classifyWriteError,
  reportWriteError,
  type WriteErrorOutcome,
} from '../../services/egress/writeErrorOutcome.ts';
import { resolveWriteShellOptions } from '../../services/egress/writeShellOptions.ts';
import RadioRestoreDialog from '../../components/builds/RadioRestoreDialog/RadioRestoreDialog.tsx';
import { useRadioRestoreFlow } from '../../components/builds/RadioRestoreDialog/useRadioRestoreFlow.ts';
import { ErrorPanel } from '../../components/egress/index.ts';
import { Button, Checkbox } from '../../components/v2/index.ts';
import {
  backupAtD890Vital,
  openAtD890VitalZip,
  type AtD890VitalSession,
} from '../../services/atD890VitalBackup.ts';
import { backupRt95Safety, type Rt95SafetyBackupResult } from '../../services/rt95SafetyBackup.ts';
import type { Rt95SafetyRegion } from '@integrations/radio-io/radios/rt95/safetyBackup/reader.ts';
import AtD890VitalBackupPanel from './AtD890VitalBackupPanel.tsx';
import Rt95SafetyBackupPanel from './Rt95SafetyBackupPanel.tsx';
import Dm32CalibrationBackupPanel from './Dm32CalibrationBackupPanel.tsx';
import {
  addBackupThisSession,
  describeBackupRadio,
  useBackupsThisSession,
  type RadioBackupThisSession,
} from '../../state/radioSessionBackups.ts';
import RangeChangeBanner from '../../components/dangerZone/RangeChangeBanner.tsx';
import {
  applyRadioReadToLibrary,
  descriptorSupportsReadIntoLibrary,
  type RadioReadOutcome,
} from '../../services/radioReadIntoLibrary.ts';
import { persistence } from '../../state/persistence.ts';
import { ProjectContext } from '../../state/ProjectContext.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';
import ReadIntoLibraryPanel from './ReadIntoLibraryPanel.tsx';

function coverageCopy(coverage: RadioBackupSession['manifest']['coverage']): string {
  switch (coverage) {
    case 'full-clone':
      return 'Full programming-image clone (not necessarily the entire flash chip).';
    case 'known-map-regions':
      return 'Known map regions only — not a full chip dump.';
    case 'partial':
      return 'Partial coverage — some memory was not captured.';
  }
}

function BackupRadioLabel({ backup }: { backup: RadioBackupThisSession }) {
  const { primary, secondary } = describeBackupRadio(backup);
  return (
    <>
      <Text size="sm">{primary}</Text>
      {secondary ? (
        <Text size="xs" c="dimmed">
          {secondary}
        </Text>
      ) : null}
      {backup.userRadioName || backup.userLabel ? (
        <Text size="xs">
          {backupLabelSummary({ radioName: backup.userRadioName, label: backup.userLabel })}
        </Text>
      ) : null}
      {backup.note ? (
        <Text size="xs" c="dimmed">
          {backup.note}
        </Text>
      ) : null}
    </>
  );
}

export default function BuildRadioBackupPage() {
  const { build, egressPaths } = useBuildLayout();
  const projects = useContext(ProjectContext);
  const readProjectId =
    !projects?.loading && projects?.activeProjectId === build.projectId ? build.projectId : null;
  const radioEgress = findRadioIoEgress(egressPaths);
  const navigate = useNavigate();
  const backupsThisSession = useBackupsThisSession(build.id);
  const descriptor = radioEgress ? descriptorsForEgress(radioEgress)[0] : undefined;
  const profileId = radioEgress?.profileId ?? '';

  const sessionRef = useRef<RadioSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const progressCoalescerRef = useRef<ProgressCoalescer | null>(null);
  useEffect(() => () => progressCoalescerRef.current?.cancel(), []);
  const fileResetRef = useRef<() => void>(null);

  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<RadioIoOperation>('read');
  const [phase, setPhase] = useState<RadioIoProgressPhase>('connecting');
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [transferStages, setTransferStages] = useState<string[]>([]);
  const [plan, setPlan] = useState<PlannedStage[] | undefined>(undefined);
  const [readError, setReadError] = useState<WriteErrorOutcome | null>(null);
  const [readOutcome, setReadOutcome] = useState<RadioReadOutcome | null>(null);
  const [backup, setBackup] = useState<RadioBackupSession | null>(null);
  /** Optional descriptive fields typed before a backup; stored in the manifest. */
  const [labels, setLabels] = useState<RadioBackupLabels>({});
  const [selectedRegionIds, setSelectedRegionIds] = useState<ReadonlySet<string>>(new Set());
  const [vital, setVital] = useState<AtD890VitalSession | null>(null);
  const [safety, setSafety] = useState<Rt95SafetyBackupResult | null>(null);
  const restoreEgress = radioEgress ?? egressPaths[0]!;
  const restoreFlow = useRadioRestoreFlow({
    egress: restoreEgress,
    descriptor,
    profileId,
  });
  const restoreShell = resolveWriteShellOptions(restoreEgress, descriptor);
  const restoreDialogOpen = restoreFlow.view.open;

  const { modalOpen: leaveAttempted, stay } = useUnsavedNavigationGuard(
    busy || restoreFlow.view.busy,
  );

  useEffect(() => {
    if (leaveAttempted) stay();
  }, [leaveAttempted, stay]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void closeRadioSession(session);
    };
  }, []);

  if (!radioEgress) {
    return <Navigate to={`/builds/${build.id}/export`} replace />;
  }

  const descriptors = descriptorsForEgress(radioEgress);
  const serialOk = isRadioSerialSupported();
  const supportsReadIntoLibrary =
    descriptor != null && descriptorSupportsReadIntoLibrary(descriptor);
  const restoreProdHidden = isRestoreHiddenForProfile(descriptor, radioEgress.profileId);
  const restoreAvailable = descriptorSupportsRestore(descriptor) && !restoreProdHidden;
  const dm32Model = (descriptor?.modelIds ?? []).some((id) => /dm-?32/i.test(id));
  const d890Model = (descriptor?.modelIds ?? []).includes('AT-D890UV');
  const rt95Model = (descriptor?.modelIds ?? []).includes('RT95-P');
  const warnFactoryReset = dm32Model;

  function readErrorContext() {
    return {
      phase: 'read' as const,
      transmitStarted: false,
      userCancelled: Boolean(abortRef.current?.signal.aborted),
      radioLabel: descriptor?.label ?? 'radio',
      profileId,
      stage: progress?.stage,
      build: { version: __BUILD_VERSION__, env: __BUILD_ENV__ },
    };
  }

  function setReadFailure(err: unknown): void {
    const outcome = classifyWriteError(err, readErrorContext());
    reportWriteError(outcome);
    setReadError(outcome.kind === 'cancelled' ? null : outcome);
  }

  const attributionNames = (descriptor?.attributionIds ?? [])
    .map((id) => findAttribution(id)?.name)
    .filter(Boolean)
    .join(' / ');

  // Progress reaches React state at about 10 Hz; a stage change or a stage's last event at once (#1558).
  function clearProgress() {
    progressCoalescerRef.current?.cancel();
    setProgress(null);
  }
  function onProgress(p: ProgressUpdate) {
    setPhase('transfer');
    progressCoalescerRef.current ??= createProgressCoalescer(setProgress);
    progressCoalescerRef.current.push(p);
    if (p.stage) {
      setTransferStages((prev) => (prev.includes(p.stage!) ? prev : [...prev, p.stage!]));
    }
  }

  function beginBusy(next: RadioIoOperation = 'read'): void {
    setReadError(null);
    setOperation(next);
    setBusy(true);
    setPhase('connecting');
    clearProgress();
    setTransferStages([]);
    setPlan(undefined);
    abortRef.current = new AbortController();
  }

  function applyBackupSession(next: RadioBackupSession): void {
    setBackup(next);
    setSelectedRegionIds(new Set(defaultRestorableRegionIds(next.manifest, profileId)));
  }

  async function releaseSession(): Promise<void> {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) await closeRadioSession(session);
  }

  async function handleReadIntoLibrary() {
    const hook = descriptor?.readIntoLibrary;
    if (busy || !serialOk || !readProjectId || !hook || !radioEgress) return;
    setReadOutcome(null);
    beginBusy('library-read');
    const { signal } = abortRef.current!;
    try {
      const { session } = await openRadioSessionForEgress(radioEgress, {
        forcePortSelection: true,
        purpose: 'read',
        signal,
      });
      sessionRef.current = session;
      signal.throwIfAborted();
      setPhase('transfer');
      const read = await hook.read(session, { onProgress, signal });
      await releaseSession();
      signal.throwIfAborted();
      setPhase('saving');
      const outcome = await applyRadioReadToLibrary({
        persistence,
        projectId: readProjectId,
        read,
        startedFromBuildId: build.id,
      });
      setReadOutcome(outcome);
      if (outcome.ok) setPhase('done');
      else handleProgressClose();
    } catch (err) {
      await releaseSession().catch(() => undefined);
      if (!signal.aborted) {
        setReadOutcome({ ok: false, message: err instanceof Error ? err.message : String(err) });
      }
      handleProgressClose();
    }
  }

  async function handleBackupRadio() {
    beginBusy();
    setPlan(descriptor ? planForOperation(descriptor, 'backup', {}) : undefined);
    try {
      const { session } = await openRadioSessionForEgress(radioEgress!, {
        forcePortSelection: true,
        purpose: 'read',
        captureFactorySector: true,
      });
      sessionRef.current = session;
      setPlan(descriptor ? planForOperation(descriptor, 'backup', { session }) : undefined);
      setPhase('transfer');
      const result = await backupLiveRadioSession(session, {
        onProgress,
        signal: abortRef.current!.signal,
        profileId,
        labels,
      });
      await releaseSession();
      addBackupThisSession(build.id, {
        serial: result.manifest.serial ?? '',
        model: result.manifest.descriptorLabel,
        name: '',
        userRadioName: result.manifest.radioName,
        userLabel: result.manifest.label,
        at: Date.now(),
      });
      applyBackupSession(result);
      setPhase('done');
    } catch (err) {
      setReadFailure(err);
      await releaseSession();
      setBusy(false);
      clearProgress();
      abortRef.current = null;
    }
  }

  async function handleBackupVital() {
    setVital(null);
    beginBusy('vital-read');
    try {
      const { session } = await openRadioSessionForEgress(radioEgress!, {
        forcePortSelection: true,
        purpose: 'read',
      });
      sessionRef.current = session;
      setPhase('transfer');
      const result = await backupAtD890Vital(session, {
        onProgress,
        signal: abortRef.current!.signal,
      });
      await releaseSession();
      setVital(result);
      setPhase('done');
    } catch (err) {
      setVital(null);
      setReadFailure(err);
      await releaseSession();
      setBusy(false);
      clearProgress();
      abortRef.current = null;
    }
  }

  async function handleBackupSafety(region: Rt95SafetyRegion, serial: string) {
    setSafety(null);
    beginBusy('safety-read');
    try {
      const { session } = await openRadioSessionForEgress(radioEgress!, {
        forcePortSelection: true,
        purpose: 'read',
      });
      sessionRef.current = session;
      setPhase('transfer');
      const result = await backupRt95Safety(session, {
        region,
        serial,
        onProgress,
        signal: abortRef.current!.signal,
      });
      await releaseSession();
      setSafety(result);
      setPhase('done');
    } catch (err) {
      setSafety(null);
      setReadFailure(err);
      await releaseSession();
      setBusy(false);
      clearProgress();
      abortRef.current = null;
    }
  }

  async function handleOpenVitalFile(file: File | null) {
    if (!file) return;
    setReadError(null);
    try {
      setVital(await openAtD890VitalZip(new Uint8Array(await file.arrayBuffer())));
    } catch (err) {
      setVital(null);
      setReadFailure(err);
    }
  }

  function handleCancel(): void {
    abortRef.current?.abort();
    if (operation === 'library-read') return;
    abortRef.current = null;
    void releaseSession();
    setBusy(false);
    clearProgress();
  }

  function handleProgressClose(): void {
    setBusy(false);
    clearProgress();
    abortRef.current = null;
  }

  function handleRelabel(next: RadioBackupLabels): void {
    if (!backup) return;
    try {
      setBackup(relabelRadioBackupSession(backup, next));
      setReadError(null);
    } catch (err) {
      setReadFailure(err);
    }
  }

  function handleClearSession(): void {
    setBackup(null);
    setSelectedRegionIds(new Set());
    setReadError(null);
  }

  function toggleRestorableRegion(regionId: string, checked: boolean): void {
    setSelectedRegionIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(regionId);
      else next.delete(regionId);
      return next;
    });
  }

  function handleOpenRestoreDialog(): void {
    if (!backup) return;
    restoreFlow.open(backup, [...selectedRegionIds]);
  }

  async function handleOpenFile(file: File | null) {
    if (!file) return;
    setReadError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      applyBackupSession(openRadioBackupZip(bytes));
    } catch (err) {
      setBackup(null);
      setReadFailure(err);
    } finally {
      fileResetRef.current?.();
    }
  }

  return (
    <FormPage
      title="Backup / Restore"
      description={
        <Text size="sm" component="span">
          Snapshot the connected radio to a zip on your disk, or open a backup file to inspect it.
          This is not Write — the zip stays on your computer and is not saved to the project. The
          file may contain contact banks and callsigns.
        </Text>
      }
    >
      <Stack gap="lg">
        <WebSerialExperimentalAlert />
        {descriptor ? (
          <Text size="sm" c="dimmed">
            Adapter: {descriptor.label}
            {attributionNames ? ` (${attributionNames})` : ''}
          </Text>
        ) : null}
        {warnFactoryReset ? (
          <Alert color="yellow" title="Factory reset">
            Restore for this radio depends on a live address map. After a factory reset, a backup
            taken beforehand cannot be restored — remapping those bases is out of scope.
          </Alert>
        ) : null}
        {readError ? (
          <ErrorPanel testId="backup-page-read-error" outcome={readError} retryLabel={null} />
        ) : null}
        {d890Model ? <RangeChangeBanner buildId={build.id} /> : null}

        {d890Model ? (
          <AtD890VitalBackupPanel
            busy={busy}
            serialOk={serialOk}
            session={vital}
            onBackup={() => void handleBackupVital()}
            onOpenFile={(f) => void handleOpenVitalFile(f)}
            onClear={() => setVital(null)}
          />
        ) : null}

        {rt95Model ? (
          <Rt95SafetyBackupPanel
            busy={busy}
            serialOk={serialOk}
            result={safety}
            onBackup={(region, serial) => void handleBackupSafety(region, serial)}
            onClear={() => setSafety(null)}
          />
        ) : null}

        {supportsReadIntoLibrary ? (
          <ReadIntoLibraryPanel
            busy={busy}
            serialOk={serialOk && Boolean(readProjectId)}
            outcome={readOutcome}
            onRead={() => void handleReadIntoLibrary()}
            onClear={() => setReadOutcome(null)}
          />
        ) : null}

        {!backup ? (
          <FormSection title="Backup">
            <BackupLabelFields
              idPrefix="backup-new"
              value={labels}
              onCommit={setLabels}
              disabled={busy}
            />
            <Group gap="sm" mt="sm">
              <Button
                size="sm"
                disabled={busy || !serialOk || descriptors.length === 0}
                onClick={() => void handleBackupRadio()}
              >
                Backup radio
              </Button>
              <FileButton
                resetRef={fileResetRef}
                onChange={(f) => void handleOpenFile(f)}
                accept=".zip"
              >
                {(props) => (
                  <Button size="sm" variant="secondary" disabled={busy} {...props}>
                    Open backup file
                  </Button>
                )}
              </FileButton>
            </Group>
            {!serialOk ? (
              <Text size="sm" mt="sm">
                {getRadioSerialUnsupportedMessage()} You can still open a backup file offline.
              </Text>
            ) : (
              <Text size="sm" mt="sm">
                Backup radio downloads a zip first, then shows what was captured. Open backup file
                works without a radio connected.
              </Text>
            )}
          </FormSection>
        ) : (
          <>
            <FormSection title="Restore">
              <Button
                size="sm"
                variant="destructive"
                disabled={
                  busy ||
                  restoreDialogOpen ||
                  restoreFlow.view.busy ||
                  !serialOk ||
                  !restoreAvailable ||
                  selectedRegionIds.size === 0
                }
                onClick={handleOpenRestoreDialog}
              >
                Restore to radio
              </Button>
              <Text size="sm" mt="sm" c="dimmed">
                {restoreProdHidden
                  ? RADIO_RESTORE_PROD_DISABLED_MESSAGE
                  : restoreAvailable
                    ? 'Restore writes selected restorable regions from this zip. Inspect-only regions are never sent.'
                    : 'Restore not available for this radio yet. Backup and inspect are available.'}
              </Text>
            </FormSection>
            <FormSection title="Archive">
              <Text size="sm">
                {backup.manifest.descriptorLabel} · {backup.manifest.radioModelId}
                {backup.manifest.firmware ? ` · firmware ${backup.manifest.firmware}` : ''}
                {backup.manifest.serial ? ` · serial ${backup.manifest.serial}` : ''}
                {` · ${backup.manifest.imageByteLength} bytes`}
                {` · ${new Date(backup.manifest.capturedAt).toLocaleString()}`}
              </Text>
              {backupLabelSummary(backup.manifest) ? (
                <Text size="sm" fw={600} data-testid="backup-label-summary">
                  {backupLabelSummary(backup.manifest)}
                </Text>
              ) : null}
              <Text size="sm" c="dimmed" mt="xs">
                {coverageCopy(backup.manifest.coverage)}
              </Text>
              <Stack gap="xs" mt="sm">
                <Text size="sm" fw={600}>
                  Your notes on this backup
                </Text>
                <BackupLabelFields
                  idPrefix="backup-open"
                  value={{
                    radioName: backup.manifest.radioName,
                    label: backup.manifest.label,
                    description: backup.manifest.description,
                  }}
                  onCommit={handleRelabel}
                  disabled={busy}
                />
                <Text size="xs" c="dimmed">
                  Edits change the saved zip only after you choose Save zip again.
                </Text>
              </Stack>
              <Group gap="sm" mt="sm">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => downloadRadioBackupZip(backup.zipBytes, backup.manifest)}
                >
                  Save zip again
                </Button>
                <Button
                  size="sm"
                  disabled={busy || !serialOk}
                  onClick={() => void handleBackupRadio()}
                >
                  Read again
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={handleClearSession}>
                  Clear
                </Button>
                <FileButton
                  resetRef={fileResetRef}
                  onChange={(f) => void handleOpenFile(f)}
                  accept=".zip"
                >
                  {(props) => (
                    <Button size="sm" variant="ghost" disabled={busy} {...props}>
                      Open backup file
                    </Button>
                  )}
                </FileButton>
              </Group>
            </FormSection>
            <FormSection title="Regions">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Region</Table.Th>
                    <Table.Th>Address</Table.Th>
                    <Table.Th>Size</Table.Th>
                    <Table.Th>Restore</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {backup.manifest.regions.map((region) => {
                    const unavailable = restoreRegionUnavailableReason(
                      backup.manifest,
                      region,
                      profileId,
                    );
                    return (
                      <Table.Tr key={region.id}>
                        <Table.Td>{region.label}</Table.Td>
                        <Table.Td>
                          <Text ff="monospace" size="sm">
                            0x{region.address.toString(16)}
                          </Text>
                        </Table.Td>
                        <Table.Td>{region.byteLength}</Table.Td>
                        <Table.Td>
                          {region.restoreRole === 'restorable' && unavailable ? (
                            <Text size="sm" c="dimmed">
                              {unavailable}
                            </Text>
                          ) : region.restoreRole === 'restorable' ? (
                            <Group gap="xs">
                              <Checkbox
                                checked={selectedRegionIds.has(region.id)}
                                disabled={busy || restoreDialogOpen || !restoreAvailable}
                                onCheckedChange={(checked) =>
                                  toggleRestorableRegion(region.id, checked)
                                }
                                aria-label={`Restore ${region.label}`}
                              />
                              <Text size="sm">Restorable</Text>
                            </Group>
                          ) : (
                            <Text size="sm" c="dimmed">
                              Inspect only
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </FormSection>
            <Dm32CalibrationBackupPanel session={backup} />
            {backup.inspectBag ? (
              <RadioCloneSummaryView
                bag={backup.inspectBag}
                variant="inspect"
                userDatabaseOccupied={backup.userDatabaseOccupied}
              />
            ) : null}
          </>
        )}

        <FormSection title="Backups saved this session">
          {backupsThisSession.length === 0 ? (
            <Text size="sm" c="dimmed">
              No backups this session
            </Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Radio</Table.Th>
                  <Table.Th>Serial</Table.Th>
                  <Table.Th>Saved</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {[...backupsThisSession].reverse().map((b, i) => (
                  <Table.Tr key={`${b.at}-${i}`}>
                    <Table.Td>
                      <BackupRadioLabel backup={b} />
                    </Table.Td>
                    <Table.Td>{b.serial || '—'}</Table.Td>
                    <Table.Td>
                      {new Date(b.at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          <Text size="xs" c="dimmed" mt="xs">
            This list is kept in this tab only and clears when you reload. Backups from the Write
            review are listed too.
          </Text>
        </FormSection>

        <RadioRestoreDialog
          options={restoreShell}
          view={restoreFlow.view}
          actions={{
            ...restoreFlow.actions,
            onBackToExport: () => {
              restoreFlow.actions.onBackToExport();
              navigate(`/builds/${build.id}/export`);
            },
          }}
        />
        <RadioIoProgressModal
          opened={busy}
          operation={operation}
          phase={phase}
          progress={progress}
          transferStages={transferStages}
          plan={plan}
          navigationBlocked={leaveAttempted}
          onCancel={handleCancel}
          onClose={handleProgressClose}
        />
      </Stack>
    </FormPage>
  );
}
