/**
 * Web Serial connect / read (hydrate EgressPath) / write (assemble → radio)
 * for egress pathways with a registered radio adapter.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Anchor, Button, Group, Stack, Text } from '@mantine/core';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { ProgressUpdate, RadioSession } from '@integrations/radio-io/types.ts';
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
} from '../../services/radioIoSession.ts';
import RadioIoProgressModal, {
  type RadioIoOperation,
  type RadioIoProgressPhase,
} from './RadioIoProgressModal.tsx';
import WebSerialExperimentalAlert from './WebSerialExperimentalAlert.tsx';
import { DM32_ANALOG_CONTACTS_WRITE_GAP } from '@integrations/radio-io/radios/dm32uv/writeRole.ts';

export interface BuildRadioIoPanelProps {
  build: RadioBuild;
  /** Web Serial pathway carrying format/profile/hydration (#654). */
  egress: EgressPath;
}

const buildService = new BuildService(persistence);

export default function BuildRadioIoPanel({ build, egress }: BuildRadioIoPanelProps) {
  const descriptors = descriptorsForEgress(egress);
  const { activeProjectId } = useProjects();
  const { reloadEgressPaths } = useBuildLayout();
  const sessionRef = useRef<RadioSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<RadioIoOperation>('read');
  const [phase, setPhase] = useState<RadioIoProgressPhase>('connecting');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [writeWarnings, setWriteWarnings] = useState<string[]>([]);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [lastFirmware, setLastFirmware] = useState<string | undefined>();
  const [lastOccupied, setLastOccupied] = useState<number | null>(null);

  const serialOk = isWebSerialSupported();
  const hydration = getRadioCloneHydration(egress);
  const hasHydration = buildHasRadioCloneHydration(egress);
  const descriptor = descriptors[0];

  const { modalOpen: leaveAttempted, stay } = useUnsavedNavigationGuard(busy);

  // Reset the router blocker so the operator stays on this page; the progress modal
  // already warns to keep the tab open (no extra setState — avoids cascading renders).
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

  if (descriptors.length === 0) return null;

  const attributionNames = (descriptor?.attributionIds ?? [])
    .map((id) => findAttribution(id)?.name)
    .filter(Boolean)
    .join(' / ');

  function onProgress(p: ProgressUpdate) {
    setPhase('transfer');
    setProgress(p);
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

  async function handleRead() {
    setError(null);
    setBusy(true);
    setOperation('read');
    setPhase('connecting');
    setProgress(null);
    abortRef.current = new AbortController();
    try {
      const session = await ensureSession();
      setPhase('transfer');
      const result = await readRadioHydrationForBuild(session, {
        onProgress,
        signal: abortRef.current.signal,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      // Always drop the port on failure so the next attempt (or another app) can open it.
      await releaseSession();
    } finally {
      setBusy(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  async function handleWrite() {
    setError(null);
    setWriteWarnings([]);
    setBusy(true);
    setOperation('write');
    setPhase('connecting');
    setProgress(null);
    abortRef.current = new AbortController();
    try {
      if (!activeProjectId) {
        throw new Error('No active project.');
      }
      const library = await loadLibrarySlice(persistence, activeProjectId);
      setPhase('preparing');
      const { image, warnings } = prepareRadioWriteImage(build, egress, library);
      setPhase('connecting');
      const session = await ensureSession(true);
      setPhase('transfer');
      await uploadPreparedRadioWrite(session, egress, image, {
        onProgress,
        signal: abortRef.current.signal,
      });
      if (warnings.length > 0) setWriteWarnings(warnings);
    } catch (err) {
      if (err instanceof RadioWriteBlockedError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
      await releaseSession();
    } finally {
      setBusy(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
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
      <WebSerialExperimentalAlert />
      <Text fw={600} size="sm">
        Direct radio (Web Serial)
      </Text>
      <Text size="sm" c="dimmed">
        Read stores a clone image on this egress pathway so unmodelled settings survive write-back.
        Write sends the assembled build into that image — it does not import channels into the
        library.
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
      <Group gap="xs">
        <Button
          size="xs"
          variant="light"
          disabled={!serialOk || busy}
          onClick={() => void handleRead()}
        >
          Read from radio
        </Button>
        <Button
          size="xs"
          disabled={!serialOk || busy || !hasHydration}
          onClick={() => void handleWrite()}
        >
          Write to radio
        </Button>
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
          ) : null}
          <Button size="xs" variant="subtle" mt="xs" onClick={() => void handleClearHydration()}>
            Clear stored image
          </Button>
        </Alert>
      ) : (
        <Text size="xs" c="dimmed">
          Write requires a prior Read on this egress ({descriptor?.label ?? 'compatible radio'}).
        </Text>
      )}
      {error ? <Alert color="red">{error}</Alert> : null}
      {writeWarnings.length > 0 ? (
        <Alert color="yellow" title="Write warnings">
          <Stack gap={4}>
            {writeWarnings.map((line) => (
              <Text key={line} size="sm">
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
        navigationBlocked={leaveAttempted}
        onCancel={handleCancel}
      />
    </Stack>
  );
}
