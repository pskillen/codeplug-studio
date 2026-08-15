/**
 * Web Serial connect / write (assemble → overlay this PROGRAM session → radio)
 * for egress pathways with a registered radio adapter.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Anchor, Button, Group, Stack, Text } from '@mantine/core';
import { BuildCapabilityTrait, traitProfileFor } from '@core/models/traits.ts';
import {
  dualBankOptionsFromWriteSource,
  singleBankProjectionFromWriteSource,
  writeSourceIncludesDirectory,
  type DigitalContactsWriteSource,
  type DualBankWriteMode,
  type SingleBankWriteMode,
} from '@core/domain/digitalIdDirectoryProjection.ts';
import {
  ModalShell,
  WriteVerifyReport as WriteVerifyReportV2,
  Button as V2Button,
  ConfirmModal,
} from '../v2/index.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { ProgressUpdate, RadioSession } from '@integrations/radio-io/types.ts';
import type {
  WriteVerifyPendingPayload,
  WriteVerifyResult,
} from '@integrations/radio-io/writeVerify.ts';
import { findAttribution } from '../../lib/attributions.ts';
import { loadLibrarySlice } from '../../lib/loadLibrarySlice.ts';
import { useUnsavedNavigationGuard } from '../../hooks/useUnsavedNavigationGuard.ts';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';
import { useBuildLayout } from '../../routes/builds/BuildLayoutContext.tsx';
import { useProjects } from '../../state/useProjects.ts';
import {
  buildHasRadioCloneHydration,
  closeRadioSession,
  descriptorsForEgress,
  getRadioCloneHydration,
  getRadioSerialUnsupportedMessage,
  isRadioSerialSupported,
  openRadioSessionForEgress,
  prepareRadioWriteImage,
  RadioWriteBlockedError,
  readAtD890ConnectedRadioIdentity,
  uploadPreparedRadioWrite,
  verifyRadioWrite,
} from '../../services/radioIoSession.ts';
import {
  clearWriteVerifyPending,
  deserializeWriteVerifyPending,
  loadWriteVerifyPending,
  saveWriteVerifyPending,
  serializeWriteVerifyPending,
} from '../../services/writeVerifyStorage.ts';
import RadioIoProgressModal, {
  type RadioIoOperation,
  type RadioIoProgressPhase,
  type RadioIoWriteVerifyStatus,
} from './RadioIoProgressModal.tsx';
import WriteVerifyReport from './WriteVerifyReport.tsx';
import { mapWriteVerifyResultToV2Report } from './writeVerifyReportV2Adapter.ts';
import WebSerialExperimentalAlert from './WebSerialExperimentalAlert.tsx';
import AtD890WriteCoverageTable from './AtD890WriteCoverageTable.tsx';
import { DM32_ANALOG_CONTACTS_WRITE_GAP } from '@integrations/radio-io/radios/dm32uv/writeRole.ts';
import { AT_D890_DIGITAL_CONTACTS_WRITE_GAP } from '@integrations/radio-io/radios/at-d890uv/writeRole.ts';
import {
  resolveRadioWriteGate,
  resolveRadioWriteProdDisabledMessage,
} from '../../services/radioWriteEnvGate.ts';
import { isOpenGd77RadioIoEgress } from '../../services/radioIoChannelMap.ts';
import {
  getSatelliteKepsWriteAdapter,
  hasSatelliteKepsWriteAdapter,
  satelliteKepsCapacityWarning,
  type SatelliteKepsWriteResult,
} from '../../services/satelliteKepsWriteAdapters.ts';
import WriteRadioModal from './WriteRadioModal.tsx';

export interface BuildRadioIoPanelProps {
  build: RadioBuild;
  /** Web Serial pathway carrying format/profile/hydration (#654). */
  egress: EgressPath;
}

const buildService = new BuildService(persistence);
const VERIFY_BUTTON_DEBOUNCE_MS = 5000;

type PendingVerifyPayload = WriteVerifyPendingPayload;

export default function BuildRadioIoPanel({ build, egress }: BuildRadioIoPanelProps) {
  const descriptors = descriptorsForEgress(egress);
  const { activeProjectId } = useProjects();
  const { reloadEgressPaths } = useBuildLayout();
  const sessionRef = useRef<RadioSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingVerifyRef = useRef<PendingVerifyPayload | null>(null);
  const verifyStartedRef = useRef(false);
  const verifyReadActiveRef = useRef(false);

  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<RadioIoOperation>('read');
  const [phase, setPhase] = useState<RadioIoProgressPhase>('connecting');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [writeWarnings, setWriteWarnings] = useState<string[]>([]);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [transferStages, setTransferStages] = useState<string[]>([]);
  const [writeVerifyStatus, setWriteVerifyStatus] = useState<RadioIoWriteVerifyStatus>('none');
  const [verifyButtonEnabled, setVerifyButtonEnabled] = useState(false);
  const [verifyResult, setVerifyResult] = useState<WriteVerifyResult | null>(null);
  const [writeConfirmOpen, setWriteConfirmOpen] = useState(false);
  const [writeConfirmSerial, setWriteConfirmSerial] = useState<string | null>(null);
  const pendingWriteModeRef = useRef<DualBankWriteMode | SingleBankWriteMode | null>(null);
  const [writeRadioOpen, setWriteRadioOpen] = useState(false);
  const [contactSource, setContactSource] = useState<DigitalContactsWriteSource>('none');
  const [kepsSelected, setKepsSelected] = useState(false);
  const [emptyDirectoryOpen, setEmptyDirectoryOpen] = useState(false);
  const pendingEmptyDirectoryWriteRef = useRef<(() => void) | null>(null);
  const [kepsCapacityWarning, setKepsCapacityWarning] = useState<string | null>(null);
  const [kepsWriteSummary, setKepsWriteSummary] = useState<SatelliteKepsWriteResult | null>(null);

  const serialOk = isRadioSerialSupported();
  const descriptor = descriptors[0];
  const writeVerifyHooks = descriptor?.writeVerify;
  const supportsWriteVerify = Boolean(writeVerifyHooks);
  const writeGate = resolveRadioWriteGate(descriptor);
  const writeHidden = writeGate === 'hidden';
  const hydration = getRadioCloneHydration(egress);
  const hasHydration = buildHasRadioCloneHydration(egress);
  const requiresD890WriteConfirm = egress.profileId === 'radio-io-at-d890uv';
  const supportsKepsWrite = hasSatelliteKepsWriteAdapter(egress.profileId);
  const kepsWriteFn = getSatelliteKepsWriteAdapter(egress.profileId);
  const dualBankTraitProfile = traitProfileFor(egress.profileId);
  const supportsDualBankWrite = Boolean(
    dualBankTraitProfile?.traits.includes(BuildCapabilityTrait.SeparateDigitalIdList),
  );
  const supportsSingleBankWrite =
    egress.profileId === 'radio-io-at-d890uv' && !supportsDualBankWrite;
  const supportsDigitalContacts = supportsDualBankWrite || supportsSingleBankWrite;

  const { modalOpen: leaveAttempted, stay } = useUnsavedNavigationGuard(busy);

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

  const loadPendingVerify = useCallback((): PendingVerifyPayload | null => {
    if (pendingVerifyRef.current) return pendingVerifyRef.current;
    const stored = loadWriteVerifyPending(build.id, egress.id, egress.profileId);
    if (!stored) return null;
    return deserializeWriteVerifyPending(stored);
  }, [build.id, egress.id, egress.profileId]);

  const clearPendingVerify = useCallback((): void => {
    pendingVerifyRef.current = null;
    verifyStartedRef.current = false;
    verifyReadActiveRef.current = false;
    clearWriteVerifyPending();
  }, []);

  const attributionNames = (descriptor?.attributionIds ?? [])
    .map((id) => findAttribution(id)?.name)
    .filter(Boolean)
    .join(' / ');

  function onProgress(p: ProgressUpdate) {
    if (verifyReadActiveRef.current) {
      setPhase('verifying');
      setProgress(p);
      return;
    }
    setPhase('transfer');
    setProgress(p);
    if (p.stage) {
      setTransferStages((prev) => (prev.includes(p.stage!) ? prev : [...prev, p.stage!]));
    }
  }

  function beginBusy(next: RadioIoOperation): void {
    setError(null);
    setBusy(true);
    setOperation(next);
    setPhase('connecting');
    setProgress(null);
    setTransferStages([]);
    setWriteVerifyStatus('none');
    setVerifyButtonEnabled(false);
    setVerifyResult(null);
    setKepsWriteSummary(null);
    verifyStartedRef.current = false;
    verifyReadActiveRef.current = false;
    clearPendingVerify();
    abortRef.current = new AbortController();
  }

  async function releaseSession(): Promise<void> {
    const session = sessionRef.current;
    sessionRef.current = null;
    setConnected(false);
    if (session) await closeRadioSession(session);
  }

  async function ensureSession(forWrite = false): Promise<RadioSession> {
    if (sessionRef.current) return sessionRef.current;
    const { session } = await openRadioSessionForEgress(egress, {
      forcePortSelection: true,
      purpose: forWrite ? 'write' : 'read',
    });
    sessionRef.current = session;
    setConnected(true);
    return session;
  }

  const handleVerifyWrite = useCallback(async () => {
    const pending = loadPendingVerify();
    if (!pending) return;
    if (verifyStartedRef.current) return;
    verifyStartedRef.current = true;
    verifyReadActiveRef.current = true;
    setWriteVerifyStatus('verifying');
    setPhase('verifying');
    setProgress(null);
    setError(null);
    if (!abortRef.current) {
      abortRef.current = new AbortController();
    }
    try {
      const session = await ensureSession();
      setPhase('verifying');
      const result = await verifyRadioWrite(session, pending, {
        onProgress,
        signal: abortRef.current.signal,
      });
      await releaseSession();
      clearPendingVerify();
      verifyReadActiveRef.current = false;
      abortRef.current = null;
      setProgress(null);
      setError(null);
      setVerifyResult(result);
      setWriteVerifyStatus('none');
      setPhase('done');
      setBusy(false);
    } catch (err) {
      verifyStartedRef.current = false;
      verifyReadActiveRef.current = false;
      setError(err instanceof Error ? err.message : String(err));
      setWriteVerifyStatus('unverified');
      setVerifyButtonEnabled(true);
      setPhase('done');
      await releaseSession();
    }
  }, [clearPendingVerify, loadPendingVerify]);

  useEffect(() => {
    if (writeVerifyStatus !== 'unverified' || verifyButtonEnabled) return;

    const timer = window.setTimeout(() => setVerifyButtonEnabled(true), VERIFY_BUTTON_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [writeVerifyStatus, verifyButtonEnabled]);

  if (descriptors.length === 0) return null;

  async function handleWriteWithContactBanks(mode: DualBankWriteMode | SingleBankWriteMode) {
    setWriteWarnings([]);
    beginBusy('write');
    try {
      if (!activeProjectId) {
        throw new Error('No active project.');
      }
      const library = await loadLibrarySlice(persistence, activeProjectId);
      setPhase('preparing');
      const dualBankOptions = dualBankOptionsFromWriteSource(contactSource);
      const singleBankProjection = singleBankProjectionFromWriteSource(contactSource);
      const { image, warnings, organisation, channels } = await prepareRadioWriteImage(
        build,
        egress,
        library,
        supportsDualBankWrite
          ? {
              dualBank: { mode, options: dualBankOptions },
              persistence,
              projectId: activeProjectId,
            }
          : supportsSingleBankWrite
            ? {
                singleBank: { mode, projectionMode: singleBankProjection },
                persistence,
                projectId: activeProjectId,
              }
            : undefined,
      );
      setPhase('connecting');
      const session = await ensureSession(true);
      setPhase('transfer');
      const uploadResult = await uploadPreparedRadioWrite(session, egress, image, {
        onProgress,
        signal: abortRef.current!.signal,
        organisation,
        channels,
      });
      if (warnings.length > 0 || (uploadResult.warnings?.length ?? 0) > 0) {
        setWriteWarnings([...warnings, ...(uploadResult.warnings ?? [])]);
      }
      await releaseSession();
      if (supportsWriteVerify && uploadResult.writeVerifyPending) {
        const pending: PendingVerifyPayload = uploadResult.writeVerifyPending;
        pendingVerifyRef.current = pending;
        saveWriteVerifyPending(
          serializeWriteVerifyPending(build.id, egress.id, egress.profileId, pending),
        );
        setVerifyButtonEnabled(false);
        setWriteVerifyStatus('unverified');
      } else {
        clearPendingVerify();
      }
      setPhase('done');
    } catch (err) {
      if (err instanceof RadioWriteBlockedError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
      await releaseSession();
      setBusy(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  async function beginWriteWithContactBanks(mode: DualBankWriteMode | SingleBankWriteMode) {
    if (!requiresD890WriteConfirm) {
      await handleWriteWithContactBanks(mode);
      return;
    }
    setWriteWarnings([]);
    beginBusy('write');
    try {
      setPhase('connecting');
      const session = await ensureSession(true);
      const { serial } = await readAtD890ConnectedRadioIdentity(session, {
        signal: abortRef.current!.signal,
      });
      pendingWriteModeRef.current = mode;
      setWriteConfirmSerial(serial || '(serial unreadable)');
      setWriteConfirmOpen(true);
      setBusy(false);
      setProgress(null);
      setPhase('done');
    } catch (err) {
      if (err instanceof RadioWriteBlockedError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
      await releaseSession();
      setBusy(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  function handleCancelWriteConfirm() {
    setWriteConfirmOpen(false);
    setWriteConfirmSerial(null);
    pendingWriteModeRef.current = null;
    void releaseSession().then(() => {
      resetProgressState();
    });
  }

  function handleConfirmWrite() {
    const mode = pendingWriteModeRef.current;
    setWriteConfirmOpen(false);
    setWriteConfirmSerial(null);
    pendingWriteModeRef.current = null;
    if (!mode) return;
    void handleWriteWithContactBanks(mode);
  }

  function openWriteRadio() {
    setContactSource('none');
    setKepsSelected(false);
    setKepsCapacityWarning(null);
    window.setTimeout(() => setWriteRadioOpen(true), 0);
  }

  async function guardDirectoryThenWrite(mode: DualBankWriteMode | SingleBankWriteMode) {
    setWriteRadioOpen(false);
    if (supportsDigitalContacts && writeSourceIncludesDirectory(contactSource) && activeProjectId) {
      const count = await persistence.countDigitalIdDirectoryEntries(activeProjectId);
      if (count === 0) {
        pendingEmptyDirectoryWriteRef.current = () => {
          void beginWriteWithContactBanks(mode);
        };
        setEmptyDirectoryOpen(true);
        return;
      }
    }
    await beginWriteWithContactBanks(mode);
  }

  function handleEmptyDirectoryCancel() {
    setEmptyDirectoryOpen(false);
    pendingEmptyDirectoryWriteRef.current = null;
  }

  function handleEmptyDirectoryConfirm() {
    const pending = pendingEmptyDirectoryWriteRef.current;
    setEmptyDirectoryOpen(false);
    pendingEmptyDirectoryWriteRef.current = null;
    pending?.();
  }

  async function handleWriteKepsFromPopup() {
    if (!kepsWriteFn || !kepsSelected) return;
    setWriteRadioOpen(false);
    if (!activeProjectId) {
      setError('No active project.');
      return;
    }
    const allSatellites = await persistence.listSatellites(activeProjectId);
    const satellites = allSatellites.filter((s) => s.enabled);
    const capacityWarning = satelliteKepsCapacityWarning(egress.profileId, satellites);
    if (capacityWarning) {
      setKepsCapacityWarning(capacityWarning);
      return;
    }
    setKepsCapacityWarning(null);
    setKepsWriteSummary(null);
    beginBusy('keps-write');
    try {
      setPhase('preparing');
      const session = await ensureSession(true);
      setPhase('transfer');
      const result = await kepsWriteFn(session, satellites, {
        onProgress,
        signal: abortRef.current!.signal,
        satelliteOverrides: build.satelliteOverrides,
      });
      setKepsWriteSummary(result);
      await releaseSession();
      setPhase('done');
    } catch (err) {
      if (err instanceof RadioWriteBlockedError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
      await releaseSession();
      setBusy(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  function resetProgressState(): void {
    setBusy(false);
    setProgress(null);
    setWriteVerifyStatus('none');
    setVerifyButtonEnabled(false);
    clearPendingVerify();
    abortRef.current = null;
  }

  function handleCloseVerifyReport(): void {
    setVerifyResult(null);
    resetProgressState();
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  function handleProgressClose() {
    resetProgressState();
  }

  function handleCloseWithoutVerify() {
    resetProgressState();
  }

  async function handleDisconnect() {
    await releaseSession();
  }

  async function handleClearHydration() {
    if (!hasHydration) return;
    const next = buildService.clearEgressHydration(egress);
    const saved = await buildService.putEgressPath(next, egress.revision);
    if (!saved.ok) {
      setError('Could not clear stored radio image.');
      return;
    }
    await reloadEgressPaths();
  }

  return (
    <Stack gap="sm">
      <ModalShell
        open={verifyResult !== null}
        onClose={handleCloseVerifyReport}
        title="Write verify report"
        size="lg"
        footer={
          <V2Button variant="primary" size="sm" onClick={handleCloseVerifyReport}>
            Close
          </V2Button>
        }
      >
        {verifyResult ? (
          <Stack gap="md">
            <WriteVerifyReportV2
              title="Verify results"
              {...mapWriteVerifyResultToV2Report(verifyResult)}
            />
            {writeVerifyHooks ? (
              <WriteVerifyReport
                result={verifyResult}
                debugContext={{
                  buildId: build.id,
                  egressId: egress.id,
                  formatId: egress.formatId,
                  profileId: egress.profileId,
                  measuredAt: new Date().toISOString(),
                  buildVersion: __BUILD_VERSION__,
                  buildEnv: __BUILD_ENV__,
                  pageUrl: window.location.href,
                  userAgent: navigator.userAgent,
                }}
                formatDebugMarkdown={writeVerifyHooks.formatDebugMarkdown}
                onClose={handleCloseVerifyReport}
                inModal
                keptSectionTitle={
                  egress.profileId === 'radio-io-at-d890uv' ? 'Preserved settings' : undefined
                }
                keptSummaryLabel={
                  egress.profileId === 'radio-io-at-d890uv' ? '6 sentinel regions' : undefined
                }
              />
            ) : null}
          </Stack>
        ) : null}
      </ModalShell>
      <ConfirmModal
        open={writeConfirmOpen}
        onClose={handleCancelWriteConfirm}
        title="Confirm connected radio"
        confirmLabel="Write to this radio"
        tone="destructive"
        onConfirm={handleConfirmWrite}
      >
        <Stack gap="sm">
          <Text size="sm">
            Studio read the connected radio&apos;s serial from LocalInfo. Confirm this is the
            handheld you intend to program before Write commits to flash.
          </Text>
          <Text size="sm" fw={600}>
            Serial: {writeConfirmSerial ?? '—'}
          </Text>
        </Stack>
      </ConfirmModal>
      <ConfirmModal
        open={emptyDirectoryOpen}
        onClose={handleEmptyDirectoryCancel}
        title="RadioID directory is empty"
        confirmLabel="Write anyway"
        cancelLabel="Cancel"
        onConfirm={handleEmptyDirectoryConfirm}
      >
        <Text size="sm">
          The local RadioID directory shadow has no rows. Fetch or import a directory before
          writing, or continue if you intend to write without directory contacts.
        </Text>
      </ConfirmModal>
      <WriteRadioModal
        open={writeRadioOpen}
        onClose={() => setWriteRadioOpen(false)}
        buildId={build.id}
        serialOk={serialOk}
        busy={busy}
        writeHidden={writeHidden}
        supportsDigitalContacts={supportsDigitalContacts}
        sharedContactBankNote={isOpenGd77RadioIoEgress(egress.profileId)}
        sharedAddressBookNote={egress.profileId === 'radio-io-dm32uv'}
        supportsKeps={supportsKepsWrite}
        contactSource={contactSource}
        onContactSourceChange={setContactSource}
        kepsSelected={kepsSelected}
        onKepsSelectedChange={setKepsSelected}
        onWriteCodeplug={() => void guardDirectoryThenWrite('codeplug')}
        onWriteContacts={() => void guardDirectoryThenWrite('digitalIdList')}
        onWriteKeps={() => void handleWriteKepsFromPopup()}
      />
      <WebSerialExperimentalAlert />
      <Text fw={600} size="sm">
        Direct radio (Web Serial)
      </Text>
      <Text size="sm" c="dimmed">
        {requiresD890WriteConfirm
          ? 'Write assembles modelled channels and organisation from the build, then reads co-resident bytes from the connected radio during upload. Unmodelled settings are preserved via erase-unit read-modify-write — not from a stored project image. Use Backup / Restore for a zip snapshot and ephemeral inspection.'
          : 'Write overlays modelled channels and organisation onto an in-session read of the connected radio. Unmodelled settings are preserved from that live FLASH image — not from a stored project clone. Identity is the radio on the cable this session, not a saved stash. Use Backup / Restore for a zip snapshot.'}
      </Text>
      {!serialOk ? <Alert color="yellow">{getRadioSerialUnsupportedMessage()}</Alert> : null}
      {attributionNames ? (
        <Text size="xs" c="dimmed">
          Protocol lineage thanks to {attributionNames}. See{' '}
          <Anchor href="/attributions" size="xs">
            Attributions
          </Anchor>
          .
        </Text>
      ) : null}
      {egress.profileId === 'radio-io-at-d890uv' ? (
        <AtD890WriteCoverageTable buildId={build.id} hasHydration={hasHydration} />
      ) : null}
      <Group gap="xs">
        {!writeHidden ? (
          <Button size="xs" disabled={!serialOk || busy} onClick={openWriteRadio}>
            Write radio
          </Button>
        ) : null}
        <Button
          size="xs"
          variant="subtle"
          disabled={busy || !connected}
          onClick={() => void handleDisconnect()}
        >
          Disconnect
        </Button>
      </Group>
      {hasHydration && hydration ? (
        <Alert color="gray" title="Stored radio image (unused for Write)">
          <Text size="sm">
            Model {hydration.retain.radioModelId}
            {hydration.retain.firmware ? ` · firmware ${hydration.retain.firmware}` : ''}
            {' · '}
            {hydration.retain.imageByteLength} bytes
            {hydration.capturedAt
              ? ` · captured ${new Date(hydration.capturedAt).toLocaleString()}`
              : ''}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            This leftover clone is not a Write input. Snapshot and inspect on{' '}
            <Anchor component={Link} to={`/builds/${build.id}/backup`} size="xs">
              Backup / Restore
            </Anchor>
            .
          </Text>
          <Button size="xs" variant="subtle" mt="xs" onClick={() => void handleClearHydration()}>
            Clear stored image
          </Button>
        </Alert>
      ) : writeHidden ? (
        <Text size="xs" c="dimmed">
          {resolveRadioWriteProdDisabledMessage(egress.profileId)}
        </Text>
      ) : (
        <Text size="xs" c="dimmed">
          Snapshot and inspect this radio on{' '}
          <Anchor component={Link} to={`/builds/${build.id}/backup`} size="xs">
            Backup / Restore
          </Anchor>
          . Write uses a live in-session read.
        </Text>
      )}
      {egress.profileId === 'radio-io-dm32uv' ? (
        <Text size="xs" c="dimmed">
          {DM32_ANALOG_CONTACTS_WRITE_GAP}
        </Text>
      ) : null}
      {egress.profileId === 'radio-io-at-d890uv' && !supportsSingleBankWrite ? (
        <Text size="xs" c="dimmed">
          {AT_D890_DIGITAL_CONTACTS_WRITE_GAP}
        </Text>
      ) : null}
      {error ? <Alert color="red">{error}</Alert> : null}
      {kepsCapacityWarning ? (
        <Alert color="yellow" title="Write capacity">
          <Text size="sm">{kepsCapacityWarning}</Text>
        </Alert>
      ) : null}
      {kepsWriteSummary ? (
        <Alert
          color={
            kepsWriteSummary.skipped.length > 0 || kepsWriteSummary.skippedTransmitters.length > 0
              ? 'yellow'
              : 'green'
          }
          title="Keps write"
        >
          <Stack gap={4}>
            <Text size="sm">{kepsWriteSummary.written} transmitter(s) written.</Text>
            {kepsWriteSummary.skipped.map((s) => (
              <Text key={`keps-skipped-${s.satelliteId}`} size="sm" c="dimmed">
                Skipped {s.satelliteId}: {s.reason}
              </Text>
            ))}
            {kepsWriteSummary.skippedTransmitters.map((s) => (
              <Text key={`keps-skipped-tx-${s.transmitterId}`} size="sm" c="dimmed">
                Skipped {s.satelliteId} / {s.transmitterId}: {s.reason}
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}
      {writeWarnings.length > 0 ? (
        <Alert color="yellow" title="Write warnings">
          <Stack gap={4}>
            {writeWarnings.map((line, index) => (
              <Text key={`write-warning-${index}`} size="sm">
                {line}
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}
      <RadioIoProgressModal
        opened={busy}
        operation={operation}
        phase={phase}
        progress={progress}
        transferStages={transferStages}
        navigationBlocked={leaveAttempted}
        writeVerifyStatus={writeVerifyStatus}
        requiresCrossSessionReconnect={writeVerifyHooks?.requiresCrossSessionReconnect ?? true}
        verifyButtonEnabled={verifyButtonEnabled}
        onVerify={() => void handleVerifyWrite()}
        onCloseWithoutVerify={handleCloseWithoutVerify}
        onCancel={handleCancel}
        onClose={handleProgressClose}
      />
    </Stack>
  );
}
