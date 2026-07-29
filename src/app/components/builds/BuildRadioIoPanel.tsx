/**
 * Web Serial connect / read (hydrate EgressPath) / write (assemble → radio)
 * for egress pathways with a registered radio adapter.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Anchor, Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { ProgressUpdate, RadioSession } from '@integrations/radio-io/types.ts';
import type { AtD890WriteVerifyResult } from '@integrations/radio-io/radios/at-d890uv/writeMemoryVerify.ts';
import type { AtD890SentinelSnapshot } from '@integrations/radio-io/radios/at-d890uv/sentinelVerify.ts';
import type { AtD890WriteStagingSnapshot } from '@integrations/radio-io/radios/at-d890uv/writeMemoryVerify.ts';
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
  getWebSerialUnsupportedMessage,
  isWebSerialSupported,
  openRadioSessionForEgress,
  prepareRadioWriteImage,
  RadioWriteBlockedError,
  readRadioHydrationForBuild,
  uploadPreparedRadioWrite,
  verifyAtD890WriteMemory,
} from '../../services/radioIoSession.ts';
import {
  clearAtD890WriteVerifyPending,
  deserializeAtD890WriteVerifyPending,
  loadAtD890WriteVerifyPending,
  saveAtD890WriteVerifyPending,
  serializeAtD890WriteVerifyPending,
} from '../../services/atD890WriteVerifyStorage.ts';
import RadioIoProgressModal, {
  type RadioIoOperation,
  type RadioIoProgressPhase,
  type RadioIoWriteVerifyStatus,
} from './RadioIoProgressModal.tsx';
import AtD890WriteVerifyReport from './AtD890WriteVerifyReport.tsx';
import WebSerialExperimentalAlert from './WebSerialExperimentalAlert.tsx';
import AtD890WriteCoverageTable from './AtD890WriteCoverageTable.tsx';
import { DM32_ANALOG_CONTACTS_WRITE_GAP } from '@integrations/radio-io/radios/dm32uv/writeRole.ts';
import { AT_D890_DIGITAL_CONTACTS_WRITE_GAP } from '@integrations/radio-io/radios/at-d890uv/writeRole.ts';
import {
  resolveRadioWriteGate,
  resolveRadioWriteProdDisabledMessage,
} from '../../services/radioWriteEnvGate.ts';

export interface BuildRadioIoPanelProps {
  build: RadioBuild;
  /** Web Serial pathway carrying format/profile/hydration (#654). */
  egress: EgressPath;
}

const buildService = new BuildService(persistence);
const VERIFY_BUTTON_DEBOUNCE_MS = 5000;

interface PendingVerifyPayload {
  stagingSnapshot: AtD890WriteStagingSnapshot;
  sentinelBefore: AtD890SentinelSnapshot;
}

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
  const [verifyResult, setVerifyResult] = useState<AtD890WriteVerifyResult | null>(null);

  const serialOk = isWebSerialSupported();
  const supportsWriteVerify = egress.profileId === 'radio-io-at-d890uv';
  const hydration = getRadioCloneHydration(egress);
  const hasHydration = buildHasRadioCloneHydration(egress);
  const descriptor = descriptors[0];
  const writeGate = resolveRadioWriteGate(descriptor);
  const writeHidden = writeGate === 'hidden';

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
    const stored = loadAtD890WriteVerifyPending(build.id, egress.id);
    if (!stored) return null;
    return deserializeAtD890WriteVerifyPending(stored);
  }, [build.id, egress.id]);

  const clearPendingVerify = useCallback((): void => {
    pendingVerifyRef.current = null;
    verifyStartedRef.current = false;
    verifyReadActiveRef.current = false;
    clearAtD890WriteVerifyPending();
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
      const result = await verifyAtD890WriteMemory(
        session,
        pending.stagingSnapshot,
        pending.sentinelBefore,
        {
          onProgress,
          signal: abortRef.current.signal,
        },
      );
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
      if (supportsWriteVerify && uploadResult.sentinelBefore && uploadResult.stagingSnapshot) {
        const pending: PendingVerifyPayload = {
          stagingSnapshot: uploadResult.stagingSnapshot,
          sentinelBefore: uploadResult.sentinelBefore,
        };
        pendingVerifyRef.current = pending;
        saveAtD890WriteVerifyPending(
          serializeAtD890WriteVerifyPending(
            build.id,
            egress.id,
            pending.stagingSnapshot,
            pending.sentinelBefore,
          ),
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
      <Modal
        opened={verifyResult !== null}
        onClose={handleCloseVerifyReport}
        title="Write verify report"
        size="xl"
        centered
        zIndex={400}
      >
        {verifyResult ? (
          <AtD890WriteVerifyReport
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
            onClose={handleCloseVerifyReport}
            inModal
          />
        ) : null}
        <Group justify="flex-end" mt="md">
          <Button onClick={handleCloseVerifyReport}>Close</Button>
        </Group>
      </Modal>
      <WebSerialExperimentalAlert />
      <Text fw={600} size="sm">
        Direct radio (Web Serial)
      </Text>
      <Text size="sm" c="dimmed">
        Read stores a clone image on this egress pathway so unmodelled settings survive write-back.
        Write sends the assembled build into that image — it does not import channels into the
        library. After a factory reset, Read again before Write (memory-bank addresses can move).
      </Text>
      {!serialOk ? <Alert color="yellow">{getWebSerialUnsupportedMessage()}</Alert> : null}
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
        verifyButtonEnabled={verifyButtonEnabled}
        onVerify={() => void handleVerifyWrite()}
        onCloseWithoutVerify={handleCloseWithoutVerify}
        onCancel={handleCancel}
        onClose={handleProgressClose}
      />
    </Stack>
  );
}
