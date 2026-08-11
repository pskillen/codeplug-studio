/**
 * Web Serial connect / read (hydrate EgressPath) / write (assemble → radio)
 * for egress pathways with a registered radio adapter.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Anchor, Button, Group, Stack, Text } from '@mantine/core';
import {
  ModalShell,
  WriteVerifyReport as WriteVerifyReportV2,
  Button as V2Button,
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
  readRadioHydrationForBuild,
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
import { hasSatelliteKepsWriteAdapter } from '../../services/satelliteKepsWriteAdapters.ts';

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
  const [lastFirmware, setLastFirmware] = useState<string | undefined>();
  const [lastOccupied, setLastOccupied] = useState<number | null>(null);
  const [writeVerifyStatus, setWriteVerifyStatus] = useState<RadioIoWriteVerifyStatus>('none');
  const [verifyButtonEnabled, setVerifyButtonEnabled] = useState(false);
  const [verifyResult, setVerifyResult] = useState<WriteVerifyResult | null>(null);

  const serialOk = isRadioSerialSupported();
  const descriptor = descriptors[0];
  const writeVerifyHooks = descriptor?.writeVerify;
  const supportsWriteVerify = Boolean(writeVerifyHooks);
  const writeGate = resolveRadioWriteGate(descriptor);
  const writeHidden = writeGate === 'hidden';
  const hydration = getRadioCloneHydration(egress);
  const hasHydration = buildHasRadioCloneHydration(egress);
  /**
   * Workflow B (#859, promoted to its own tab by #1085): "Write Keps…" now links to the
   * dedicated Satellite Keps tab (`/builds/:id/satellite-keps`, `BuildSatelliteKepsPage`) instead
   * of triggering the write inline — gated the same way, on a registered adapter for this egress
   * profile.
   */
  const showsWriteKepsLink = hasSatelliteKepsWriteAdapter(egress.profileId);

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

  async function handleRead() {
    beginBusy('read');
    try {
      const session = await ensureSession();
      setPhase('transfer');
      const result = await readRadioHydrationForBuild(session, {
        onProgress,
        signal: abortRef.current!.signal,
      });
      setPhase('saving');
      setProgress(null);
      const next = buildService.withEgressHydration(egress, result.hydration);
      const saved = await buildService.putEgressPath(next, egress.revision);
      if (!saved.ok) {
        throw new Error(
          saved.reason === 'revision_conflict'
            ? 'Egress changed elsewhere — reload and try again.'
            : 'Could not save radio hydration on the egress pathway.',
        );
      }
      await reloadEgressPaths();
      setLastFirmware(result.firmware);
      setLastOccupied(result.channelCountOccupied);
      await releaseSession();
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await releaseSession();
      setBusy(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  async function handleWrite() {
    setWriteWarnings([]);
    beginBusy('write');
    try {
      if (!activeProjectId) {
        throw new Error('No active project.');
      }
      const library = await loadLibrarySlice(persistence, activeProjectId);
      setPhase('preparing');
      const { image, warnings, organisation } = prepareRadioWriteImage(build, egress, library);
      setPhase('connecting');
      const session = await ensureSession(true);
      setPhase('transfer');
      const uploadResult = await uploadPreparedRadioWrite(session, egress, image, {
        onProgress,
        signal: abortRef.current!.signal,
        organisation,
      });
      if (warnings.length > 0) setWriteWarnings(warnings);
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
    setLastFirmware(undefined);
    setLastOccupied(null);
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
      <WebSerialExperimentalAlert />
      <Text fw={600} size="sm">
        Direct radio (Web Serial)
      </Text>
      <Text size="sm" c="dimmed">
        Read stores a clone image on this egress pathway so unmodelled settings survive write-back.
        Write sends the assembled build into that image — it does not import channels into the
        library. After a factory reset, Read again before Write (memory-bank addresses can move).
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
        <Button
          size="xs"
          variant="light"
          disabled={!serialOk || busy}
          onClick={() => void handleRead()}
        >
          Read from radio
        </Button>
        {!writeHidden ? (
          <Button
            size="xs"
            disabled={!serialOk || busy || !hasHydration}
            onClick={() => void handleWrite()}
          >
            Write to radio
          </Button>
        ) : null}
        {showsWriteKepsLink && !writeHidden ? (
          <Button
            size="xs"
            variant="light"
            component={Link}
            to={`/builds/${build.id}/satellite-keps`}
          >
            Write Keps…
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
        <Alert color="gray" title="Stored radio image (read-only)">
          <Text size="sm">
            Model {hydration.retain.radioModelId}
            {hydration.retain.firmware || lastFirmware
              ? ` · firmware ${hydration.retain.firmware ?? lastFirmware}`
              : ''}
            {' · '}
            {hydration.retain.imageByteLength} bytes
            {lastOccupied != null ? ` · ${lastOccupied} occupied channels on radio` : ''}
            {hydration.capturedAt
              ? ` · captured ${new Date(hydration.capturedAt).toLocaleString()}`
              : ''}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Unmodelled registers are retained for write-back. See{' '}
            <Anchor component={Link} to={`/builds/${build.id}/radio-image`} size="xs">
              Radio image
            </Anchor>{' '}
            for the retained region map. Settings are not editable here.
          </Text>
          {egress.profileId === 'radio-io-dm32uv' ? (
            <Text size="xs" c="dimmed" mt={4}>
              {DM32_ANALOG_CONTACTS_WRITE_GAP}
            </Text>
          ) : egress.profileId === 'radio-io-at-d890uv' ? (
            <Text size="xs" c="dimmed" mt={4}>
              {AT_D890_DIGITAL_CONTACTS_WRITE_GAP}
            </Text>
          ) : null}
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
          Write requires a prior Read on this egress ({descriptor?.label ?? 'compatible radio'}).
        </Text>
      )}
      {error ? <Alert color="red">{error}</Alert> : null}
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
