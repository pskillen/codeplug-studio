/**
 * Per-build ephemeral Radio Info — connect, read, inspect clone summary, optional file export.
 * Session data stays in React memory; never writes egress hydration or project state (#876).
 */

import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, Group, Stack, Text } from '@mantine/core';
import type { RadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import type { ProgressUpdate, RadioSession } from '@integrations/radio-io/types.ts';
import { FormPage, FormSection } from '../../components/ui/index.ts';
import RadioCloneSummaryView from '../../components/builds/RadioCloneSummaryView.tsx';
import RadioIoProgressModal, {
  type RadioIoProgressPhase,
} from '../../components/builds/RadioIoProgressModal.tsx';
import WebSerialExperimentalAlert from '../../components/builds/WebSerialExperimentalAlert.tsx';
import { findAttribution } from '../../lib/attributions.ts';
import { findRadioIoEgress } from '../../lib/buildEgressUi.ts';
import { useUnsavedNavigationGuard } from '../../hooks/useUnsavedNavigationGuard.ts';
import {
  closeRadioSession,
  descriptorsForEgress,
  getRadioSerialUnsupportedMessage,
  isRadioSerialSupported,
  openRadioSessionForEgress,
  readRadioHydrationForBuild,
} from '../../services/radioIoSession.ts';
import { downloadEphemeralRadioCloneHydration } from '../../services/radioInfoExport.ts';
import { Button } from '../../components/v2/index.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';

export default function BuildRadioInfoPage() {
  const { build, egressPaths } = useBuildLayout();
  const radioEgress = findRadioIoEgress(egressPaths);

  const sessionRef = useRef<RadioSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<RadioIoProgressPhase>('connecting');
  const [connected, setConnected] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [transferStages, setTransferStages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ephemeralBag, setEphemeralBag] = useState<RadioCloneHydrationBag | null>(null);
  const [lastFirmware, setLastFirmware] = useState<string | undefined>();
  const [lastOccupied, setLastOccupied] = useState<number | null>(null);

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

  if (!radioEgress) {
    return <Navigate to={`/builds/${build.id}/export`} replace />;
  }

  const descriptors = descriptorsForEgress(radioEgress);
  const descriptor = descriptors[0];
  const serialOk = isRadioSerialSupported();

  const attributionNames = (descriptor?.attributionIds ?? [])
    .map((id) => findAttribution(id)?.name)
    .filter(Boolean)
    .join(' / ');

  function onProgress(p: ProgressUpdate) {
    setPhase('transfer');
    setProgress(p);
    if (p.stage) {
      setTransferStages((prev) => (prev.includes(p.stage!) ? prev : [...prev, p.stage!]));
    }
  }

  function beginBusy(): void {
    setError(null);
    setBusy(true);
    setPhase('connecting');
    setProgress(null);
    setTransferStages([]);
    abortRef.current = new AbortController();
  }

  async function releaseSession(): Promise<void> {
    const session = sessionRef.current;
    sessionRef.current = null;
    setConnected(false);
    if (session) await closeRadioSession(session);
  }

  async function ensureSession(): Promise<RadioSession> {
    if (sessionRef.current) return sessionRef.current;
    const { session } = await openRadioSessionForEgress(radioEgress!, {
      forcePortSelection: true,
      purpose: 'read',
    });
    sessionRef.current = session;
    setConnected(true);
    return session;
  }

  async function handleRead() {
    beginBusy();
    try {
      const session = await ensureSession();
      setPhase('transfer');
      const result = await readRadioHydrationForBuild(session, {
        onProgress,
        signal: abortRef.current!.signal,
      });
      setEphemeralBag(result.hydration);
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

  async function handleDisconnect(): Promise<void> {
    abortRef.current?.abort();
    abortRef.current = null;
    await releaseSession();
    setBusy(false);
    setProgress(null);
  }

  function handleCancel(): void {
    abortRef.current?.abort();
    abortRef.current = null;
    void releaseSession();
    setBusy(false);
    setProgress(null);
  }

  function handleProgressClose(): void {
    setBusy(false);
    setProgress(null);
    abortRef.current = null;
  }

  function handleClearSession(): void {
    setEphemeralBag(null);
    setLastFirmware(undefined);
    setLastOccupied(null);
    setError(null);
  }

  return (
    <FormPage
      title="Radio Info"
      description={
        <Text size="sm" component="span">
          Connect and read the radio for a clone-style summary. This session is ephemeral — nothing
          is saved to your project. Use file export for support bundles; leave this page or clear
          the read to discard.
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
        {!serialOk ? (
          <Alert color="red">{getRadioSerialUnsupportedMessage()}</Alert>
        ) : (
          <FormSection title="Connect and read">
            <Group gap="sm">
              <Button
                size="sm"
                disabled={busy || descriptors.length === 0}
                onClick={() => void handleRead()}
              >
                {ephemeralBag ? 'Read again' : 'Connect and read'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || !connected}
                onClick={() => void handleDisconnect()}
              >
                Disconnect
              </Button>
              {ephemeralBag ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => downloadEphemeralRadioCloneHydration(ephemeralBag)}
                  >
                    Save read to file
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={handleClearSession}>
                    Clear read
                  </Button>
                </>
              ) : null}
            </Group>
            {!ephemeralBag ? (
              <Text size="sm" mt="sm">
                No read in this session yet. Connect your radio and choose{' '}
                <strong>Connect and read</strong> to inspect model, firmware, and on-radio
                occupancy.
              </Text>
            ) : (
              <Text size="sm" mt="sm" c="dimmed">
                Model {ephemeralBag.retain.radioModelId}
                {lastFirmware || ephemeralBag.retain.firmware
                  ? ` · firmware ${lastFirmware ?? ephemeralBag.retain.firmware}`
                  : ''}
                {' · '}
                {ephemeralBag.retain.imageByteLength} bytes
                {lastOccupied != null ? ` · ${lastOccupied} occupied channels` : ''}
                {ephemeralBag.capturedAt
                  ? ` · read ${new Date(ephemeralBag.capturedAt).toLocaleString()}`
                  : ''}
              </Text>
            )}
          </FormSection>
        )}
        {error ? <Alert color="red">{error}</Alert> : null}
        {ephemeralBag ? <RadioCloneSummaryView bag={ephemeralBag} /> : null}
        <RadioIoProgressModal
          opened={busy}
          operation="read"
          phase={phase}
          progress={progress}
          transferStages={transferStages}
          navigationBlocked={leaveAttempted}
          onCancel={handleCancel}
          onClose={handleProgressClose}
        />
      </Stack>
    </FormPage>
  );
}
