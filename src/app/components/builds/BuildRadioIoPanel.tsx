/**
 * Web Serial connect / read (hydrate FormatBuild) / write (assemble → radio)
 * for builds with a registered radio adapter.
 */

import { useEffect, useRef, useState } from 'react';
import { Alert, Anchor, Button, Group, Progress, Stack, Text } from '@mantine/core';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { ProgressUpdate, RadioSession } from '@integrations/radio-io/types.ts';
import { findAttribution } from '../../lib/attributions.ts';
import { loadLibrarySlice } from '../../lib/loadLibrarySlice.ts';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';
import { useProjects } from '../../state/useProjects.ts';
import {
  buildHasRadioCloneHydration,
  closeRadioSession,
  descriptorsForBuild,
  getRadioCloneHydration,
  getWebSerialUnsupportedMessage,
  isWebSerialSupported,
  openRadioSessionForBuild,
  RadioWriteBlockedError,
  readRadioHydrationForBuild,
  writeBuildToRadio,
} from '../../services/radioIoSession.ts';

export interface BuildRadioIoPanelProps {
  build: FormatBuild;
}

const buildService = new BuildService(persistence);

export default function BuildRadioIoPanel({ build }: BuildRadioIoPanelProps) {
  const descriptors = descriptorsForBuild(build);
  const { activeProjectId } = useProjects();
  const { putBuild } = useFormatBuilds();
  const sessionRef = useRef<RadioSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [lastFirmware, setLastFirmware] = useState<string | undefined>();
  const [lastOccupied, setLastOccupied] = useState<number | null>(null);

  const serialOk = isWebSerialSupported();
  const hydration = getRadioCloneHydration(build);
  const hasHydration = buildHasRadioCloneHydration(build);
  const descriptor = descriptors[0];

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
    setProgress(p);
  }

  async function ensureSession(): Promise<RadioSession> {
    if (sessionRef.current) return sessionRef.current;
    const { session } = await openRadioSessionForBuild(build, { forcePortSelection: true });
    sessionRef.current = session;
    setConnected(true);
    return session;
  }

  async function handleRead() {
    setError(null);
    setBusy(true);
    setProgress(null);
    abortRef.current = new AbortController();
    try {
      const session = await ensureSession();
      const result = await readRadioHydrationForBuild(session, {
        onProgress,
        signal: abortRef.current.signal,
      });
      const next = buildService.withCpsWireHydration(build, result.hydration);
      const saved = await putBuild(next, build.revision);
      if (!saved.ok) {
        throw new Error(
          saved.reason === 'revision_conflict'
            ? 'Build changed elsewhere — reload and try again.'
            : 'Could not save radio hydration on the build.',
        );
      }
      setLastFirmware(result.firmware);
      setLastOccupied(result.channelCountOccupied);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  async function handleWrite() {
    setError(null);
    setBusy(true);
    setProgress(null);
    abortRef.current = new AbortController();
    try {
      if (!activeProjectId) {
        throw new Error('No active project.');
      }
      const library = await loadLibrarySlice(persistence, activeProjectId);
      const session = await ensureSession();
      await writeBuildToRadio(session, build, library, {
        onProgress,
        signal: abortRef.current.signal,
      });
    } catch (err) {
      if (err instanceof RadioWriteBlockedError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
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
    const session = sessionRef.current;
    sessionRef.current = null;
    setConnected(false);
    if (session) await closeRadioSession(session);
  }

  async function handleClearHydration() {
    if (!hasHydration) return;
    const next = buildService.clearCpsWireHydration(build);
    const saved = await putBuild(next, build.revision);
    if (!saved.ok) {
      setError('Could not clear stored radio image.');
      return;
    }
    setLastFirmware(undefined);
    setLastOccupied(null);
  }

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Direct radio (Web Serial)
      </Text>
      <Text size="sm" c="dimmed">
        Read stores a clone image on this format build so unmodelled settings survive write-back.
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
        {busy ? (
          <Button size="xs" variant="default" color="gray" onClick={handleCancel}>
            Cancel
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
      {progress ? (
        <Stack gap={4}>
          <Text size="xs">
            {progress.msg} ({progress.cur}/{progress.max})
          </Text>
          <Progress value={progress.max ? (100 * progress.cur) / progress.max : 0} />
        </Stack>
      ) : null}
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
            Unmodelled registers are retained for write-back. Settings are not editable here.
          </Text>
          <Button size="xs" variant="subtle" mt="xs" onClick={() => void handleClearHydration()}>
            Clear stored image
          </Button>
        </Alert>
      ) : (
        <Text size="xs" c="dimmed">
          Write requires a prior Read on this build ({descriptor?.label ?? 'compatible radio'}).
        </Text>
      )}
      {error ? <Alert color="red">{error}</Alert> : null}
    </Stack>
  );
}
